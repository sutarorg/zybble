import { inngest } from "@/inngest/client";
import { listWorkspaces } from "@/features/workspaces/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AppError, UnauthenticatedError } from "@/lib/errors";
import { env, isSupabaseConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createSupabaseServerClient, type ServerSupabase } from "@/lib/supabase/server";
import { assertTimeZone } from "@/lib/time";
import type { User } from "@supabase/supabase-js";
import type { ProfileRow, WorkspaceRow } from "@/lib/supabase/database.types";

/**
 * Authentication and onboarding.
 *
 * Identity is Supabase Auth's job; this module owns everything around it:
 *
 *  - creating the `profiles` row that the app (and RLS) reads,
 *  - deciding whether a session still needs onboarding,
 *  - the redirect URLs used by Supabase's own verification and reset emails,
 *    which are the supported mechanism for those two flows.
 *
 * Sessions stay in httpOnly cookies managed by `@supabase/ssr` and are refreshed
 * in `src/proxy.ts` — nothing here writes tokens to storage the browser can
 * read.
 */

export type SessionState = {
  user: {
    id: string;
    email: string;
    emailVerified: boolean;
  };
  /** Mirrors `UserProfile` in `src/lib/app/types.ts`. */
  profile: {
    id: string;
    name: string | null;
    email: string;
    timezone: string;
    emailVerified: boolean;
    onboardingCompletedAt: string | null;
  };
  /** Mirrors `Workspace` in `src/lib/app/types.ts`. */
  workspaces: Array<{
    id: string;
    name: string;
    slug: string;
    plan: "free" | "pro";
    seats: number;
    timezone: string;
    createdAt: string;
    role: string;
  }>;
  /** True when the user has no workspace yet and must complete onboarding. */
  requiresOnboarding: boolean;
  capabilities: {
    supabaseConfigured: boolean;
    linkedinConfigured: boolean;
    analyticsScopeEnabled: boolean;
  };
};

function appUrl(path = "/"): string {
  const base = (env().APP_URL ?? env().NEXT_PUBLIC_SITE_URL).replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Only ever redirect to a path on our own origin. Prevents `?redirectTo=` from
 * turning the reset or verification flow into an open redirect.
 */
export function safeReturnPath(candidate: string | undefined | null, fallback: string): string {
  if (!candidate) return appUrl(fallback);
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return appUrl(fallback);
  return appUrl(candidate);
}

/**
 * Ensure the `profiles` row exists.
 *
 * There is no auth.users trigger for this (the row is application-owned), so it
 * is created on first sight. The insert is an upsert on the primary key, which
 * makes it safe to call concurrently and on every session read.
 */
export async function ensureProfile(
  supabase: ServerSupabase,
  user: User,
  overrides: { fullName?: string | null; timezone?: string } = {},
): Promise<ProfileRow> {
  const email = user.email ?? "";

  const { data: existing } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (existing) {
    const row = existing as ProfileRow;

    const patch: Partial<ProfileRow> = {};
    if (email && row.email !== email) patch.email = email;
    if (overrides.timezone && overrides.timezone !== row.timezone) patch.timezone = overrides.timezone;
    if (overrides.fullName && !row.full_name) patch.full_name = overrides.fullName;

    if (Object.keys(patch).length === 0) return row;

    const { data: updated } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", user.id)
      .select("*")
      .maybeSingle();

    return (updated as ProfileRow | null) ?? row;
  }

  const { data: created, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        email,
        full_name: overrides.fullName ?? (user.user_metadata?.full_name as string | undefined) ?? null,
        avatar_url: (user.user_metadata?.avatar_url as string | undefined) ?? null,
        timezone: overrides.timezone ?? "UTC",
      },
      { onConflict: "id" },
    )
    .select("*")
    .maybeSingle();

  if (error || !created) {
    logger.error("auth.profile_create_failed", { error: error?.message });
    throw new AppError("internal_error", "Could not create your profile.");
  }

  return created as ProfileRow;
}

