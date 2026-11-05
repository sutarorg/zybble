/**
 * Platform billing overview. READ-ONLY.
 *
 * The rule this page is built around: **monthly recurring revenue is summed
 * only from subscription rows the payment provider actually sent us.**
 *
 * `subscriptions.unit_amount_cents` is Dodo's `recurring_pre_tax_amount` —
 * the amount the provider says it will charge on the next cycle. Where that
 * value is absent, the subscription is counted in `unpriced` and excluded from
 * MRR rather than filled in from the $15 list price. Reconstructing a missing
 * amount from a marketing number would produce a figure that looks precise and
 * is invented.
 *
 * Nothing here exposes payment instruments. `billing_payments` has `brand` and
 * `last4` columns; they are never selected, so they cannot reach the browser.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { effectivePlan } from "@/features/billing/entitlements";
import type { AdminBillingSummary } from "./types";
import { countRows } from "./query";

const MAJORITY_CURRENCY = "USD";

export async function loadBilling(): Promise<AdminBillingSummary> {
  const admin = createSupabaseAdminClient();
  const now = new Date();
  const nowIso = now.toISOString();

  const [
    { data: subscriptions, error: subscriptionError },
    { data: payments, error: paymentError },
    freeWorkspaces,
    totalWorkspaces,
  ] = await Promise.all([
    // The column list must stay a single string literal: the generated types
    // infer the row shape by parsing it, and a value built at runtime (an
    // array joined with ", ") degrades the result to an error type.
    admin
      .from("subscriptions")
      .select(
        "id, workspace_id, plan, status, seats, unit_amount_cents, currency, current_period_end, cancel_at_period_end, last_event_type, last_event_at",
      ),
    admin.from("billing_payments").select("status, amount_cents"),
    countRows(admin, "workspaces", (q) => q.is("deleted_at", null).eq("plan", "free")),
    countRows(admin, "workspaces", (q) => q.is("deleted_at", null)),
  ]);

  if (subscriptionError) throw subscriptionError;
  if (paymentError) throw paymentError;

  const rows = subscriptions ?? [];
  const active = rows.filter(
    (row) =>
      effectivePlan({
        plan: row.plan,
        status: row.status,
        currentPeriodEnd: row.current_period_end,
      }) === "pro",
  );

  // --- MRR -----------------------------------------------------------------
  let mrrCents = 0;
  let unpriced = 0;
  let otherCurrency = 0;

  for (const row of active) {
    if (row.currency !== MAJORITY_CURRENCY) otherCurrency += 1;
    if (typeof row.unit_amount_cents === "number") {
      mrrCents += row.unit_amount_cents;
    } else {
      unpriced += 1;
    }
  }

  // --- status distribution -------------------------------------------------
  const statusCounts = new Map<string, number>();
  for (const row of rows) {
    statusCounts.set(row.status, (statusCounts.get(row.status) ?? 0) + 1);
  }

  // --- payments ------------------------------------------------------------
  const paymentCounts = { paid: 0, failed: 0, refunded: 0, pending: 0 };
  let collectedCents = 0;

  for (const payment of payments ?? []) {
    if (payment.status in paymentCounts) {
      paymentCounts[payment.status as keyof typeof paymentCounts] += 1;
    }
    if (payment.status === "paid") collectedCents += payment.amount_cents;
  }

  // --- the subscription list ----------------------------------------------
  const workspaceIds = [...new Set(rows.map((row) => row.workspace_id))];
  const workspaceNames = new Map<string, { name: string; ownerId: string }>();

  if (workspaceIds.length > 0) {
    const { data: workspaces, error } = await admin
      .from("workspaces")
      .select("id, name, owner_id")
      .in("id", workspaceIds);

    if (error) throw error;

    for (const workspace of workspaces ?? []) {
      workspaceNames.set(workspace.id, { name: workspace.name, ownerId: workspace.owner_id });
    }
  }

  const ownerIds = [...new Set([...workspaceNames.values()].map((entry) => entry.ownerId))];
  const ownerEmails = new Map<string, string>();

  if (ownerIds.length > 0) {
    const { data: profiles, error } = await admin
      .from("profiles")
      .select("id, email")
      .in("id", ownerIds);

    if (error) throw error;

    for (const profile of profiles ?? []) {
      ownerEmails.set(profile.id, profile.email);
    }
  }

  const subscriptionsList = [...rows]
    .sort((a, b) =>
      (b.last_event_at ?? b.current_period_end ?? "").localeCompare(
        a.last_event_at ?? a.current_period_end ?? "",
      ),
    )
    .map((row) => {
      const workspace = workspaceNames.get(row.workspace_id);

      return {
        id: row.id,
        workspaceId: row.workspace_id,
        workspaceName: workspace?.name ?? "Unknown workspace",
        ownerEmail: workspace ? (ownerEmails.get(workspace.ownerId) ?? null) : null,
        plan: row.plan,
        status: row.status,
        seats: row.seats,
        unitAmountCents: row.unit_amount_cents,
        currency: row.currency,
        currentPeriodEnd: row.current_period_end,
        cancelAtPeriodEnd: row.cancel_at_period_end,
        lastEventType: row.last_event_type,
        lastEventAt: row.last_event_at,
      };
    });

  return {
    plans: {
      free: Math.max(0, totalWorkspaces - active.length),
      pro: active.length,
      total: totalWorkspaces,
    },
    subscriptions: {
      active: active.length,
      byStatus: [...statusCounts.entries()]
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count),
      cancellingAtPeriodEnd: rows.filter((row) => row.cancel_at_period_end).length,
      // Still marked payable but past the end of a closed period — the rows
      // that will fall back to Free on the next reconcile.
      lapsed: rows.filter(
        (row) =>
          row.plan === "pro" &&
          ["active", "past_due", "pending"].includes(row.status) &&
          row.current_period_end !== null &&
          row.current_period_end <= nowIso,
      ).length,
    },
    revenue: {
      mrrCents,
      currency: MAJORITY_CURRENCY,
      counted: active.length - unpriced,
      unpriced,
      otherCurrency,
    },
    seats: {
      billable: active.reduce((total, row) => total + row.seats, 0),
    },
    payments: { ...paymentCounts, collectedCents },
    subscriptionsList,
    generatedAt: now.toISOString(),
  };
}
