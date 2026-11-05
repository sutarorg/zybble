/**
 * Platform user list.
 *
 * Reads `profiles` (the application's record of a registered account) and
 * enriches each page with that page's workspace memberships. Membership is
 * fetched only for the 25-ish rows actually being shown rather than joined for
 * the whole table, so the cost of a page stays flat as the user base grows.
 *
 * "Account status" is derived strictly from columns that exist:
 *   - `deleted_at` set            → deleted
 *   - onboarding never completed  → pending_onboarding
 *   - otherwise                   → active
 * Nothing here infers activity, engagement or "churn".
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AdminUserRow } from "./types";
import { clampPage, clampPerPage, pageRange, paginated, searchClause } from "./query";

export type UserStatusFilter = "all" | "active" | "pending_onboarding" | "deleted";

export type UsersQuery = {
  search?: string;
  status?: UserStatusFilter;
  page?: number;
  perPage?: number;
};

/**
 * The subset of PostgREST's filter builder these queries use.
 *
 * Typing the helper against this shape rather than against `any` means the
 * compiler still checks the chained calls, while one helper can serve both the
 * `head: true` count query and the paged row query.
 */
type Filterable<T> = {
  or: (clause: string) => T;
  is: (column: string, value: null) => T;
  not: (column: string, operator: string, value: null) => T;
};

function applyUserFilters<T extends Filterable<T>>(query: T, filters: UsersQuery): T {
  let result = query;

  const search = filters.search?.trim();
  if (search) {
    result = result.or(searchClause(["email", "full_name"], search));
  }

  if (filters.status === "active") {
    result = result.is("deleted_at", null).not("onboarding_completed_at", "is", null);
  } else if (filters.status === "pending_onboarding") {
    result = result.is("deleted_at", null).is("onboarding_completed_at", null);
  } else if (filters.status === "deleted") {
    result = result.not("deleted_at", "is", null);
  }

  return result;
}

export async function loadUsers(query: UsersQuery) {
  const admin = createSupabaseAdminClient();

  const page = clampPage(query.page);
  const perPage = clampPerPage(query.perPage);
  const { from, to } = pageRange(page, perPage);

  // The count and the page are built from the same filters, so "how many are
  // there" can never drift from "which ones am I looking at".
  const { count, error: countError } = await applyUserFilters(
    admin.from("profiles").select("*", { count: "exact", head: true }),
    query,
  );
  if (countError) throw countError;

  const { data, error } = await applyUserFilters(
    admin
      .from("profiles")
      .select("id, email, full_name, created_at, onboarding_completed_at, deleted_at"),
    query,
  )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw error;

  const profiles = data ?? [];
  const rows = await withMemberships(profiles);

  return paginated(rows, count ?? 0, page, perPage);
}

type ProfileSlice = {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  onboarding_completed_at: string | null;
  deleted_at: string | null;
};

/**
 * Attach each user's workspace memberships.
 *
 * Two queries for the whole page (members, then the workspace names) rather
 * than one per user — an admin table that issued N+1 queries would be the
 * slowest page on the site the moment it had a few hundred customers.
 */
async function withMemberships(profiles: ProfileSlice[]): Promise<AdminUserRow[]> {
  if (profiles.length === 0) return [];

  const admin = createSupabaseAdminClient();
  const userIds = profiles.map((profile) => profile.id);

  const { data: members, error } = await admin
    .from("workspace_members")
    .select("workspace_id, user_id, role, status")
    .in("user_id", userIds);

  if (error) throw error;

  const workspaceIds = [...new Set((members ?? []).map((member) => member.workspace_id))];
  const names = new Map<string, string>();

  if (workspaceIds.length > 0) {
    const { data: workspaces, error: workspaceError } = await admin
      .from("workspaces")
      .select("id, name")
      .in("id", workspaceIds);

    if (workspaceError) throw workspaceError;

    for (const workspace of workspaces ?? []) {
      names.set(workspace.id, workspace.name);
    }
  }

  const byUser = new Map<string, AdminUserRow["workspaces"]>();
  for (const member of members ?? []) {
    if (!member.user_id) continue;
    const list = byUser.get(member.user_id) ?? [];
    list.push({
      id: member.workspace_id,
      name: names.get(member.workspace_id) ?? "Unknown workspace",
      role: member.role,
      status: member.status,
    });
    byUser.set(member.user_id, list);
  }

  return profiles.map((profile) => {
    const workspaces = byUser.get(profile.id) ?? [];

    return {
      id: profile.id,
      name: profile.full_name,
      email: profile.email,
      createdAt: profile.created_at,
      status: profile.deleted_at
        ? "deleted"
        : profile.onboarding_completed_at
          ? "active"
          : "pending_onboarding",
      onboardedAt: profile.onboarding_completed_at,
      deletedAt: profile.deleted_at,
      workspaces,
      workspaceCount: workspaces.length,
    };
  });
}
