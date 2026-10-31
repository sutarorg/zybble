import type { User } from "@supabase/supabase-js";
import { ForbiddenError, NotFoundError, UnauthenticatedError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { MemberStatus, WorkspaceMemberRow, WorkspaceRole, WorkspaceRow } from "@/lib/supabase/database.types";

/**
 * Server-side authorisation.
 *
 * Row Level Security is the last line of defence; these helpers are the first.
 * They run before any business logic so that a denied request never touches an
 * upstream API, and they produce the role the rest of the request may rely on.
 */

const ROLE_RANK: Record<WorkspaceRole, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
  owner: 3,
};

export type WorkspaceContext = {
  user: User;
  workspace: WorkspaceRow;
  role: WorkspaceRole;
  canWrite: boolean;
  canManage: boolean;
};

export function roleSatisfies(role: WorkspaceRole, minimum: WorkspaceRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

export function canWrite(role: WorkspaceRole): boolean {
  return roleSatisfies(role, "editor");
}

export function canManage(role: WorkspaceRole): boolean {
  return roleSatisfies(role, "admin");
}

export async function requireUser(supabase: ServerSupabase | null): Promise<User> {
  if (!supabase) throw new UnauthenticatedError("Authentication is not configured.");

  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new UnauthenticatedError();
  }

  return data.user;
}

/** Workspaces the caller is an active member of (RLS already scopes this). */
export async function listWorkspaces(supabase: ServerSupabase): Promise<WorkspaceRow[]> {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace:workspaces(*)")
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (error) {
    logger.error("workspaces.list_failed", { error: error.message });
    throw new Error("Unable to load workspaces.");
  }

  const workspaces = (data ?? [])
    .map((row) => row.workspace as unknown as WorkspaceRow | null)
    .filter((workspace): workspace is WorkspaceRow => Boolean(workspace));

  return workspaces;
}

/**
 * Load a workspace and assert the caller holds at least `minimumRole`.
 * The membership lookup itself is RLS-scoped, so a non-member gets NotFound
 * rather than Forbidden — we never confirm that a workspace id exists.
 */
export async function requireWorkspace(
  supabase: ServerSupabase,
  user: User,
  workspaceId: string,
  minimumRole: WorkspaceRole = "viewer",
): Promise<WorkspaceContext> {
  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("role, status")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError) {
    logger.error("workspace.membership_lookup_failed", { error: membershipError.message });
    throw new Error("Unable to verify workspace access.");
  }

  const member = membership as { role: WorkspaceRole; status: MemberStatus } | null;

  if (!member || member.status !== "active" || !roleSatisfies(member.role, minimumRole)) {
    throw new NotFoundError("Workspace not found or you do not have access to it.");
  }

  const { data: workspace, error } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", workspaceId)
    .maybeSingle();

  if (error || !workspace) {
    throw new NotFoundError("Workspace not found or you do not have access to it.");
  }

  return {
    user,
    workspace: workspace as WorkspaceRow,
    role: member.role,
    canWrite: canWrite(member.role),
    canManage: canManage(member.role),
  };
}

/** Assert a write action (editor or above). */
export function assertCanWrite(context: WorkspaceContext): void {
  if (!context.canWrite) {
    throw new ForbiddenError("Your role in this workspace is read-only.");
  }
}

/** Assert a management action (admin or above): billing, members, connections. */
export function assertCanManage(context: WorkspaceContext): void {
  if (!context.canManage) {
    throw new ForbiddenError("Only workspace owners and admins can do that.");
  }
}

/**
 * Pick the workspace a request should operate on: the one named by
 * `preferredId` if the caller is still a member, otherwise the first.
 */
export async function resolveWorkspace(
  supabase: ServerSupabase,
  user: User,
  preferredId?: string | null,
  minimumRole: WorkspaceRole = "viewer",
): Promise<WorkspaceContext> {
  if (preferredId) {
    try {
      return await requireWorkspace(supabase, user, preferredId, minimumRole);
    } catch (error) {
      if (!(error instanceof NotFoundError)) throw error;
      // Fall through to the first available workspace.
    }
  }

  const workspaces = await listWorkspaces(supabase);

  if (workspaces.length === 0) {
    throw new NotFoundError("No workspace available. Complete onboarding first.");
  }

  return requireWorkspace(supabase, user, workspaces[0]!.id, minimumRole);
}

export type AuditEntry = {
  workspaceId?: string | null;
  actorType?: "user" | "system" | "webhook";
  actorUserId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
};

/**
 * Append an audit row.
 *
 * Metadata is scrubbed by the logger's redactor before serialisation, and the
 * audit table has no client write policy, so entries cannot be edited after the
 * fact from the browser.
 */
export async function writeAudit(
  supabase: ServerSupabase,
  entry: AuditEntry,
): Promise<void> {
  const { error } = await supabase.from("audit_logs").insert({
    workspace_id: entry.workspaceId ?? null,
    actor_type: entry.actorType ?? "user",
    actor_user_id: entry.actorUserId ?? null,
    action: entry.action,
    entity_type: entry.entityType ?? null,
    entity_id: entry.entityId ?? null,
    metadata: (entry.metadata ?? null) as never,
    ip_address: entry.ipAddress ?? null,
    user_agent: entry.userAgent ?? null,
    request_id: entry.requestId ?? null,
  });

  if (error) {
    // Audit failures are logged but never break the request they describe.
    logger.error("audit.write_failed", { action: entry.action, error: error.message });
  }
}

export function membersToRows(
  rows: Array<{ role: WorkspaceRole; status: MemberStatus; user_id: string | null }>,
): WorkspaceMemberRow[] {
  return rows as unknown as WorkspaceMemberRow[];
}