export async function getSessionState(
  supabase: ServerSupabase,
  user: User,
): Promise<SessionState> {
  const profile = await ensureProfile(supabase, user);
  const workspaces = await listWorkspaces(supabase);

  return {
    user: {
      id: user.id,
      email: user.email ?? profile.email,
      emailVerified: Boolean(user.email_confirmed_at),
    },
    profile: {
      id: profile.id,
      name: profile.full_name,
      email: profile.email ?? user.email ?? "",
      timezone: profile.timezone,
      emailVerified: Boolean(user.email_confirmed_at),
      onboardingCompletedAt: profile.onboarding_completed_at,
    },
    workspaces: workspaces.map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      plan: workspace.plan === "pro" ? ("pro" as const) : ("free" as const),
      seats: workspace.seats ?? 1,
      timezone: workspace.timezone,
      createdAt: workspace.created_at,
      role: "owner",
    })),
    requiresOnboarding: workspaces.length === 0,
    capabilities: {
      supabaseConfigured: isSupabaseConfigured(),
      linkedinConfigured: Boolean(env().LINKEDIN_CLIENT_ID && env().LINKEDIN_CLIENT_SECRET),
      analyticsScopeEnabled: env().LINKEDIN_ANALYTICS_SCOPE_ENABLED,
    },
  };
}

export type SignupResult = {
  /** True when Supabase requires the email to be confirmed before sign-in. */
  requiresEmailConfirmation: boolean;
  userId: string | null;
  sessionState: SessionState | null;
};

export async function signUp(input: {
  email: string;
  password: string;
  fullName?: string;
  timezone: string;
  redirectTo?: string;
}): Promise<SignupResult> {
  const supabase = await createSupabaseServerClient();
  const timeZone = assertTimeZone(input.timezone);

  const emailRedirectTo = safeReturnPath(input.redirectTo, "/auth/callback");

  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo,
      data: {
        full_name: input.fullName ?? null,
        timezone: timeZone,
      },
    },
  });

  if (error) {
    throw new AppError("validation_failed", friendlyAuthError(error.message), {
      cause: error,
    });
  }

  const user = data.user;

  if (!user) {
    throw new AppError("internal_error", "Sign-up did not return a user. Try again.");
  }

  // Supabase returns a session when email confirmation is disabled, and
  // `identities: []` when the address already exists but is unconfirmed.
  const requiresEmailConfirmation = data.session === null;

  let sessionState: SessionState | null = null;

  if (data.session) {
    await ensureProfile(supabase, user, { fullName: input.fullName, timezone: timeZone });
    sessionState = await getSessionState(supabase, user);
    await queueWelcomeEmail(user.id);
  }

  return { requiresEmailConfirmation, userId: user.id, sessionState };
}

export async function signIn(input: { email: string; password: string }): Promise<SessionState> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });

  if (error) {
    throw new AppError("unauthenticated", friendlyAuthError(error.message), { cause: error });
  }

  return getSessionState(supabase, data.user);
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    // A stale cookie is not an error worth surfacing: the session is gone.
    logger.warn("auth.signout_failed", { error: error.message });
  }
}

/** Supabase sends the reset email; we only supply a safe return URL. */
export async function requestPasswordReset(input: {
  email: string;
  redirectTo?: string;
}): Promise<{ accepted: true }> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.resetPasswordForEmail(input.email, {
    redirectTo: safeReturnPath(input.redirectTo, "/reset-password"),
  });

  // Always report success: telling the caller whether an address exists would
  // turn this endpoint into a user-enumeration oracle.
  if (error) {
    logger.warn("auth.password_reset_failed", { error: error.message });
  }

  return { accepted: true };
}

export async function updatePassword(password: string): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    throw new AppError("validation_failed", friendlyAuthError(error.message), { cause: error });
  }
}

export async function resendVerification(input: {
  email: string;
  redirectTo?: string;
}): Promise<{ accepted: true }> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.resend({
    type: "signup",
    email: input.email,
    options: { emailRedirectTo: safeReturnPath(input.redirectTo, "/auth/callback") },
  });

  if (error) {
    logger.warn("auth.resend_verification_failed", { error: error.message });
  }

  return { accepted: true };
}

