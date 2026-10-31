import { createHash, randomBytes } from "node:crypto";
import { inngest } from "@/inngest/client";
import { entitlementsFor } from "@/features/billing/entitlements";
import type { WorkspaceContext } from "@/features/workspaces/access";
import { AppError, ConflictError, NotFoundError } from "@/lib/errors";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";
import { assertTimeZone } from "@/lib/time";
import type {
  MemberStatus,
  UsageCounterRow,
  WorkspaceMemberRow,
  WorkspaceRole,
  WorkspaceRow,
} from "@/lib/supabase/database.types";

/**
 * Workspace lifecycle and team management.
 *
 * Two rules run through everything here:
 *
 *  1. **The database enforces the invariants.** The owner guard, the seat
 *     definition and the plan limits are triggers and RLS policies; this module
 *     translates their errors into sentences rather than re-checking them.
 *  2. **Every membership change emits `billing/seats.sync`.** Seats are billed
 *     members, so adding or removing a teammate must move the subscription — the
 *     job makes that eventual-consistent instead of blocking the invite on a
 *     payment API call.
 */

const INVITE_TTL_DAYS = 7;

export type MemberView = {
  id: string;
  userId: string | null;
  email: string;
  name: string | null;
  role: WorkspaceRole;
  status: MemberStatus;
  joinedAt: string | null;
  invitedAt: string | null;
  inviteExpiresAt: string | null;
};

export async function createWorkspace(
  supabase: ServerSupabase,
  input: { name: string; timezone: string },
): Promise<WorkspaceRow> {
  const timeZone = assertTimeZone(input.timezone);

  const { data, error } = await supabase.rpc("create_workspace", {
    workspace_name: input.name,
    workspace_timezone: timeZone,
  });

  if (error) {
    throw new AppError("internal_error", "Could not create the workspace.", {
      details: { code: error.code },
    });
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", data as string)
    .maybeSingle();

  if (!workspace) throw new NotFoundError("The workspace was created but could not be read back.");

  return workspace as WorkspaceRow;
}

export async function listMembers(context: WorkspaceContext): Promise<MemberView[]> {
  const supabase = createSupabaseAdminClient();

  const { data: members, error } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("workspace_id", context.workspace.id)
    .order("created_at", { ascending: true });

  if (error) throw new AppError("internal_error", "Could not load the team.");

  const rows = (members ?? []) as WorkspaceMemberRow[];
  const userIds = rows.map((row) => row.user_id).filter((id): id is string => Boolean(id));

  const names = new Map<string, string>();

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds);

    for (const profile of (profiles ?? []) as Array<{
      id: string;
      full_name: string | null;
      email: string;
    }>) {
      names.set(profile.id, profile.full_name ?? profile.email);
    }
  }

  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    email: row.email,
    name: row.user_id ? names.get(row.user_id) ?? null : null,
    role: row.role,
    status: row.status,
    joinedAt: row.joined_at,
    invitedAt: row.invited_at,
    inviteExpiresAt: row.invite_expires_at,
  }));
}

/**
 * Invite by email.
 *
 * The token is generated here, emailed, and only its SHA-256 hash is stored —
 * so a database leak cannot be replayed as an invite. Re-inviting the same
 * address rotates the token and invalidates the previous link.
 */
