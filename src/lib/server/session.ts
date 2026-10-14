/**
 * Server-side session and authorisation helpers.
 *
 * Everything here runs on the server. Roles come from the `profiles` row, which
 * RLS protects — never from a cookie value, a query parameter, client context or
 * user metadata, all of which are attacker-controlled.
 */

import "server-only";
import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { isServiceRoleConfigured, isSupabaseConfigured } from "@/lib/env";

export type { AppRole, SessionCreator, SessionProfile } from "@/lib/server/session-types";
import type { SessionProfile } from "@/lib/server/session-types";

/**
 * Returns the verified Supabase user, or `null` for anonymous visitors.
 * `getClaims()` verifies the token signature; a forged cookie cannot pass it.
 */
export const getAuthUser = cache(async (): Promise<User | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerClient();
  // getClaims() verifies the token signature; getUser() then resolves the
  // verified subject to an up-to-date Auth record. Neither trusts the cookie.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
});

/** Full session profile including the authoritative role, or `null`. */
export const getSession = cache(async (): Promise<SessionProfile | null> => {
  const user = await getAuthUser();
  if (!user) return null;

  const supabase = await createServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, email, full_name, avatar_key, role, status, email_verified, country_code, locale, creator_profiles (username, display_name, headline, onboarding_status, onboarded_at, route_account_id, route_account_status, route_settlement_verified, route_error)"
    )
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return null;

  const creatorRow = (Array.isArray(profile.creator_profiles)
    ? profile.creator_profiles[0]
    : profile.creator_profiles) as Record<string, unknown> | null;

  const fullName = profile.full_name ?? user.email?.split("@")[0] ?? "Learner";

  return {
    id: profile.id,
    email: profile.email,
    fullName,
    initials: initialsOf(fullName),
    avatarKey: profile.avatar_key,
    role: profile.role as SessionProfile["role"],
    status: profile.status as SessionProfile["status"],
    emailVerified: Boolean(profile.email_verified),
    countryCode: profile.country_code,
    locale: profile.locale ?? "en",
    creator: creatorRow
      ? {
          username: (creatorRow.username as string) ?? null,
          displayName: (creatorRow.display_name as string) ?? null,
          headline: (creatorRow.headline as string) ?? null,
          onboardingStatus: String(creatorRow.onboarding_status ?? "not_started"),
          onboardedAt: (creatorRow.onboarded_at as string) ?? null,
          routeAccountId: (creatorRow.route_account_id as string) ?? null,
          routeAccountStatus: (creatorRow.route_account_status as string) ?? null,
          routeSettlementVerified: Boolean(creatorRow.route_settlement_verified),
          routeError: (creatorRow.route_error as string) ?? null,
        }
      : null,
  };
});

export function initialsOf(name: string): string {
  return (
    name
      .split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "Z"
  );
}

/** True when the caller is signed in with an admin or moderator role. */
export async function requireAdmin(): Promise<SessionProfile> {
  const session = await getSession();
  if (!session) throw new AuthorizationError("Authentication required", 401);
  if (session.role !== "admin" && session.role !== "moderator") {
    throw new AuthorizationError("Administrator access required", 403);
  }
  if (session.status !== "active") {
    throw new AuthorizationError("Account is not active", 403);
  }
  return session;
}

/** True when the caller may open the creator studio. */
export async function requireCreator(): Promise<SessionProfile> {
  const session = await getSession();
  if (!session) throw new AuthorizationError("Authentication required", 401);
  if (session.status !== "active") throw new AuthorizationError("Account is not active", 403);
  if (!session.creator) throw new AuthorizationError("Creator profile required", 403);
  return session;
}

/** Signed-in or anonymous — used by pages that render differently for both. */
export const getOptionalSession = getSession;

/** Throws a 401 for anonymous callers. */
export async function requireSession(): Promise<SessionProfile> {
  const session = await getSession();
  if (!session) throw new AuthorizationError("Authentication required", 401);
  if (session.status !== "active") throw new AuthorizationError("Account is not active", 403);
  return session;
}

export class AuthorizationError extends Error {
  readonly status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.name = "AuthorizationError";
    this.status = status;
  }
}

/** Service-role client, or a thrown error when it is not configured. */
export function requireServiceClient() {
  const client = createServiceClient();
  if (!client || !isServiceRoleConfigured()) {
    throw new AuthorizationError("Server-side service credentials are not configured", 503);
  }
  return client;
}

export { toUiUser } from "@/lib/session-user";
