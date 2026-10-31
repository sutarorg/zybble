import { inngest } from "@/inngest/client";
import { cron, event } from "@/inngest/functions/triggers";
import { syncSeats } from "@/features/billing/seats";
import { logger } from "@/lib/logger";
import { isDodoConfigured } from "@/lib/env";
import { cancelSubscription, retrieveSubscription } from "@/lib/dodo/client";
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
 * a misconfigured endpoint). This job pulls every subscription we know Dodo has
 * and re-applies it, so a missed `subscription.cancelled` cannot leave a
 * workspace with Pro access it stopped paying for.
 *
 * Retry semantics matter here, and they are not uniform:
 *
 *  - a provider outage or a database failure is *transient* — the run throws a
 *    normal error so Inngest retries it with backoff;
 *  - a subscription Dodo no longer knows about is *permanent* — it is applied
 *    locally (stop granting Pro at period end) and never retried;
 *  - a local row we cannot write is also recorded but does not abort the sweep:
 *    one bad row must not stop the other workspaces from being reconciled.
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

    let applied = 0;
    let missing = 0;
    const transientFailures: string[] = [];

    for (const row of rows) {
      const outcome = await step.run(`reconcile-${row.id}`, async () => {
        const admin = createSupabaseAdminClient();
        const now = new Date().toISOString();

        let remote: Awaited<ReturnType<typeof retrieveSubscription>>;

        try {
          remote = await retrieveSubscription(row.dodo_subscription_id as string);
        } catch (error) {
          logger.error("billing.reconcile_fetch_failed", {
            subscriptionId: row.id,
            error: error instanceof Error ? error.message : "unknown",
          });
          return { status: "transient" as const };
        }

        // Dodo no longer has this subscription. It was deleted or never
        // completed, so the local row must stop granting Pro — otherwise a
        // cancelled-and-purged customer keeps paid entitlements forever.
        if (!remote) {
          const { error } = await admin
            .from("subscriptions")
            .update({
              status: "cancelled",
              cancel_at_period_end: true,
              canceled_at: row.canceled_at ?? now,
              last_event_at: now,
              last_event_type: "reconcile_missing",
            })
            .eq("id", row.id);

          return error ? { status: "transient" as const } : { status: "missing" as const };
        }

        const { error } = await admin
          .from("subscriptions")
          .update({
            status: remote.status as SubscriptionRow["status"],
            seats: remote.quantity ?? row.seats,
            current_period_end: remote.next_billing_date ?? row.current_period_end,
            current_period_start: remote.previous_billing_date ?? row.current_period_start,
            cancel_at_period_end: remote.cancel_at_next_billing_date ?? false,
            canceled_at: remote.cancelled_at ?? row.canceled_at,
            last_event_at: now,
            last_event_type: "reconcile",
            raw: remote as never,
          })
          .eq("id", row.id);

        if (error) {
          logger.error("billing.reconcile_write_failed", {
            subscriptionId: row.id,
            error: error.message,
          });
          return { status: "transient" as const };
        }

        await admin
          .from("workspaces")
          .update({ seats: remote.quantity ?? row.seats })
          .eq("id", row.workspace_id);

        return { status: "ok" as const };
      });

      if (outcome.status === "ok") applied += 1;
      if (outcome.status === "missing") missing += 1;
      if (outcome.status === "transient") transientFailures.push(row.id);
    }

    // Retryable: a provider outage or a locked row. Inngest re-runs the whole
    // sweep; each step is memoised, so completed rows are not re-fetched.
    if (transientFailures.length > 0) {
      throw new Error(
        `${transientFailures.length} subscription(s) could not be reconciled: ${transientFailures.join(", ")}`,
      );
    }

    return { applied, missing, failures: 0 };
  },
);

/**
 * Cancel a live subscription at the provider.
 *
 * Runs when a workspace or account is being deleted. The subscription row is
 * about to be purged, so the provider must be told *before* that happens —
 * otherwise Dodo would keep invoicing a customer that no longer exists and the
 * webhook would arrive for a workspace we can no longer attribute it to.
 *
 * A missing subscription, an unconfigured provider or an already-cancelled
 * subscription is a successful no-op: the purge must not be blocked by billing.
 */
export const cancelSubscriptionOnDelete = inngest.createFunction(
  {
    id: "cancel-subscription-on-delete",
    name: "Cancel subscription before deletion",
    retries: 3,
    concurrency: { key: "event.data.workspaceId", limit: 1 },
    triggers: [event("billing/subscription.cancel")],
  },
  async ({ event, step }) => {
    const { workspaceId, reason: triggerReason } = event.data;

    const result = await step.run("cancel", async () => {
      if (!isDodoConfigured()) {
        return { cancelled: false as const, reason: "provider_unconfigured" as const };
      }

      const admin = createSupabaseAdminClient();

      const { data } = await admin
        .from("subscriptions")
        .select("id, dodo_subscription_id, status, plan")
        .eq("workspace_id", workspaceId)
        .maybeSingle();

      const row = data as Pick<
        SubscriptionRow,
        "id" | "dodo_subscription_id" | "status" | "plan"
      > | null;

      if (!row?.dodo_subscription_id || row.plan !== "pro") {
        return { cancelled: false as const, reason: "no_subscription" as const };
      }

      if (!["active", "past_due", "pending", "on_hold", "paused"].includes(row.status ?? "")) {
        return { cancelled: false as const, reason: "not_billable" as const };
      }

      try {
        await cancelSubscription({
          dodoSubscriptionId: row.dodo_subscription_id,
          immediately: true,
        });
        return { cancelled: true as const, reason: "cancelled" as const };
      } catch (error) {
        // Transient provider failures are retried; a hard failure still must not
        // stop the deletion, so the outcome is recorded and the run ends.
        logger.error("billing.cancel_on_delete_failed", {
          workspaceId,
          error: error instanceof Error ? error.message : "unknown",
        });
        return {
          cancelled: false as const,
          reason: "provider_error" as const,
          retryable: true,
        };
      }
    });

    if (result.reason === "provider_error" && "retryable" in result) {
      throw new Error("Dodo did not accept the cancellation yet.");
    }

    await step.run("audit", async () => {
      const admin = createSupabaseAdminClient();

      await admin.from("audit_logs").insert({
        workspace_id: workspaceId,
        actor_type: "system",
        actor_user_id: null,
        action: "billing.cancelled_on_delete",
        entity_type: "subscription",
        entity_id: workspaceId,
        metadata: { reason: triggerReason, outcome: result.reason } as never,
      });
    });

    return { workspaceId, trigger: triggerReason, ...result };
  },
);