export async function inviteMember(
  context: WorkspaceContext,
  input: { email: string; role: Exclude<WorkspaceRole, "owner"> },
): Promise<{ invitation: MemberView; inviteUrl: string | null }> {
  const supabase = createSupabaseAdminClient();
  const email = input.email.trim().toLowerCase();

  const { data: existing } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("workspace_id", context.workspace.id)
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    const row = existing as WorkspaceMemberRow;

    if (row.status === "active") {
      throw new ConflictError("That person is already a member of this workspace.");
    }
  }

  const entitlement = entitlementsFor(context.workspace.plan);

  if (existing) {
    // Rotate the token on the existing invitation row.
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000);

    const { data: updated, error } = await supabase
      .from("workspace_members")
      .update({
        role: input.role,
        invited_by: context.user.id,
        invite_token_hash: sha256(token),
        invite_expires_at: expiresAt.toISOString(),
        invited_at: new Date().toISOString(),
      })
      .eq("id", (existing as WorkspaceMemberRow).id)
      .select("*")
      .maybeSingle();

    if (error || !updated) throw new AppError("internal_error", "Could not send the invitation.");

    return {
      invitation: toMemberView(updated as WorkspaceMemberRow, null),
      inviteUrl: inviteUrl(token),
    };
  }

  if (!entitlement.teamCollaboration) {
    // Free workspaces are single-seat by definition.
    throw new AppError(
      "entitlement_required",
      "Team collaboration is a Pro feature. Upgrade to invite teammates.",
    );
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000);

  const { data: created, error } = await supabase
    .from("workspace_members")
    .insert({
      workspace_id: context.workspace.id,
      email,
      role: input.role,
      status: "invited",
      invited_by: context.user.id,
      invite_token_hash: sha256(token),
      invite_expires_at: expiresAt.toISOString(),
      invited_at: new Date().toISOString(),
    })
    .select("*")
    .maybeSingle();

  if (error || !created) {
    if (error?.code === "23505") {
      throw new ConflictError("That email address is already invited or a member.");
    }
    logger.error("workspace.invite_failed", { error: error?.message });
    throw new AppError("internal_error", "Could not send the invitation.");
  }

  await queueInvitationEmail({
    workspaceId: context.workspace.id,
    workspaceName: context.workspace.name,
    invitationId: (created as WorkspaceMemberRow).id,
    inviterName: context.user.email ?? null,
    token,
  });

  return {
    invitation: toMemberView(created as WorkspaceMemberRow, null),
    inviteUrl: inviteUrl(token),
  };
}

export async function updateMemberRole(
  context: WorkspaceContext,
  memberId: string,
  role: Exclude<WorkspaceRole, "owner">,
): Promise<MemberView> {
  const supabase = createSupabaseAdminClient();

  const { data: member, error: loadError } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("id", memberId)
    .eq("workspace_id", context.workspace.id)
    .maybeSingle();

  if (loadError || !member) throw new NotFoundError("That member is not in this workspace.");

  const row = member as WorkspaceMemberRow;

  if (row.role === "owner") {
    throw new AppError("conflict", "The workspace owner's role cannot be changed.");
  }

  const { data: updated, error } = await supabase
    .from("workspace_members")
    .update({ role })
    .eq("id", memberId)
    .select("*")
    .maybeSingle();

  if (error || !updated) throw new AppError("internal_error", "Could not update that role.");

  return toMemberView(updated as WorkspaceMemberRow, null);
}

/**
 * Remove a member. Pending invitations are deleted outright; real members are
 * marked `removed` so their posts and audit trail keep a stable owner.
 */
export async function removeMember(
  context: WorkspaceContext,
  memberId: string,
): Promise<{ removed: true }> {
  const supabase = createSupabaseAdminClient();

  const { data: member, error: loadError } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("id", memberId)
    .eq("workspace_id", context.workspace.id)
    .maybeSingle();

  if (loadError || !member) throw new NotFoundError("That member is not in this workspace.");

  const row = member as WorkspaceMemberRow;

  if (row.status === "invited") {
    const { error } = await supabase.from("workspace_members").delete().eq("id", memberId);

    if (error) throw new AppError("internal_error", "Could not revoke that invitation.");

    return { removed: true };
  }

  const { error } = await supabase
    .from("workspace_members")
    .update({ status: "removed", user_id: null })
    .eq("id", memberId);

  if (error) {
    if (error.code === "P0001" || error.message.includes("workspace_requires_owner")) {
      throw new AppError(
        "conflict",
        "A workspace must keep at least one owner. Promote someone else first.",
      );
    }
    throw new AppError("internal_error", "Could not remove that member.");
  }

  await enqueueSeatSync(context.workspace.id, context.user.id);

  return { removed: true };
}

/**
 * Accept an invitation. The raw token is hashed before it is compared, matching
 * `public.accept_workspace_invitation`, which never sees the token itself.
 */
export async function acceptInvitation(
  supabase: ServerSupabase,
  userId: string,
  token: string,
): Promise<{ workspaceId: string }> {
  const { data, error } = await supabase.rpc("accept_workspace_invitation", {
    token_hash_value: sha256(token),
  });

  if (error) {
    if (error.message.includes("invitation_expired")) {
      throw new AppError("not_found", "This invitation has expired. Ask for a new one.");
    }
    if (error.message.includes("invitation_email_mismatch")) {
      throw new AppError(
        "forbidden",
        "This invitation was sent to a different email address. Sign in with that address.",
      );
    }
    if (error.message.includes("invitation_not_found")) {
      throw new NotFoundError("That invitation is no longer valid.");
    }

    throw new AppError("internal_error", "Could not accept the invitation.", {
      details: { code: error.code },
    });
  }

  const workspaceId = data as string;

  await enqueueSeatSync(workspaceId, userId);

  return { workspaceId };
}

