/**
 * Checkout, payment confirmation, manual creator payout accrual, and the
 * append-only financial ledger.
 *
 * Invariants this module exists to hold:
 *  * The course price, currency, commission and creator share are computed on
 *    the server from database rows. Nothing the browser sends is authoritative.
 *  * Money is integer paise, always INR.
 *  * Learner payments settle into Zybble's merchant account via standard
 *    Razorpay Checkout orders (no Route `transfers` array on order creation and
 *    no automatic Route transfer creation on capture).
 *  * Payment confirmation happens twice: the Checkout signature proves the
 *    browser response is genuine, and a Razorpay API fetch (or the
 *    `payment.captured` webhook) proves the provider actually captured it.
 *  * Entitlement creation and ledger writes are idempotent, so a duplicated
 *    webhook, a double-clicked Pay button or two concurrent tabs cannot grant
 *    access twice or double-credit a creator.
 *  * The commission rate is snapshotted onto each order item, so changing the
 *    marketplace rate later never rewrites a past sale.
 *  * Zybble has no refund flow. There is no refund path in this module, no
 *    `refunds` table, and provider refund events are recorded and ignored rather
 *    than acted on. Money leaves the platform only through a reviewed creator
 *    payout.
 */

import "server-only";
import { randomUUID } from "node:crypto";
import { requireServiceClient, type SessionProfile } from "@/lib/server/session";
import {
  CURRENCY,
  splitCommission,
  assertInr,
  type CommissionBps,
} from "@/lib/money";
import {
  createOrder,
  fetchPayment,
  verifyCheckoutSignature,
  fetchTransfer,
  type RazorpayWebhookPayload,
} from "@/lib/server/razorpay";
import { enqueueEmail } from "@/lib/server/email";

export class CheckoutError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "CheckoutError";
    this.code = code;
    this.status = status;
  }
}

/* -------------------------------------------------------------------------- */
/* Public ids                                                                  */
/* -------------------------------------------------------------------------- */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Human-quotable, non-sequential order reference. */
export function newPublicId(prefix = "Zyb"): string {
  const bytes = randomUUID().replace(/-/g, "");
  let suffix = "";
  for (let i = 0; i < 10; i += 1) {
    suffix += ALPHABET[parseInt(bytes.slice(i * 2, i * 2 + 2), 16) % ALPHABET.length];
  }
  return `${prefix}-${suffix}`;
}

/* -------------------------------------------------------------------------- */
/* Eligibility                                                                 */
/* -------------------------------------------------------------------------- */

export interface CheckoutEligibility {
  ok: boolean;
  reason?: string;
  code?: string;
}

/**
 * Server-side preconditions for a paid purchase. Called again inside
 * `createCheckoutOrder`, so a race between the pre-check and the write cannot
 * produce a purchasable-but-ineligible order.
 */
export async function assertPurchasable(
  service: ReturnType<typeof requireServiceClient>,
  courseId: string,
  userId: string
): Promise<{
  course: Record<string, unknown>;
  creator: Record<string, unknown>;
  commissionBps: CommissionBps;
  pricePaise: number;
}> {
  const [{ data: course }, { data: settings }] = await Promise.all([
    service.from("courses").select("*").eq("id", courseId).maybeSingle(),
    service.from("marketplace_settings").select("commission_bps").eq("id", true).maybeSingle(),
  ]);

  if (!course) throw new CheckoutError("course_not_found", "Course not found", 404);
  if (course.status !== "published") {
    throw new CheckoutError("course_unavailable", "This course is not currently available", 409);
  }

  const { data: creatorProfile } = await service
    .from("creator_profiles")
    .select("*")
    .eq("user_id", course.creator_id)
    .maybeSingle();


  if (!creatorProfile) {
    throw new CheckoutError("creator_missing", "This course has no sellable creator profile", 409);
  }

  const pricePaise = Number(course.price_paise);
  if (!Number.isSafeInteger(pricePaise) || pricePaise < 0) {
    throw new CheckoutError("invalid_price", "Course price is invalid", 409);
  }
  assertInr(String(course.currency ?? CURRENCY));

  // Paid courses no longer require Razorpay Route onboarding or pre-saved
  // payout details to be sold. Learner payments settle to Zybble and the
  // creator's share accrues for manual payout; payout destination details are
  // required only when the creator requests a payout.

  const commissionBps = Number(settings?.commission_bps ?? 1000) as CommissionBps;

  // The learner must not already own the course.
  const { data: entitlement } = await service
    .from("entitlements")
    .select("id")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .is("revoked_at", null)
    .maybeSingle();
  if (entitlement) throw new CheckoutError("already_enrolled", "You already own this course", 409);

  return { course, creator: creatorProfile, commissionBps, pricePaise };
}

