/**
 * Pagination and counting helpers shared by the admin services.
 *
 * Every admin list is paginated against the database, not in memory: the
 * whole point of these tables is that they hold *all* customers, so a query
 * that fetched every row to slice it in Node would grow without bound.
 *
 * Counts use PostgREST's `count: "exact", head: true`, which asks Postgres for
 * `count(*)` and returns no rows — the page size therefore never affects how
 * much data crosses the wire.
 */

import type { AdminSupabase } from "@/lib/supabase/admin";
import type { Paginated } from "./types";

export const DEFAULT_PER_PAGE = 25;
export const MAX_PER_PAGE = 100;

export function clampPerPage(value: number | undefined): number {
  if (!value || Number.isNaN(value)) return DEFAULT_PER_PAGE;
  return Math.min(Math.max(Math.floor(value), 1), MAX_PER_PAGE);
}

export function clampPage(value: number | undefined): number {
  if (!value || Number.isNaN(value)) return 1;
  return Math.max(Math.floor(value), 1);
}

/** Database range for a 1-based page. */
export function pageRange(page: number, perPage: number): { from: number; to: number } {
  return { from: (page - 1) * perPage, to: page * perPage - 1 };
}

export function paginated<T>(
  rows: T[],
  total: number,
  page: number,
  perPage: number,
): Paginated<T> {
  return {
    rows,
    page,
    perPage,
    total,
    pageCount: Math.max(1, Math.ceil(total / perPage)),
  };
}

/** Exact row count for a table, optionally filtered. */
export async function countRows(
  admin: AdminSupabase,
  table: "profiles" | "workspaces" | "posts" | "subscriptions" | "audit_logs" | "webhook_events" | "post_publish_attempts" | "billing_payments",
  apply?: (query: ReturnType<AdminSupabase["from"]>) => void,
): Promise<number> {
  let query = admin.from(table).select("*", { count: "exact", head: true });
  apply?.(query);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

/**
 * Build a `?q=` filter for a text search across named columns.
 *
 * PostgREST `or` syntax needs values escaped for commas and parentheses, both
 * of which are structural. A search string is user input, so it is escaped
 * rather than trusted.
 */
export function searchClause(columns: readonly string[], raw: string): string {
  const term = raw.replace(/[,()]/g, " ").trim();
  if (!term) return "";
  return columns.map((column) => `${column}.ilike.%${term}%`).join(",");
}
