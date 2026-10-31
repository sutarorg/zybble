import { z } from "zod";
import { inngest } from "@/inngest/client";
import { effectivePlan } from "@/features/billing/entitlements";
import { IntegrationNotConfiguredError } from "@/lib/errors";
import { assertVerifiedWebhook, type WebhookHeaders } from "@/lib/dodo/webhooks";
import { env, isDodoConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getSqlExecutor } from "@/lib/db/sql";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PlanId, SubscriptionRow } from "@/lib/supabase/database.types";

/**
 * Dodo Payments webhook processing.
 *
 * Invariants enforced here:
 *
 *  1. **Verify before trusting.** The Standard Webhooks signature is checked
 *     against the raw body before anything is parsed or stored. A failed
 *     verification is a 401 and no row is written.
 *  2. **Idempotent by event id.** `webhook_events.event_id` is the primary key.
 *     A replayed delivery loses the INSERT (ON CONFLICT DO NOTHING) and is
 *     answered 200 without touching entitlements.
 *  3. **Atomic claim + apply.** The claim row is written before the change and
 *     *deleted again if the handler throws*, so Dodo's retry is processed
 *     instead of being swallowed by a half-applied event.
 *  4. **Snapshots, not deltas.** Every subscription event carries the full
 *     subscription, so it is applied as a whole and events older than
 *     `last_event_at` are ignored (out-of-order delivery safety).
 *  5. **Workspace identity comes from our records**, never from the browser:
 *     session metadata first, then a lookup by subscription or customer id.
 */

const dodoSubscriptionSchema = z.object({
  subscription_id: z.string(),
  product_id: z.string().optional(),
  customer: z
    .object({
      customer_id: z.string().optional(),
      email: z.string().optional(),
      name: z.string().optional(),
    })
    .partial()
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  addons: z.array(z.unknown()).optional(),
  status: z.string(),
  quantity: z.number().int().positive().optional(),
  currency: z.string().optional(),
  recurring_pre_tax_amount: z.number().optional(),
  previous_billing_date: z.string().optional(),
  next_billing_date: z.string().optional(),
  cancel_at_next_billing_date: z.boolean().optional(),
  cancelled_at: z.string().nullable().optional(),
  trial_period_days: z.number().optional(),
});

const eventSchema = z.object({
  type: z.string(),
  business_id: z.string().optional(),
  timestamp: z.string().optional(),
  data: z.record(z.string(), z.unknown()),
});

const paymentSchema = z.object({
  payment_id: z.string(),
  status: z.string().optional(),
  total_amount: z.number().optional(),
  currency: z.string().optional(),
  card_brand: z.string().nullable().optional(),
  card_last_four: z.string().nullable().optional(),
  subscription_id: z.string().nullable().optional(),
  customer: z
    .object({ customer_id: z.string().optional(), email: z.string().optional() })
    .partial()
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  created_at: z.string().optional(),
  settled_at: z.string().optional(),
  invoice_url: z.string().nullable().optional(),
});

const SUBSCRIPTION_EVENTS = new Set([
  "subscription.active",
  "subscription.cancelled",
  "subscription.expired",
  "subscription.failed",
  "subscription.on_hold",
  "subscription.past_due",
  "subscription.paused",
  "subscription.unpaused",
  "subscription.plan_changed",
  "subscription.renewed",
  "subscription.updated",
  "subscription.update_payment_method",
]);

export type ProcessResult = {
  status: "processed" | "duplicate" | "ignored";
  eventId: string;
  eventType: string;
  workspaceId: string | null;
  detail?: string;
};