/**
 * First-time setup: create the workspace (atomic in `public.create_workspace`,
 * which also seeds the owner membership, subscription row and usage counter),
 * stamp the profile and queue the welcome email.
 */
export async function completeOnboarding(input: {
  userId: string;
  workspaceName: string;
  timezone: string;
  fullName?: string;
}): Promise<{ workspace: WorkspaceRow; sessionState: SessionState }> {
  const supabase = await createSupabaseServerClient();
  const timeZone = assertTimeZone(input.timezone);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== input.userId) {
    throw new UnauthenticatedError("Sign in to finish setting up your workspace.");
  }

  await ensureProfile(supabase, user, { fullName: input.fullName, timezone: timeZone });

  const { data: workspaceId, error } = await supabase.rpc("create_workspace", {
    workspace_name: input.workspaceName,
    workspace_timezone: timeZone,
  });

  if (error || !workspaceId) {
    throw new AppError("internal_error", "Could not create the workspace.", {
      details: error ? { code: error.code } : undefined,
    });
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", workspaceId as string)
    .maybeSingle();

  if (!workspace) {
    throw new AppError("internal_error", "The workspace was created but could not be read back.");
  }

  await supabase
    .from("profiles")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", user.id);

  await queueWelcomeEmail(user.id);

  return { workspace: workspace as WorkspaceRow, sessionState: await getSessionState(supabase, user) };
}