export async function deleteWorkspace(context: WorkspaceContext): Promise<{ scheduled: true }> {
  const supabase = createSupabaseAdminClient();

  await supabase.from("audit_logs").insert({
    workspace_id: context.workspace.id,
    actor_type: "user",
    actor_user_id: context.user.id,
    action: "workspace.delete_requested",
    entity_type: "workspace",
    entity_id: context.workspace.id,
  });

  await inngest.send({
    name: "workspace/delete.requested",
    data: { workspaceId: context.workspace.id, requestedBy: context.user.id },
  });

  // Erasure runs as a durable job: cancelling publishes, storage cleanup and the
  // provider-side cancellation must all complete even if this request ends.
  return { scheduled: true };
}

export type UsageView = {
  plan: "free" | "pro";
  scheduledThisMonth: number;
  monthlyLimit: number | null;
  remaining: number | null;
  connectedAccounts: number;
  accountLimit: number;
  period: string;
};

export async function getUsage(context: WorkspaceContext): Promise<UsageView> {
  const supabase = createSupabaseAdminClient();
  const entitlement = entitlementsFor(context.workspace.plan);

  const { data: counter } = await supabase
    .from("usage_counters")
    .select("*")
    .eq("workspace_id", context.workspace.id)
    .eq("metric", "scheduled_posts")
    .order("period", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { count: accounts } = await supabase
    .from("linkedin_accounts")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", context.workspace.id)
    .neq("status", "revoked");

  const row = counter as UsageCounterRow | null;
  const used = row?.count ?? 0;

  return {
    plan: context.workspace.plan,
    scheduledThisMonth: used,
    monthlyLimit: entitlement.monthlyScheduleLimit,
    remaining:
      entitlement.monthlyScheduleLimit === null
        ? null
        : Math.max(entitlement.monthlyScheduleLimit - used, 0),
    connectedAccounts: accounts ?? 0,
    accountLimit: entitlement.maxLinkedInAccounts,
    period: row?.period ?? new Date().toISOString().slice(0, 7),
  };
}

export async function enqueueSeatSync(
  workspaceId: string,
  actorUserId: string | null,
): Promise<void> {
  try {
    await inngest.send({ name: "billing/seats.sync", data: { workspaceId, actorUserId } });
  } catch (error) {
    logger.error("workspace.seat_sync_failed", {
      workspaceId,
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function inviteUrl(token: string): string | null {
  const base = env().APP_URL ?? env().NEXT_PUBLIC_SITE_URL;
  return `${base.replace(/\/$/, "")}/invitations?token=${encodeURIComponent(token)}`;
}

/**
 * Queue the invitation email.
 *
 * The event carries the *invitation id*, not the address: Inngest retains event
 * payloads, and the invitee is not yet a user with a profile row. The handler
 * resolves the address from the pending membership row at send time.
 */
async function queueInvitationEmail(input: {
  workspaceId: string;
  workspaceName: string;
  invitationId: string;
  inviterName: string | null;
  token: string;
}): Promise<void> {
  try {
    if (!env().INNGEST_EVENT_KEY && env().NODE_ENV !== "production") return;

    await inngest.send({
      name: "email/send",
      data: {
        template: "team_invitation",
        workspaceId: input.workspaceId,
        payload: {
          workspaceName: input.workspaceName,
          inviterName: input.inviterName,
          invitationId: input.invitationId,
          actionUrl: inviteUrl(input.token),
        },
      },
    });
  } catch (error) {
    logger.error("workspace.invite_email_failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}

function toMemberView(row: WorkspaceMemberRow, name: string | null): MemberView {
  return {
    id: row.id,
    userId: row.user_id,
    email: row.email,
    name,
    role: row.role,
    status: row.status,
    joinedAt: row.joined_at,
    invitedAt: row.invited_at,
    inviteExpiresAt: row.invite_expires_at,
  };
}