export async function processDodoWebhook(input: {
  body: string;
  headers: Headers;
  now?: Date;
}): Promise<ProcessResult> {
  if (!isDodoConfigured()) {
    throw new IntegrationNotConfiguredError("Dodo Payments");
  }

  // 1. signature
  const { headers, event: rawEvent } = assertVerifiedWebhook({
    body: input.body,
    headers: input.headers,
    now: input.now,
  });

  const parsed = eventSchema.safeParse(rawEvent);

  if (!parsed.success) {
    throw new Error("Webhook payload did not match the expected envelope.");
  }

  const event = parsed.data;
  const sql = getSqlExecutor();

  // 2. claim (idempotency)
  const claim = await sql.query<{ event_id: string }>(
    `insert into public.webhook_events (event_id, provider, event_type, status, signature_verified, payload)
     values ($1, 'dodo', $2, 'received', true, $3::jsonb)
     on conflict (event_id) do nothing
     returning event_id`,
    [headers.id, event.type, input.body],
  );

  if ((claim.rowCount ?? 0) === 0) {
    logger.info("billing.webhook_duplicate", { eventId: headers.id, eventType: event.type });
    return {
      status: "duplicate",
      eventId: headers.id,
      eventType: event.type,
      workspaceId: null,
    };
  }

  try {
    // 3. resolve workspace, 4. apply
    let workspaceId: string | null = null;
    let detail = "no handler";

    if (SUBSCRIPTION_EVENTS.has(event.type)) {
      const subscription = dodoSubscriptionSchema.parse(event.data);
      workspaceId = await resolveWorkspace(subscription);

      if (!workspaceId) {
        detail = "workspace_not_resolved";
      } else {
        await applySubscriptionSnapshot({
          workspaceId,
          subscription,
          eventType: event.type,
          eventTimestamp: event.timestamp ?? null,
          webhookId: headers.id,
        });
        detail = "subscription_snapshot_applied";
      }
    } else if (event.type === "payment.succeeded" || event.type === "payment.failed") {
      const payment = paymentSchema.parse(event.data);
      workspaceId = await resolveWorkspaceFromPayment(payment);

      if (!workspaceId) {
        detail = "workspace_not_resolved";
      } else {
        await recordPayment({ workspaceId, payment, eventType: event.type });
        detail = "payment_recorded";
      }
    }

    await sql.query(
      `update public.webhook_events
       set status = $2, processed_at = now(), attempts = attempts + 1, workspace_id = $3::uuid
       where event_id = $1`,
      [headers.id, detail === "no handler" ? "ignored" : "processed", workspaceId],
    );

    return { status: detail === "no handler" ? "ignored" : "processed", eventId: headers.id, eventType: event.type, workspaceId, detail };
  } catch (error) {
    // Roll the claim back so Dodo's retry re-processes this event.
    await sql.query(`delete from public.webhook_events where event_id = $1`, [headers.id]);

    logger.error("billing.webhook_failed", {
      eventId: headers.id,
      eventType: event.type,
      error: error instanceof Error ? error.message : "unknown",
    });

    throw error;
  }
}

/**
 * Confirm the workspace still exists.
 *
 * A webhook can outlive its workspace (deleted mid-flight, or a replayed event
 * from a test mode). Applying it would violate the foreign key on
 * `webhook_events.workspace_id`, roll the claim back and make Dodo retry an
 * event that can never succeed — so an unknown workspace is reported as
 * unresolvable and acknowledged instead.
 */
async function workspaceExists(workspaceId: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("workspaces").select("id").eq("id", workspaceId).maybeSingle();
  return Boolean(data);
}

async function resolveWorkspace(subscription: z.infer<typeof dodoSubscriptionSchema>): Promise<string | null> {
  const fromMetadata = metadataWorkspaceId(subscription.metadata);
  if (fromMetadata && (await workspaceExists(fromMetadata))) return fromMetadata;

  const admin = createSupabaseAdminClient();

  const { data: bySubscription } = await admin
    .from("subscriptions")
    .select("workspace_id")
    .eq("dodo_subscription_id", subscription.subscription_id)
    .maybeSingle();

  if (bySubscription?.workspace_id) return bySubscription.workspace_id as string;

  const customerId = subscription.customer?.customer_id;

  if (customerId) {
    const { data: byCustomer } = await admin
      .from("subscriptions")
      .select("workspace_id")
      .eq("dodo_customer_id", customerId)
      .maybeSingle();

    if (byCustomer?.workspace_id) return byCustomer.workspace_id as string;
  }

  return null;
}