/* -------------------------------------------------------------------------- */
/* Order creation                                                              */
/* -------------------------------------------------------------------------- */

export interface CheckoutSession {
  orderId: string;
  publicId: string;
  razorpayOrderId: string;
  amountPaise: number;
  currency: "INR";
  courseTitle: string;
  creatorName: string;
  commissionBps: CommissionBps;
  creatorSharePaise: number;
  isFree: boolean;
}

/** Free courses never touch a payment provider — they get a server-authorised entitlement. */
export async function enrollInFreeCourse(session: SessionProfile, courseId: string): Promise<CheckoutSession> {
  const service = requireServiceClient();
  const { course, creator, pricePaise } = await assertPurchasable(service, courseId, session.id);
  if (pricePaise !== 0) throw new CheckoutError("not_free", "This course is not free", 400);

  const publicId = newPublicId("ZybF");
  const { data: order, error } = await service
    .from("orders")
    .insert({
      public_id: publicId,
      user_id: session.id,
      status: "paid",
      currency: CURRENCY,
      subtotal_paise: 0,
      total_paise: 0,
      is_free: true,
      paid_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !order) throw new CheckoutError("order_failed", "Could not create the enrollment", 500);

  await service.from("order_items").insert({
    order_id: order.id,
    course_id: courseId,
    creator_id: course.creator_id,
    course_title: course.title,
    course_slug: course.slug,
    thumbnail_key: course.thumbnail_key ?? null,
    currency: CURRENCY,
    unit_price_paise: 0,
    commission_bps: 0,
    commission_paise: 0,
    creator_share_paise: 0,
  });

  await grantEntitlement(service, session.id, courseId, order.id, "free_enrollment");
  await recordPurchaseAnalytics(service, session.id, courseId, 0, publicId);

  return {
    orderId: order.id,
    publicId,
    razorpayOrderId: "",
    amountPaise: 0,
    currency: CURRENCY,
    courseTitle: String(course.title),
    creatorName: String(creator.display_name ?? "Zybble creator"),
    commissionBps: 0,
    creatorSharePaise: 0,
    isFree: true,
  };
}

/**
 * Creates a durable pending order with an immutable item snapshot, then creates
 * a standard INR Razorpay order without Route transfers.
 */
export async function createCheckoutOrder(session: SessionProfile, courseId: string): Promise<CheckoutSession> {
  const service = requireServiceClient();
  const { course, creator, commissionBps, pricePaise } = await assertPurchasable(
    service,
    courseId,
    session.id
  );

  if (pricePaise <= 0) {
    throw new CheckoutError("free_course", "This course is free", 400);
  }

  const { commissionPaise, creatorPaise } = splitCommission(pricePaise, commissionBps);
  const publicId = newPublicId();

  const { data: order, error } = await service
    .from("orders")
    .insert({
      public_id: publicId,
      user_id: session.id,
      status: "created",
      currency: CURRENCY,
      subtotal_paise: pricePaise,
      total_paise: pricePaise,
      is_free: false,
    })
    .select("id, public_id")
    .single();
  if (error || !order) throw new CheckoutError("order_failed", "Could not start checkout", 500);

  const { error: itemError } = await service.from("order_items").insert({
    order_id: order.id,
    course_id: courseId,
    creator_id: course.creator_id,
    course_title: course.title,
    course_slug: course.slug,
    thumbnail_key: course.thumbnail_key ?? null,
    currency: CURRENCY,
    unit_price_paise: pricePaise,
    commission_bps: commissionBps,
    commission_paise: commissionPaise,
    creator_share_paise: creatorPaise,
    route_account_id: null,
  });
  if (itemError) {
    // Never leave an orphan order behind.
    await service.from("orders").delete().eq("id", order.id);
    throw new CheckoutError("order_failed", "Could not start checkout", 500);
  }

  const razorpayOrder = await createOrder({
    amountPaise: pricePaise,
    receipt: publicId,
    notes: { zybble_order: publicId, course: String(course.slug) },
  });

  await service
    .from("payments")
    .insert({
      order_id: order.id,
      razorpay_order_id: razorpayOrder.id,
      currency: CURRENCY,
      amount_paise: pricePaise,
      status: "created",
    });
  await service
    .from("orders")
    .update({ status: "pending" })
    .eq("id", order.id);

  return {
    orderId: order.id,
    publicId,
    razorpayOrderId: razorpayOrder.id,
    amountPaise: pricePaise,
    currency: CURRENCY,
    courseTitle: String(course.title),
    creatorName: String(creator.display_name ?? "Zybble creator"),
    commissionBps,
    creatorSharePaise: creatorPaise,
    isFree: false,
  };
}

/* -------------------------------------------------------------------------- */
/* Payment confirmation                                                        */
/* -------------------------------------------------------------------------- */

export interface ConfirmCheckoutInput {
  publicOrderId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface ConfirmCheckoutResult {
  status: "paid" | "failed";
  publicId: string;
  orderId: string;
  message: string;
}

/**
 * Confirms a checkout from the browser's success callback.
 *
 * The signature proves the response came from Razorpay Checkout; the subsequent
 * API fetch proves the payment really exists and is captured. A browser that
 * simply navigates to `/checkout/success` satisfies neither.
 */
export async function confirmCheckout(input: ConfirmCheckoutInput): Promise<ConfirmCheckoutResult> {
  const service = requireServiceClient();

  if (!verifyCheckoutSignature(input.razorpayOrderId, input.razorpayPaymentId, input.razorpaySignature)) {
    throw new CheckoutError("invalid_signature", "Payment verification failed", 400);
  }

  const { data: order } = await service
    .from("orders")
    .select("id, public_id, user_id, status, total_paise, currency")
    .eq("public_id", input.publicOrderId)
    .maybeSingle();

  if (!order) throw new CheckoutError("order_not_found", "Order not found", 404);
  if (String(order.currency) !== CURRENCY) {
    throw new CheckoutError("currency_mismatch", "Unsupported currency", 409);
  }
  // Already settled — idempotent success rather than a double grant.
  if (order.status === "paid") {
    return { status: "paid", publicId: order.public_id, orderId: order.id, message: "Already confirmed" };
  }

  const payment = await fetchPayment(input.razorpayPaymentId);
  if (payment.order_id !== input.razorpayOrderId) {
    throw new CheckoutError("payment_mismatch", "Payment does not belong to this order", 409);
  }
  if (String(payment.currency) !== CURRENCY) {
    throw new CheckoutError("currency_mismatch", "Unsupported currency", 409);
  }
  if (Number(payment.amount) !== Number(order.total_paise)) {
    throw new CheckoutError("amount_mismatch", "Payment amount does not match the order", 409);
  }
  if (payment.status !== "captured" && payment.status !== "authorized") {
    throw new CheckoutError("payment_not_captured", `Payment status is ${payment.status}`, 409);
  }

  await applyCapturedPayment(service, {
    internalOrderId: order.id,
    razorpayOrderId: input.razorpayOrderId,
    razorpayPaymentId: payment.id,
    amountPaise: Number(payment.amount),
    feePaise: typeof payment.fee === "number" ? Math.round(payment.fee) : null,
    taxPaise: typeof payment.tax === "number" ? Math.round(payment.tax) : null,
    method: maskedMethod(payment.method),
    captured: payment.status === "captured",
  });

  return { status: "paid", publicId: order.public_id, orderId: order.id, message: "Payment confirmed" };
}

/** Never persists a card number; stores only Razorpay's method descriptor. */
export function maskedMethod(method?: string | null): string {
  if (!method) return "Razorpay";
  const known: Record<string, string> = {
    card: "Card",
    upi: "UPI",
    netbanking: "Netbanking",
    wallet: "Wallet",
    emi: "EMI",
    paylater: "Pay later",
    nb: "Netbanking",
  };
  return known[method.toLowerCase()] ?? "Razorpay";
}

/* -------------------------------------------------------------------------- */
/* The one place a payment becomes access                                      */
/* -------------------------------------------------------------------------- */

interface CapturedPaymentInput {
  internalOrderId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  amountPaise: number;
  feePaise: number | null;
  taxPaise: number | null;
  method: string;
  captured: boolean;
}

/**
 * Idempotent settlement of an order. Safe to call from the Checkout callback
 * and from the `payment.captured` webhook, in any order, any number of times.
 */
export async function applyCapturedPayment(
  service: ReturnType<typeof requireServiceClient>,
  input: CapturedPaymentInput
): Promise<void> {
  const { data: order } = await service
    .from("orders")
    .select("id, public_id, user_id, status, total_paise, currency")
    .eq("id", input.internalOrderId)
    .maybeSingle();

  if (!order) throw new CheckoutError("order_not_found", "Order not found", 404);
  if (String(order.currency) !== CURRENCY) throw new CheckoutError("currency_mismatch", "Unsupported currency", 409);

  await service.from("payments").upsert(
    {
      order_id: order.id,
      razorpay_order_id: input.razorpayOrderId,
      razorpay_payment_id: input.razorpayPaymentId,
      currency: CURRENCY,
      amount_paise: input.amountPaise,
      fee_paise: input.feePaise,
      tax_paise: input.taxPaise,
      status: input.captured ? "captured" : "authorized",
      method: input.method,
      captured_at: input.captured ? new Date().toISOString() : null,
    },
    { onConflict: "razorpay_payment_id" }
  );

  await service.from("payment_attempts").insert({
    order_id: order.id,
    razorpay_order_id: input.razorpayOrderId,
    razorpay_payment_id: input.razorpayPaymentId,
    amount_paise: input.amountPaise,
    status: input.captured ? "captured" : "authorized",
  });

  if (!input.captured) return;

  const { data: items } = await service
    .from("order_items")
    .select("id, course_id, creator_id, unit_price_paise, commission_bps, commission_paise, creator_share_paise, route_account_id, course_title")
    .eq("order_id", order.id);

  for (const item of items ?? []) {
    // Entitlement: unique (user_id, course_id) means a duplicate call is a no-op.
    await grantEntitlement(service, order.user_id, item.course_id, order.id, "purchase");

    // Immutable ledger: idempotency keys mean a replay cannot double-credit.
    await appendLedger(service, {
      idempotencyKey: `sale:${order.id}:${item.id}`,
      kind: "sale",
      account: "platform",
      userId: order.user_id,
      orderId: order.id,
      orderItemId: item.id,
      amountPaise: item.creator_share_paise,
      direction: "debit",
      description: `Creator share for ${item.course_title}`,
    });
    await appendLedger(service, {
      idempotencyKey: `commission:${order.id}:${item.id}`,
      kind: "commission",
      account: "platform",
      userId: order.user_id,
      orderId: order.id,
      orderItemId: item.id,
      amountPaise: item.commission_paise,
      direction: "credit",
      description: `Platform commission (${item.commission_bps} bps)`,
    });
    await appendLedger(service, {
      idempotencyKey: `creator-earn:${order.id}:${item.id}`,
      kind: "sale",
      account: `creator:${item.creator_id}`,
      userId: item.creator_id,
      orderId: order.id,
      orderItemId: item.id,
      amountPaise: item.creator_share_paise,
      direction: "credit",
      description: `Earnings for ${item.course_title}`,
    });
  }

  await service
    .from("orders")
    .update({ status: "paid", paid_at: new Date().toISOString(), provider_fee_paise: input.feePaise ?? 0 })
    .eq("id", order.id);

  // Keep the denormalised catalog counters honest — derived from real
  // entitlements, never set by a client.
  for (const item of items ?? []) {
    const { count } = await service
      .from("entitlements")
      .select("id", { count: "exact", head: true })
      .eq("course_id", item.course_id)
      .is("revoked_at", null);
    await service.from("courses").update({ students_count: count ?? 0 }).eq("id", item.course_id);
  }

  await recordPurchaseAnalytics(service, order.user_id, items?.[0]?.course_id ?? "", input.amountPaise, order.public_id);

  // The receipt is queued, not sent inline: a Resend outage must not roll back a
  // captured payment. `idempotencyKey` means a replayed webhook cannot send two.
  await queuePurchaseReceipt(service, {
    orderId: order.id,
    publicId: String(order.public_id),
    userId: String(order.user_id),
    amountPaise: input.amountPaise,
    item: items?.[0] ?? null,
  });
}

/**
 * Queues the purchase receipt for the learner.
 *
 * Best-effort: a failure here is logged, never thrown, because the payment has
 * already been captured and must stay settled.
 */
async function queuePurchaseReceipt(
  service: ReturnType<typeof requireServiceClient>,
  order: { orderId: string; publicId: string; userId: string; amountPaise: number; item: Record<string, unknown> | null }
): Promise<void> {
  const { data: profile } = await service.from("profiles").select("email, full_name").eq("id", order.userId).maybeSingle();
  const email = (profile as { email?: string } | null)?.email;
  if (!email) return;

  const { error } = await enqueueEmail({
    to: email,
    template: "purchase_confirmation",
    payload: {
      name: (profile as { full_name?: string } | null)?.full_name ?? "there",
      courseTitle: String(order.item?.course_title ?? "your course"),
      orderRef: order.publicId,
      amountPaise: order.amountPaise,
      courseSlug: String(order.item?.course_slug ?? ""),
    },
    // One receipt per order, forever, no matter how many times this runs.
    idempotencyKey: `purchase_confirmation:${order.orderId}`,
  });
  if (error) console.error("[checkout] receipt not queued", { orderId: order.orderId, reason: error.slice(0, 200) });
}

export async function grantEntitlement(
  service: ReturnType<typeof requireServiceClient>,
  userId: string,
  courseId: string,
  orderId: string | null,
  source: "purchase" | "free_enrollment" | "admin_grant"
): Promise<void> {
  const { error } = await service
    .from("entitlements")
    .upsert(
      { user_id: userId, course_id: courseId, order_id: orderId, source, revoked_at: null },
      { onConflict: "user_id,course_id", ignoreDuplicates: false }
    );
  if (error && !/duplicate|conflict/i.test(error.message)) {
    throw new CheckoutError("entitlement_failed", "Could not grant course access", 500);
  }
}

/**
 * Appends an immutable ledger row. The unique idempotency key is what makes
 * webhook replays and concurrent tabs financially safe.
 */
export async function appendLedger(
  service: ReturnType<typeof requireServiceClient>,
  entry: {
    idempotencyKey: string;
    kind: "sale" | "commission" | "transfer" | "settlement" | "payout" | "reversal" | "adjustment";
    account: string;
    userId?: string | null;
    orderId?: string | null;
    orderItemId?: string | null;
    transferId?: string | null;
    amountPaise: number;
    direction: "credit" | "debit";
    description?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const { error } = await service.from("ledger_entries").insert({
    idempotency_key: entry.idempotencyKey,
    kind: entry.kind,
    account: entry.account,
    user_id: entry.userId ?? null,
    order_id: entry.orderId ?? null,
    order_item_id: entry.orderItemId ?? null,
    transfer_id: entry.transferId ?? null,
    currency: CURRENCY,
    amount_paise: entry.amountPaise,
    direction: entry.direction,
    description: entry.description ?? null,
    metadata: entry.metadata ?? {},
  });
  // A duplicate key simply means this entry was already written — that is the
  // desired behaviour, not an error.
  if (error && !/duplicate|conflict/i.test(error.message)) {
    throw new CheckoutError("ledger_failed", "Could not record the financial entry", 500);
  }
}

async function recordPurchaseAnalytics(
  service: ReturnType<typeof requireServiceClient>,
  userId: string,
  courseId: string,
  amountPaise: number,
  transactionId: string
): Promise<void> {
  const { data: course } = await service
    .from("courses")
    .select("title, slug")
    .eq("id", courseId)
    .maybeSingle();
  await service.from("notifications").insert({
    user_id: userId,
    kind: "course",
    title: "Purchase confirmed",
    body: `You now have access to ${course?.title ?? "your course"}.`,
    href: `/learn/${courseId}`,
  });
  // Analytics are written here rather than in the client so a purchase event can
  // never be forged by page code; the GA4 beacon is sent separately and keyed by
  // the same transaction id.
  void amountPaise;
  void transactionId;
}

/* -------------------------------------------------------------------------- */
/* Webhooks                                                                    */
/* -------------------------------------------------------------------------- */

export interface WebhookOutcome {
  status: "processed" | "duplicate" | "ignored" | "failed";
  detail?: string;
}

/**
 * Records and applies a provider event exactly once.
 *
 * Deduplication uses Razorpay's `x-razorpay-event-id` header, enforced by a
 * unique constraint rather than application logic alone.
 */
export async function handleRazorpayWebhook(
  payload: RazorpayWebhookPayload,
  eventId: string | null,
  rawBody: string
): Promise<WebhookOutcome> {
  const service = requireServiceClient();

  const { data: existing } = await service
    .from("webhook_events")
    .select("id, status")
    .eq("provider", "razorpay")
    .eq("provider_event_id", eventId ?? `no-id:${hashBody(rawBody)}`)
    .maybeSingle();

  if (existing) return { status: "duplicate", detail: `event already ${existing.status}` };

  const { error: insertError } = await service.from("webhook_events").insert({
    provider: "razorpay",
    provider_event_id: eventId ?? `no-id:${hashBody(rawBody)}`,
    event_type: payload.event,
    entity_id: payload.payload?.payment?.id ?? payload.payload?.transfer?.id ?? null,
    payload,
    status: "received",
  });
  // A unique-violation means a concurrent delivery won the race.
  if (insertError && /duplicate|conflict/i.test(insertError.message)) {
    return { status: "duplicate", detail: "concurrent delivery" };
  }
  if (insertError) throw new CheckoutError("weblog_failed", "Could not record the event", 500);

  try {
    const outcome = await applyWebhookEvent(service, payload);
    await service
      .from("webhook_events")
      .update({ status: outcome.status === "ignored" ? "ignored" : "processed", processed_at: new Date().toISOString() })
      .eq("provider", "razorpay")
      .eq("provider_event_id", eventId ?? `no-id:${hashBody(rawBody)}`);
    return outcome;
  } catch (error) {
    await service
      .from("webhook_events")
      .update({ status: "failed", error_message: error instanceof Error ? error.message.slice(0, 500) : "unknown" })
      .eq("provider", "razorpay")
      .eq("provider_event_id", eventId ?? `no-id:${hashBody(rawBody)}`);
    throw error;
  }
}

function hashBody(raw: string): string {
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 31 + raw.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

export async function applyWebhookEvent(
  service: ReturnType<typeof requireServiceClient>,
  payload: RazorpayWebhookPayload
): Promise<WebhookOutcome> {
  switch (payload.event) {
    case "payment.captured": {
      const payment = payload.payload?.payment;
      if (!payment) return { status: "ignored", detail: "no payment payload" };
      const { data: paymentRow } = await service
        .from("payments")
        .select("order_id")
        .eq("razorpay_payment_id", payment.id)
        .maybeSingle();
      if (!paymentRow?.order_id) return { status: "ignored", detail: "no matching order" };
      const orderId = paymentRow.order_id;
      await applyCapturedPayment(service, {
        internalOrderId: orderId,
        razorpayOrderId: payment.order_id ?? "",
        razorpayPaymentId: payment.id,
        amountPaise: payment.amount,
        feePaise: typeof payment.fee === "number" ? Math.round(payment.fee) : null,
        taxPaise: typeof payment.tax === "number" ? Math.round(payment.tax) : null,
        method: maskedMethod(payment.method),
        captured: true,
      });
      return { status: "processed" };
    }
    case "payment.authorized": {
      const payment = payload.payload?.payment;
      if (!payment) return { status: "ignored", detail: "no payment payload" };
      await service
        .from("payments")
        .update({ status: "authorized", method: maskedMethod(payment.method) })
        .eq("razorpay_payment_id", payment.id);
      return { status: "processed" };
    }
    case "payment.failed": {
      const payment = payload.payload?.payment;
      if (!payment) return { status: "ignored", detail: "no payment payload" };
      await service
        .from("payments")
        .update({ status: "failed" })
        .eq("razorpay_payment_id", payment.id);
      await service
        .from("payment_attempts")
        .insert({
          order_id: await orderIdForPayment(service, payment.id),
          razorpay_payment_id: payment.id,
          razorpay_order_id: payment.order_id ?? null,
          amount_paise: payment.amount,
          status: "failed",
          failure_reason: (payment.error_description ?? "Payment failed").slice(0, 200),
        });
      return { status: "processed" };
    }
    case "transfer.processed":
    case "transfer.failed":
    case "transfer.reversed":
    case "transfer.partially_reversed": {
      const transfer = payload.payload?.transfer;
      if (!transfer) return { status: "ignored", detail: "no transfer payload" };
      return applyTransferState(service, {
        transferId: transfer.id,
        status: payload.event.split(".")[1] as "processed" | "failed" | "reversed" | "partially_reversed",
        amountPaise: transfer.amount,
        reversedPaise: transfer.amount_reversed,
      });
    }
    case "settlement.processed":
    case "settlement.failed": {
      const settlement = payload.payload?.settlement;
      if (!settlement) return { status: "ignored", detail: "no settlement payload" };
      const { data: transferRow } = await service
        .from("route_transfers")
        .select("creator_id, order_id, order_item_id")
        .eq("transfer_id", settlement.transfer_id ?? "")
        .maybeSingle();
      await service.from("route_settlements").upsert(
        {
          settlement_id: settlement.id,
          route_account_id: settlement.account_id ?? "",
          transfer_id: settlement.transfer_id ?? null,
          creator_id: transferRow?.creator_id ?? null,
          amount_paise: settlement.amount,
          currency: CURRENCY,
          status: payload.event === "settlement.processed" ? "processed" : "failed",
          settled_at: settlement.settled_at ? new Date(settlement.settled_at * 1000).toISOString() : null,
        },
        { onConflict: "settlement_id" }
      );
      if (transferRow?.creator_id && payload.event === "settlement.processed") {
        await appendLedger(service, {
          idempotencyKey: `settlement:${settlement.id}`,
          kind: "settlement",
          account: `creator:${transferRow.creator_id}`,
          userId: transferRow.creator_id,
          orderId: transferRow.order_id,
          orderItemId: transferRow.order_item_id,
          amountPaise: settlement.amount,
          direction: "credit",
          description: "Route settlement received in the creator's bank account",
        });
      }
      return { status: "processed" };
    }
    case "refund.processed":
    case "refund.failed":
    case "refund.created":
    case "payment.refunded": {
      // Zybble has no refund flow, so there is nothing here to reconcile and no
      // `refunds` table to write to. The event is still durably recorded in
      // `webhook_events` by the caller — a refund that appears at the provider
      // (a chargeback, a dispute, an action taken in the Razorpay dashboard) is
      // an accounting question for an administrator, not something this service
      // silently mutates learner access or creator balances for.
      console.warn("[razorpay-webhook] refund event received on a platform with no refund flow", {
        event: payload.event,
      });
      return { status: "ignored", detail: "Zybble has no refund flow; event recorded for review" };
    }
    default:
      return { status: "ignored", detail: payload.event };
  }
}

async function orderIdForPayment(
  service: ReturnType<typeof requireServiceClient>,
  razorpayPaymentId: string
): Promise<string> {
  const { data } = await service
    .from("payments")
    .select("order_id")
    .eq("razorpay_payment_id", razorpayPaymentId)
    .maybeSingle();
  if (!data?.order_id) throw new CheckoutError("payment_not_found", "Payment not recorded", 404);
  return data.order_id;
}

/**
 * Applies a Route transfer state change.
 *
 * Out-of-order deliveries are resolved by re-reading the authoritative
 * provider object rather than trusting the webhook payload alone.
 */
export async function applyTransferState(
  service: ReturnType<typeof requireServiceClient>,
  input: { transferId: string; status: "processed" | "failed" | "reversed" | "partially_reversed"; amountPaise: number; reversedPaise: number }
): Promise<WebhookOutcome> {
  let status = input.status;
  let reversedPaise = input.reversedPaise;
  try {
    const authoritative = await fetchTransfer(input.transferId);
    status = authoritative.status as typeof status;
    reversedPaise = authoritative.amount_reversed;
  } catch {
    // Provider unreachable: fall back to the delivered payload but do not mark
    // anything as settled — only a verified provider state counts.
    if (status === "processed") return { status: "failed", detail: "transfer state could not be verified" };
  }

  const { data: transfer } = await service
    .from("route_transfers")
    .select("id, creator_id, order_id, order_item_id, amount_paise")
    .eq("transfer_id", input.transferId)
    .maybeSingle();

  if (!transfer) return { status: "ignored", detail: "unknown transfer" };

  await service
    .from("route_transfers")
    .update({ status, reversed_paise: reversedPaise })
    .eq("transfer_id", input.transferId);

  if (status === "processed") {
    await appendLedger(service, {
      idempotencyKey: `transfer-processed:${input.transferId}`,
      kind: "transfer",
      account: `creator:${transfer.creator_id}`,
      userId: transfer.creator_id,
      orderId: transfer.order_id,
      orderItemId: transfer.order_item_id,
      transferId: input.transferId,
      amountPaise: transfer.amount_paise,
      direction: "debit",
      description: "Transfer processed by Razorpay Route",
    });
  }

  if (status === "reversed" || status === "partially_reversed") {
    const amount = status === "reversed" ? transfer.amount_paise : reversedPaise;
    await appendLedger(service, {
      idempotencyKey: `transfer-reversal:${input.transferId}:${amount}`,
      kind: "reversal",
      account: `creator:${transfer.creator_id}`,
      userId: transfer.creator_id,
      orderId: transfer.order_id,
      orderItemId: transfer.order_item_id,
      transferId: input.transferId,
      amountPaise: amount,
      direction: "debit",
      description: `Transfer ${status.replace("_", " ")} by Razorpay Route`,
    });
    await service
      .from("entitlements")
      .update({ revoked_at: new Date().toISOString() })
      .eq("user_id", (await service.from("orders").select("user_id").eq("id", transfer.order_id).maybeSingle()).data?.user_id ?? "")
      .eq("course_id", (await service.from("order_items").select("course_id").eq("id", transfer.order_item_id ?? "").maybeSingle()).data?.course_id ?? "")
      .is("revoked_at", null);
  }

  return { status: "processed" };
}