async function queueWelcomeEmail(userId: string): Promise<void> {
  try {
    if (!env().INNGEST_EVENT_KEY && env().NODE_ENV !== "production") {
      // Local development without Inngest: skip rather than fail sign-up.
      return;
    }

    await inngest.send({ name: "email/send", data: { template: "welcome", userId } });
  } catch (error) {
    logger.error("auth.welcome_email_failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}

/**
 * Update the caller's own profile.
 *
 * The email is deliberately *not* changeable here: an email change in Supabase
 * Auth requires re-verification through the provider's own flow, and silently
 * changing it would desynchronise `auth.users` from `public.profiles`.
 */
export async function updateProfile(input: {
  fullName?: string | null;
  timezone?: string;
}): Promise<{ profile: { id: string; name: string | null; email: string; timezone: string; emailVerified: boolean; onboardingCompletedAt: string | null } }> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new UnauthenticatedError("Sign in to continue.");

  const patch: { full_name?: string | null; timezone?: string } = {};

  if (input.fullName !== undefined) {
    const value = input.fullName?.trim() ?? "";
    patch.full_name = value.length > 0 ? value.slice(0, 80) : null;
  }

  if (input.timezone !== undefined) {
    patch.timezone = assertTimeZone(input.timezone);
  }

  if (Object.keys(patch).length === 0) {
    const state = await getSessionState(supabase, user);
    return { profile: state.profile };
  }

  await ensureProfile(supabase, user);

  const { data: row, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", user.id)
    .select("id, full_name, email, timezone, onboarding_completed_at")
    .maybeSingle();

  if (error || !row) {
    throw new AppError("internal_error", "Could not save your profile.");
  }

  return {
    profile: {
      id: row.id,
      name: row.full_name,
      email: row.email ?? user.email ?? "",
      timezone: row.timezone,
      emailVerified: Boolean(user.email_confirmed_at),
      onboardingCompletedAt: row.onboarding_completed_at,
    },
  };
}

/**
 * Account deletion (right to erasure).
 *
 * Order matters: cancel billing first (so no further invoice is raised), then
 * purge every workspace the user owns — which deletes secrets, media rows,
 * posts, analytics and audit logs inside one transaction each — and finally
 * delete the auth user. Storage objects are removed by the caller before the
 * purge so no orphaned blobs are left behind.
 *
 * The audit log is intentionally *not* retained after this: the rows belong to
 * the workspaces being deleted. The deletion itself is recorded by the caller.
 */
export async function deleteAccount(confirmation: { password: string }): Promise<{
  deleted: true;
  workspacesPurged: number;
  cancellationQueued: boolean;
}> {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new UnauthenticatedError("Sign in to continue.");

  // Re-authenticate before destroying anything: a session left open on a shared
  // machine must not be enough to erase an account.
  const { error: confirmError } = await supabase.auth.signInWithPassword({
    email: user.email ?? "",
    password: confirmation.password,
  });

  if (confirmError) {
    throw new AppError("validation_failed", "That password was not correct.");
  }

  const { data: memberships, error: memberError } = await admin
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", user.id);

  if (memberError) {
    throw new AppError("internal_error", "Could not read your workspaces.");
  }

  const rows = (memberships ?? []) as Array<{ workspace_id: string; role: string }>;
  const owned = rows.filter((row) => row.role === "owner").map((row) => row.workspace_id);

  let cancellationQueued = false;

  // Cancel any live subscription before the rows disappear, so Dodo cannot
  // bill a customer that no longer exists.
  for (const workspaceId of owned) {
    const { data: subscription } = await admin
      .from("subscriptions")
      .select("dodo_subscription_id, status, plan")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    const row = subscription as { dodo_subscription_id: string | null; status: string | null; plan: string | null } | null;

    if (!row?.dodo_subscription_id || row.plan !== "pro") continue;
    if (!["active", "past_due", "pending", "on_hold", "paused"].includes(row.status ?? "")) continue;

    try {
      await inngest.send({
        name: "billing/subscription.cancel",
        data: { workspaceId, reason: "account_deleted" },
      });
      cancellationQueued = true;
    } catch (error) {
      logger.error("auth.cancel_on_delete_failed", {
        workspaceId,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  // Leave workspaces owned by someone else first, so the "one owner" guard
  // elsewhere is never tripped by a dangling membership.
  for (const row of rows.filter((item) => item.role !== "owner")) {
    await admin
      .from("workspace_members")
      .update({ status: "removed" })
      .eq("workspace_id", row.workspace_id)
      .eq("user_id", user.id);
  }

  for (const workspaceId of owned) {
    const { error } = await admin.rpc("purge_workspace_data", { target_workspace: workspaceId });
    if (error) {
      logger.error("auth.purge_workspace_failed", { workspaceId, error: error.message });
      throw new AppError("internal_error", "Could not delete every workspace. Nothing was removed.");
    }
  }

  // Consume any in-flight OAuth attempt belonging to this user.
  await admin.from("linkedin_oauth_states").delete().eq("user_id", user.id);

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);

  if (deleteError) {
    logger.error("auth.delete_user_failed", { error: deleteError.message });
    throw new AppError("internal_error", "Could not delete the account. Please contact support.");
  }

  return { deleted: true, workspacesPurged: owned.length, cancellationQueued };
}

/**
 * Supabase error strings are stable but written for developers; these are the
 * ones users actually hit, rewritten as sentences. Anything unmatched is
 * returned as-is — it is already safe to display.
 */
export function friendlyAuthError(message: string): string {
  const value = message.toLowerCase();

  if (value.includes("invalid login credentials")) {
    return "That email and password combination is not correct.";
  }
  if (value.includes("email not confirmed")) {
    return "Confirm your email address first — check your inbox for the confirmation link.";
  }
  if (value.includes("user already registered")) {
    return "An account with this email already exists. Sign in instead.";
  }
  if (value.includes("password should be at least")) {
    return "Choose a longer password.";
  }
  if (value.includes("unable to validate email address") || value.includes("invalid format")) {
    return "That email address is not valid.";
  }
  if (value.includes("both auth code and code verifier")) {
    return "This sign-in link has expired. Request a new one.";
  }
  if (value.includes("new password should be different")) {
    return "Choose a password you have not used before.";
  }
  if (value.includes("over_email_send_rate_limit") || value.includes("rate limit")) {
    return "Too many attempts. Wait a few minutes and try again.";
  }

  return message;
}