async function resolveWorkspaceFromPayment(
  payment: z.infer<typeof paymentSchema>,
): Promise<string | null> {
  const fromMetadata = metadataWorkspaceId(payment.metadata);
  if (fromMetadata && (await workspaceExists(fromMetadata))) return fromMetadata;

  const admin = createSupabaseAdminClient();

  if (payment.subscription_id) {
    const { data } = await admin
      .from("subscriptions")
      .select("workspace_id")
      .eq("dodo_subscription_id", payment.subscription_id)
      .maybeSingle();

    if (data?.workspace_id) return data.workspace_id as string;
  }

  const customerId = payment.customer?.customer_id;

  if (customerId) {
    const { data } = await admin
      .from("subscriptions")
      .select("workspace_id")
      .eq("dodo_customer_id", customerId)
      .maybeSingle();

    if (data?.workspace_id) return data.workspace_id as string;
  }

  return null;
}

function metadataWorkspaceId(metadata: Record<string, unknown> | undefined): string | null {
  const value = metadata?.workspace_id;
  if (typeof value !== "string") return null;
  return /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

type SubscriptionSnapshot = z.infer<typeof dodoSubscriptionSchema>;

/**
 * Apply a provider snapshot.
 *
 * Entitlement downgrades happen automatically: `effectivePlan()` treats anything
 * other than active/past_due as Free, and a lapsed `current_period_end` also
 * falls back to Free, so a cancelled or expired subscription quietly returns the
 * workspace to the Free plan on the next read.
 */
async function applySubscriptionSnapshot(input: {
  workspaceId: string;
  subscription: SubscriptionSnapshot;
  eventType: string;
  eventTimestamp: string | null;
  webhookId: string;
}): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { subscription, workspaceId, eventType, eventTimestamp } = input;

  const { data: existing } = await admin
    .from("subscriptions")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  const current = existing as SubscriptionRow | null;
  const incomingAt = eventTimestamp ? new Date(eventTimestamp).getTime() : Date.now();

  if (current?.last_event_at) {
    const knownAt = new Date(current.last_event_at).getTime();
    if (knownAt > incomingAt) {
      logger.info("billing.stale_event_ignored", {
        workspaceId,
        eventType,
        knownAt: current.last_event_at,
        incomingAt: eventTimestamp,
      });
      return;
    }
  }

  const status = mapStatus(subscription.status);
  const plan: PlanId = "pro";
  const seats = subscription.quantity ?? current?.seats ?? 1;

  const payload = {
    workspace_id: workspaceId,
    dodo_subscription_id: subscription.subscription_id,
    dodo_customer_id: subscription.customer?.customer_id ?? current?.dodo_customer_id ?? null,
    plan,
    status,
    seats,
    currency: subscription.currency ?? current?.currency ?? "USD",
    unit_amount_cents: subscription.recurring_pre_tax_amount ?? current?.unit_amount_cents ?? null,
    current_period_start: subscription.previous_billing_date ?? current?.current_period_start ?? null,
    current_period_end: subscription.next_billing_date ?? current?.current_period_end ?? null,
    cancel_at_period_end: subscription.cancel_at_next_billing_date ?? false,
    canceled_at: subscription.cancelled_at ?? null,
    last_event_at: new Date(incomingAt).toISOString(),
    last_event_type: eventType,
    raw: subscription as never,
  };

  const { error } = await admin
    .from("subscriptions")
    .upsert(payload, { onConflict: "workspace_id" });

  if (error) {
    logger.error("billing.subscription_write_failed", { workspaceId, error: error.message });
    throw new Error("Could not record the subscription update.");
  }

  const appliedPlan = effectivePlan({
    plan,
    status,
    currentPeriodEnd: payload.current_period_end,
  });

  await admin
    .from("workspaces")
    .update({ plan: appliedPlan, seats })
    .eq("id", workspaceId);

  await admin.from("audit_logs").insert({
    workspace_id: workspaceId,
    actor_type: "webhook",
    action: `billing.${eventType}`,
    entity_type: "subscription",
    entity_id: subscription.subscription_id,
    metadata: {
      status,
      seats,
      plan: appliedPlan,
      webhookId: input.webhookId,
    } as never,
  });

  await notifyLifecycleChange({ workspaceId, eventType, status, seats });
}

