import { NonRetriableError } from "inngest";
import { inngest } from "@/inngest/client";
import { cron, event } from "@/inngest/functions/triggers";
import { syncSeats } from "@/features/billing/seats";
import { logger } from "@/lib/logger";
import { isDodoConfigured } from "@/lib/env";
import { retrieveSubscription } from "@/lib/dodo/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SubscriptionRow } from "@/lib/supabase/database.types";

/**
 * Seat sync.
 *
 * Membership changes enqueue this job instead of calling Dodo inline, so a
 * provider outage never blocks inviting or removing a teammate. The job
 * recomputes the count from the members table (never from a client claim) and is
 * a no-op when the number has not changed, which makes it safe to replay.
 */
export const syncWorkspaceSeats = inngest.createFunction(
  {
    id: "sync-workspace-seats",
    name: "Sync billing seats",
    retries: 4,
    concurrency: { key: "event.data.workspaceId", limit: 1 },
    triggers: [event("billing/seats.sync")],
  },
  async ({ event, step }) => {
    const { workspaceId, actorUserId } = event.data;

    const result = await step.run("sync", () => syncSeats({ workspaceId, actorUserId }));

    logger.info("billing.seats_sync", result);

    if (result.reason === "provider_unavailable") {
      // Not a transient outage — the key is simply missing. Retrying cannot fix
      // it, and the local seat count is already correct, so stop here.
      logger.warn("billing.seats_not_configured", { workspaceId });
    }

    return result;
  },
);

/**
 * Subscription reconciliation.
 *
 * Webhooks are the primary source of truth, but deliveries fail (DNS, downtime,
 * a misconfigured endpoint). This job pulls the current subscription from Dodo
 * and re-applies it, so a missed `subscription.cancelled` cannot leave a
 * workspace with Pro access it stopped paying for.
 */
export const reconcileSubscriptions = inngest.createFunction(
  {
    id: "reconcile-subscriptions",
    name: "Reconcile subscriptions with Dodo",
    retries: 2,
    triggers: [event("billing/reconcile"), cron("17 4 * * *")],
  },
  async ({ step }) => {
    if (!isDodoConfigured()) {
      logger.warn("billing.reconcile_skipped", { reason: "dodo_not_configured" });
      return { skipped: "dodo_not_configured" as const };
    }

    const rows = await step.run("list-subscriptions", async () => {
      const admin = createSupabaseAdminClient();
      const { data } = await admin
        .from("subscriptions")
        .select("*")
        .not("dodo_subscription_id", "is", null);

      return (data ?? []) as SubscriptionRow[];
    });

    let reconciled = 0;
    let failures = 0;

    for (const row of rows) {
      const outcome = await step.run(`reconcile-${row.id}`, async () => {
        try {
          const remote = await retrieveSubscription(row.dodo_subscription_id as string);

          if (!remote) return "missing" as const;

          const admin = createSupabaseAdminClient();

          const { error } = await admin
            .from("subscriptions")
            .update({
              status: remote.status,
              seats: remote.quantity ?? row.seats,
              current_period_end: remote.next_billing_date ?? row.current_period_end,
              current_period_start: remote.previous_billing_date ?? row.current_period_start,
              cancel_at_period_end: remote.cancel_at_next_billing_date ?? false,
              canceled_at: remote.cancelled_at ?? row.canceled_at,
              last_event_at: new Date().toISOString(),
              last_event_type: "reconcile",
              raw: remote as never,
            })
            .eq("id", row.id);

          if (error) return "error" as const;

          await admin
            .from("workspaces")
            .update({ seats: remote.quantity ?? row.seats })
            .eq("id", row.workspace_id);

          return "ok" as const;
        } catch (error) {
          logger.error("billing.reconcile_failed", {
            subscriptionId: row.id,
            error: error instanceof Error ? error.message : "unknown",
          });
          return "error" as const;
        }
      });

      if (outcome === "ok" || outcome === "missing") reconciled += 1;
      if (outcome === "error") failures += 1;
    }

    if (failures > 0) {
      throw new NonRetriableError(`${failures} subscription(s) could not be reconciled.`);
    }

    return { reconciled, failures };
  },
);
