/**
 * Platform workspace list.
 *
 * The plan shown for a workspace is the *effective* plan, computed from its
 * subscription row with the same rules as `public.workspace_plan()` in
 * 0006_billing.sql — Pro only while the subscription is payable and its period
 * has not closed. `workspaces.plan` is the last known value and is deliberately
 * not trusted for display, because a lapsed subscription must read as Free on
 * this screen exactly as it does everywhere else in the product.
 *
 * Member and LinkedIn-account counts are fetched per *page* of workspaces, not
 * per workspace, so the query count stays constant regardless of page size.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AdminWorkspaceRow } from "./types";
import { clampPage, clampPerPage, pageRange, paginated, searchClause } from "./query";
import { effectivePlan } from "@/features/billing/entitlements";

export type WorkspacePlanFilter = "all" | "free" | "pro";

export type WorkspacesQuery = {
  search?: string;
  plan?: WorkspacePlanFilter;
  page?: number;
  perPage?: number;
};

type Filterable<T> = {
  or: (clause: string) => T;
  is: (column: string, value: null) => T;
  in: (column: string, values: string[]) => T;
};

function applyWorkspaceFilters<T extends Filterable<T>>(
  query: T,
  filters: WorkspacesQuery,
  proWorkspaceIds: string[] | null,
): T {
  let result = query;

  const search = filters.search?.trim();
  if (search) {
    result = result.or(searchClause(["name", "slug"], search));
  }

  // Soft-deleted workspaces are excluded from the platform list by default;
  // they are invisible to customers and listing them would only add noise.
  result = result.is("deleted_at", null);

  if (filters.plan === "pro" && proWorkspaceIds) {
    result = result.in("id", proWorkspaceIds);
  }

  return result;
}

export async function loadWorkspaces(query: WorkspacesQuery) {
  const admin = createSupabaseAdminClient();

  const page = clampPage(query.page);
  const perPage = clampPerPage(query.perPage);
  const { from, to } = pageRange(page, perPage);

  const proWorkspaceIds = query.plan === "all" ? null : await fetchProWorkspaceIds();

  const { count, error: countError } = await applyWorkspaceFilters(
    admin.from("workspaces").select("*", { count: "exact", head: true }),
    query,
    proWorkspaceIds,
  );
  if (countError) throw countError;

  const { data, error } = await applyWorkspaceFilters(
    admin
      .from("workspaces")
      .select("id, name, slug, owner_id, plan, seats, created_at, deleted_at"),
    query,
    proWorkspaceIds,
  )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw error;

  const workspaces = data ?? [];
  const rows = await enrich(workspaces, proWorkspaceIds);

  return paginated(rows, count ?? 0, page, perPage);
}

type WorkspaceSlice = {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  plan: "free" | "pro";
  seats: number;
  created_at: string;
  deleted_at: string | null;
};

/**
 * Workspace ids whose subscription is Pro and currently in force.
 *
 * The same three conditions as `public.workspace_plan()`: plan is pro, status
 * is payable, and the period has not closed.
 */
async function fetchProWorkspaceIds(): Promise<string[]> {
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("subscriptions")
    .select("workspace_id, plan, status, current_period_end")
    .eq("plan", "pro")
    .in("status", ["active", "past_due", "pending"])
    .or(`current_period_end.is.null,current_period_end.gt.${now}`);

  if (error) throw error;

  return (data ?? [])
    .filter((row) => effectivePlan({
      plan: row.plan,
      status: row.status,
      currentPeriodEnd: row.current_period_end,
    }) === "pro")
    .map((row) => row.workspace_id);
}

async function enrich(
  workspaces: WorkspaceSlice[],
  proWorkspaceIds: string[] | null,
): Promise<AdminWorkspaceRow[]> {
  if (workspaces.length === 0) return [];

  const admin = createSupabaseAdminClient();
  const ids = workspaces.map((workspace) => workspace.id);
  const ownerIds = [...new Set(workspaces.map((workspace) => workspace.owner_id))];

  const [ownerRows, memberRows, linkedinRows, subscriptionRows] = await Promise.all([
    admin.from("profiles").select("id, email, full_name").in("id", ownerIds),
    admin.from("workspace_members").select("workspace_id, status").in("workspace_id", ids),
    admin.from("linkedin_accounts").select("workspace_id, disconnected_at").in("workspace_id", ids),
    admin
      .from("subscriptions")
      .select("workspace_id, status, current_period_end, plan")
      .in("workspace_id", ids),
  ]);

  if (ownerRows.error) throw ownerRows.error;
  if (memberRows.error) throw memberRows.error;
  if (linkedinRows.error) throw linkedinRows.error;
  if (subscriptionRows.error) throw subscriptionRows.error;

  const owners = new Map(
    (ownerRows.data ?? []).map((profile) => [
      profile.id,
      { id: profile.id, name: profile.full_name, email: profile.email },
    ]),
  );

  const members = new Map<string, number>();
  for (const row of memberRows.data ?? []) {
    if (row.status !== "active") continue;
    members.set(row.workspace_id, (members.get(row.workspace_id) ?? 0) + 1);
  }

  const accounts = new Map<string, number>();
  for (const row of linkedinRows.data ?? []) {
    // A disconnected account is gone as far as the customer is concerned.
    if (row.disconnected_at) continue;
    accounts.set(row.workspace_id, (accounts.get(row.workspace_id) ?? 0) + 1);
  }

  const subscriptions = new Map(
    (subscriptionRows.data ?? []).map((row) => [row.workspace_id, row]),
  );

  const proIds = proWorkspaceIds ?? new Set(
    [...subscriptions.values()]
      .filter(
        (row) =>
          effectivePlan({
            plan: row.plan,
            status: row.status,
            currentPeriodEnd: row.current_period_end,
          }) === "pro",
      )
      .map((row) => row.workspace_id),
  );

  const proSet = proIds instanceof Set ? proIds : new Set(proIds);

  return workspaces.map((workspace) => {
    const subscription = subscriptions.get(workspace.id);

    return {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      // Effective plan, not `workspaces.plan`: a lapsed Pro subscription must
      // read as Free here exactly as it does in the product.
      plan: proSet.has(workspace.id) ? "pro" : "free",
      subscriptionStatus: subscription?.status ?? null,
      owner: owners.get(workspace.owner_id) ?? null,
      memberCount: members.get(workspace.id) ?? 0,
      linkedinAccountCount: accounts.get(workspace.id) ?? 0,
      seats: workspace.seats,
      createdAt: workspace.created_at,
      deletedAt: workspace.deleted_at,
    };
  });
}
