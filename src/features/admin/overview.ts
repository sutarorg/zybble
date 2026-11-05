/**
 * Platform overview.
 *
 * Every figure here is a `count(*)` or a sum over real rows. There is no
 * estimate, no extrapolation and no hard-coded number: where something cannot
 * be counted — most importantly revenue, which only exists once a verified
 * subscription row exists — the field is zero with a companion count of what
 * was excluded, so an empty billing table can never be mistaken for "$0 MRR".
 *
 * Reads go through the service-role client because these counts span every
 * tenant. Callers must have passed `requirePlatformAdmin()` first.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AdminOverview } from "./types";
import { integrationHealth, linkedinCapabilityHealth } from "./integrations";
import { loadRecentActivity } from "./activity";
import { countRows } from "./query";

/**
 * The statuses that keep a Pro subscription in force.
 *
 * Mirrors `public.workspace_plan()` in 0006_billing.sql exactly. Duplicating
 * the list rather than calling the function per row keeps this to one query;
 * the migration remains the authority, and `effectivePlan()` in
 * `src/features/billing/entitlements.ts` is the application-side copy.
 */
const PRO_STATUSES = ["active", "past_due", "pending"] as const;

export async function loadOverview(): Promise<AdminOverview> {
  const admin = createSupabaseAdminClient();
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // --- users ---------------------------------------------------------------
  // `profiles` is the application's record of a registered account; it is
  // written on first session and is the table every RLS policy reads.
  const [totalUsers, deletedUsers, newUsers] = await Promise.all([
    countRows(admin, "profiles"),
    countRows(admin, "profiles", (q) => q.not("deleted_at", "is", null)),
    countRows(admin, "profiles", (q) => q.gte("created_at", weekAgo)),
  ]);

  // --- workspaces ----------------------------------------------------------
  const totalWorkspaces = await countRows(admin, "workspaces", (q) =>
    q.is("deleted_at", null),
  );

  // --- posts ---------------------------------------------------------------
  const [published, scheduled, failed, drafts] = await Promise.all([
    countRows(admin, "posts", (q) => q.eq("status", "published")),
    countRows(admin, "posts", (q) => q.eq("status", "scheduled")),
    countRows(admin, "posts", (q) => q.eq("status", "failed")),
    countRows(admin, "posts", (q) => q.eq("status", "draft")),
  ]);

  // --- billing -------------------------------------------------------------
  // One query, limited to the columns needed, rather than a count followed by
  // a second round trip to sum the same rows.
  const { data: proSubscriptions, error: subscriptionError } = await admin
    .from("subscriptions")
    .select("unit_amount_cents, currency")
    .eq("plan", "pro")
    .in("status", [...PRO_STATUSES])
    .or(`current_period_end.is.null,current_period_end.gt.${now.toISOString()}`);

  if (subscriptionError) throw subscriptionError;

  let mrrCents = 0;
  let mrrUnpriced = 0;

  for (const row of proSubscriptions ?? []) {
    // Only rows with a provider-verified amount contribute. A Pro
    // subscription whose amount we never received is counted separately
    // rather than being filled in with a guess.
    if (typeof row.unit_amount_cents === "number") {
      mrrCents += row.unit_amount_cents;
    } else {
      mrrUnpriced += 1;
    }
  }

  // --- recent activity -----------------------------------------------------
  const recentActivity = await loadRecentActivity(8);

  return {
    users: {
      total: totalUsers,
      active: totalUsers - deletedUsers,
      deleted: deletedUsers,
      newLast7Days: newUsers,
    },
    workspaces: {
      total: totalWorkspaces,
      pro: (proSubscriptions ?? []).length,
      free: Math.max(0, totalWorkspaces - (proSubscriptions ?? []).length),
    },
    posts: { published, scheduled, failed, drafts },
    billing: {
      mrrCents,
      mrrUnpriced,
      activeProSubscriptions: (proSubscriptions ?? []).length,
    },
    recentActivity,
    integrations: [...integrationHealth(), ...linkedinCapabilityHealth()],
    generatedAt: now.toISOString(),
  };
}