function mapStatus(providerStatus: string): SubscriptionRow["status"] {
  switch (providerStatus) {
    case "pending":
      return "pending";
    case "active":
      return "active";
    case "on_hold":
      return "on_hold";
    case "paused":
      return "paused";
    case "past_due":
      return "past_due";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    case "expired":
      return "expired";
    default:
      return "pending";
  }
}

async function notifyLifecycleChange(input: {
  workspaceId: string;
  eventType: string;
  status: SubscriptionRow["status"];
  seats: number;
}): Promise<void> {
  const template =
    input.eventType === "subscription.active" || input.eventType === "subscription.renewed"
      ? "subscription_confirmed"
      : input.eventType === "subscription.cancelled" || input.eventType === "subscription.expired"
        ? "subscription_cancelled"
        : input.eventType === "subscription.failed" ||
            input.eventType === "subscription.past_due" ||
            input.eventType === "subscription.on_hold"
          ? "payment_failed"
          : null;

  if (!template) return;

  const notification = {
    workspace_id: input.workspaceId,
    user_id: null,
    kind:
      template === "payment_failed"
        ? ("payment_failed" as const)
        : template === "subscription_cancelled"
          ? ("subscription_cancelled" as const)
          : ("subscription_confirmed" as const),
    title:
      template === "payment_failed"
        ? "Payment failed"
        : template === "subscription_cancelled"
          ? "Pro subscription cancelled"
          : "Zybble Pro is active",
    body:
      template === "payment_failed"
        ? "We could not take payment for Zybble Pro. Update your card to keep Pro features."
        : template === "subscription_cancelled"
          ? "Your Pro subscription has ended. The workspace is now on the Free plan."
          : `Zybble Pro is active with ${input.seats} seat${input.seats === 1 ? "" : "s"}.`,
    severity: template === "payment_failed" ? ("error" as const) : ("success" as const),
    action_url: "/settings/billing",
  };

  const admin = createSupabaseAdminClient();
  await admin.from("notifications").insert(notification);

  if (env().INNGEST_EVENT_KEY) {
    await inngest.send({
      name: "email/send",
      data: {
        template,
        workspaceId: input.workspaceId,
        payload: { seats: input.seats },
      },
    });
  }
}

async function recordPayment(input: {
  workspaceId: string;
  payment: z.infer<typeof paymentSchema>;
  eventType: "payment.succeeded" | "payment.failed";
}): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { payment, workspaceId, eventType } = input;

  const { data: subscription } = await admin
    .from("subscriptions")
    .select("id")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  const succeeded = eventType === "payment.succeeded";

  const { error } = await admin.from("billing_payments").upsert(
    {
      workspace_id: workspaceId,
      subscription_id: (subscription?.id as string | undefined) ?? null,
      dodo_payment_id: payment.payment_id,
      amount_cents: payment.total_amount ?? 0,
      currency: payment.currency ?? "USD",
      status: succeeded ? "paid" : "failed",
      brand: payment.card_brand ?? null,
      last4: payment.card_last_four ?? null,
      invoice_url: payment.invoice_url ?? null,
      issued_at: payment.settled_at ?? payment.created_at ?? new Date().toISOString(),
    },
    { onConflict: "dodo_payment_id" },
  );

  if (error) {
    logger.error("billing.payment_write_failed", { error: error.message });
    throw new Error("Could not record the payment.");
  }

  if (!succeeded) {
    await admin.from("notifications").insert({
      workspace_id: workspaceId,
      user_id: null,
      kind: "payment_failed",
      title: "Payment failed",
      body: "We could not collect payment for Zybble Pro. Update your payment method to avoid losing Pro features.",
      severity: "error",
      action_url: "/settings/billing",
    });
  }
}

export type { WebhookHeaders };
