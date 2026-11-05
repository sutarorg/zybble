/**
 * Platform audit trail.
 *
 * Sourced from `audit_logs`, which every privileged action in the product
 * already writes to. Metadata is redacted server-side before it leaves (see
 * `redact.ts`) because the column is free-form JSONB written by many call
 * sites and may contain provider identifiers.
 *
 * The actor's email is resolved in a second query: `audit_logs.actor_user_id`
 * references `auth.users`, which PostgREST cannot embed against, so it cannot
 * be joined in the same request. An actor with no profile (deleted account, or
 * `actor_type = 'system'`) renders as a dash rather than being dropped — the
 * event still happened and hiding it would make the trail lie.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AdminActivityRow } from "./types";
import { clampPage, clampPerPage, pageRange, paginated, searchClause } from "./query";
import { redactMetadata } from "./redact";

export type ActivityQuery = {
  search?: string;
  actorType?: "all" | "user" | "system" | "webhook";
  page?: number;
  perPage?: number;
};

type Filterable<T> = {
  or: (clause: string) => T;
  eq: (column: string, value: string) => T;
};

function applyActivityFilters<T extends Filterable<T>>(query: T, filters: ActivityQuery): T {
  let result = query;

  const search = filters.search?.trim();
  if (search) {
    result = result.or(searchClause(["action", "entity_type", "entity_id"], search));
  }

  if (filters.actorType && filters.actorType !== "all") {
    result = result.eq("actor_type", filters.actorType);
  }

  return result;
}

export async function loadActivity(filters: ActivityQuery) {
  const admin = createSupabaseAdminClient();

  const page = clampPage(filters.page);
  const perPage = clampPerPage(filters.perPage);
  const { from, to } = pageRange(page, perPage);

  const { count, error: countError } = await applyActivityFilters(
    admin.from("audit_logs").select("*", { count: "exact", head: true }),
    filters,
  );
  if (countError) throw countError;

  const { data, error } = await applyActivityFilters(
    admin
      .from("audit_logs")
      .select(
        "id, actor_type, actor_user_id, action, entity_type, entity_id, metadata, created_at, workspaces ( name )",
      ),
    filters,
  )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw error;

  const rows = await resolveActors(data ?? []);

  return paginated(rows, count ?? 0, page, perPage);
}

/** The most recent audit rows, for the overview panel. */
export async function loadRecentActivity(limit = 8): Promise<AdminActivityRow[]> {
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from("audit_logs")
    .select(
      "id, actor_type, actor_user_id, action, entity_type, entity_id, metadata, created_at, workspaces ( name )",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return resolveActors(data ?? []);
}

async function resolveActors(
  rows: Array<Record<string, unknown>>,
): Promise<AdminActivityRow[]> {
  const userIds = [
    ...new Set(
      rows
        .map((row) => row.actor_user_id as string | null)
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  const emails = new Map<string, string>();

  if (userIds.length > 0) {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .select("id, email")
      .in("id", userIds);

    if (error) throw error;

    for (const profile of data ?? []) {
      emails.set(profile.id, profile.email);
    }
  }

  return rows.map((row) => ({
    id: row.id as string,
    actorType: row.actor_type as AdminActivityRow["actorType"],
    actorEmail: row.actor_user_id
      ? (emails.get(row.actor_user_id as string) ?? null)
      : null,
    action: row.action as string,
    entityType: (row.entity_type as string | null) ?? null,
    entityId: (row.entity_id as string | null) ?? null,
    workspaceName: workspaceName(row.workspaces),
    createdAt: row.created_at as string,
    metadata: redactMetadata(row.metadata),
  }));
}

/** PostgREST returns an embedded row as an object or an array depending on the FK. */
function workspaceName(value: unknown): string | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    return (value[0] as { name?: string } | undefined)?.name ?? null;
  }
  return (value as { name?: string }).name ?? null;
}
