/**
 * Razorpay Payment Gateway integration (Standard Checkout, INR only).
 *
 * Scope: INR only. Learner payments settle into Zybble's merchant account via
 * standard Razorpay Orders (`POST /v1/orders` without Route `transfers`).
 * Creator share and platform commission are snapshotted onto `order_items` at
 * purchase time, recorded in the append-only ledger on verified capture, and
 * paid out to creators via the manual creator payout workflow.
 *
 * Legacy Razorpay Route helpers remain marked `@deprecated` only for historical
 * record compatibility; new orders never attach Route transfers.
 */

import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import Razorpay from "razorpay";
import { serverEnv } from "@/lib/env";
import { assertInr, assertIntegerPaise } from "@/lib/money";

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export type RouteAccountStatus = "created" | "requested" | "active" | "suspended" | "closed" | "error";

export interface RouteTransferRequest {
  account: string;
  amountPaise: number;
  notes?: Record<string, string>;
  linkedAccountNotes?: string[];
  onHold?: boolean;
}

export interface RazorpayOrderResult {
  id: string;
  entity: string;
  amount: number;
  amountPaid: number;
  amountDue: number;
  currency: string;
  receipt: string | null;
  status: string;
  attempts: number;
  createdAt: number;
  transfers?: Array<{ id: string; status: string; account: string; amount: number }>;
}

export interface RazorpayPaymentResult {
  id: string;
  order_id: string;
  status: string;
  amount: number;
  currency: string;
  method?: string;
  fee?: number;
  tax?: number;
  captured?: boolean;
  error_code?: string;
  error_description?: string;
  error_source?: string;
  error_step?: string;
}

export interface RouteTransferResult {
  id: string;
  status: string;
  recipient: string;
  amount: number;
  currency: string;
  amount_reversed: number;
  on_hold?: boolean;
}

export interface RouteAccountResult {
  id: string;
  type: string;
  status: RouteAccountStatus;
  email?: string;
  legal_business_name?: string;
  customer_facing_business_name?: string;
  settlement_beneficiary?: { name?: string; email?: string; phone?: string };
  profile?: Record<string, unknown>;
  notes?: Record<string, string>;
}

/* -------------------------------------------------------------------------- */
/* Client                                                                      */
/* -------------------------------------------------------------------------- */

let cached: Razorpay | null = null;

export class RazorpayNotConfiguredError extends Error {
  constructor() {
    super("Razorpay credentials are not configured");
    this.name = "RazorpayNotConfiguredError";
  }
}

export function getRazorpay(): Razorpay {
  if (!serverEnv.razorpayKeyId || !serverEnv.razorpayKeySecret) {
    throw new RazorpayNotConfiguredError();
  }
  if (!cached) {
    cached = new Razorpay({
      key_id: serverEnv.razorpayKeyId,
      key_secret: serverEnv.razorpayKeySecret,
    });
  }
  return cached;
}

/** Public key id, safe to hand to the browser for opening Checkout. */
export const razorpayKeyId = () => serverEnv.razorpayKeyId ?? null;

/* -------------------------------------------------------------------------- */
/* Pure crypto helpers (unit-testable without a network)                      */
/* -------------------------------------------------------------------------- */

function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Verifies the `X-Razorpay-Signature` header.
 *
 * Per Razorpay's documentation the signature is
 * `HMAC_SHA256(raw_request_body, webhook_secret)`, compared in hex. The body
 * MUST be the exact raw bytes — parsing then re-serialising it changes the
 * whitespace and breaks the comparison.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null | undefined,
  secret: string | undefined
): boolean {
  if (!signature || !secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  return safeEqualHex(expected, signature);
}

/**
 * Verifies the signature Checkout returns to the browser handler.
 * Per Razorpay: `HMAC_SHA256(razorpay_order_id + "|" + razorpay_payment_id, key_secret)`.
 */
export function verifyCheckoutSignature(
  orderId: string,
  paymentId: string,
  signature: string | null | undefined,
  keySecret: string | undefined = serverEnv.razorpayKeySecret
): boolean {
  if (!orderId || !paymentId || !signature || !keySecret) return false;
  const expected = createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");
  return safeEqualHex(expected, signature);
}

/* -------------------------------------------------------------------------- */
/* Standard INR Order creation (no Route transfers)                            */
/* -------------------------------------------------------------------------- */

export interface CreateOrderInput {
  amountPaise: number;
  receipt: string;
  notes?: Record<string, string>;
}

/**
 * Builds a standard Razorpay order payload (`POST /v1/orders`).
 *
 * Enforces:
 *   1. Integer paise > 0
 *   2. Currency strictly `"INR"`
 *   3. `partial_payment: false`
 *   4. No Route `transfers` array attached
 */
export function buildOrderPayload(input: CreateOrderInput & { transfers?: unknown }) {
  assertInr("INR");
  assertIntegerPaise(input.amountPaise);
  if (input.amountPaise <= 0) throw new Error("Razorpay order amount must be greater than zero");
  if (!input.receipt || input.receipt.trim().length === 0) {
    throw new Error("Razorpay order receipt is required");
  }
  if (input.transfers !== undefined) {
    throw new Error("Razorpay Route order transfers are disabled; orders settle to Zybble for manual creator payout");
  }

  return {
    amount: input.amountPaise,
    currency: "INR" as const,
    receipt: input.receipt.trim(),
    partial_payment: false,
    ...(input.notes ? { notes: input.notes } : {}),
  };
}

/** Creates a standard INR Razorpay order without Route transfers. */
export async function createOrder(input: CreateOrderInput): Promise<RazorpayOrderResult> {
  const payload = buildOrderPayload(input);
  const response = await getRazorpay().orders.create(payload as never);
  const order = response as unknown as RazorpayOrderResult & {
    amount_paid?: number;
    amount_due?: number;
    created_at?: number;
  };
  return {
    id: order.id,
    entity: order.entity,
    amount: order.amount,
    amountPaid: order.amount_paid ?? 0,
    amountDue: order.amount_due ?? order.amount,
    currency: order.currency,
    receipt: order.receipt ?? null,
    status: order.status,
    attempts: order.attempts ?? 0,
    createdAt: order.created_at ?? Math.floor(Date.now() / 1000),
  };
}

export async function fetchOrder(orderId: string): Promise<RazorpayOrderResult> {
  const order = (await getRazorpay().orders.fetch(orderId)) as unknown as RazorpayOrderResult & {
    amount_paid?: number;
    amount_due?: number;
    created_at?: number;
  };
  return {
    id: order.id,
    entity: order.entity,
    amount: order.amount,
    amountPaid: order.amount_paid ?? 0,
    amountDue: order.amount_due ?? order.amount,
    currency: order.currency,
    receipt: order.receipt ?? null,
    status: order.status,
    attempts: order.attempts ?? 0,
    createdAt: order.created_at ?? 0,
  };
}

export async function fetchPayment(paymentId: string): Promise<RazorpayPaymentResult> {
  return (await getRazorpay().payments.fetch(paymentId)) as unknown as RazorpayPaymentResult;
}

export async function capturePayment(paymentId: string, amountPaise: number, currency = "INR") {
  assertInr(currency);
  assertIntegerPaise(amountPaise);
  return getRazorpay().payments.capture(paymentId, amountPaise, currency);
}

/* -------------------------------------------------------------------------- */
/* Route: linked accounts                                                      */
/* -------------------------------------------------------------------------- */

export interface CreateLinkedAccountInput {
  email: string;
  phone: string;
  legalBusinessName: string;
  customerFacingBusinessName?: string;
  businessType: string;
  contactName: string;
  profile: {
    category: string;
    subcategory: string;
    businessModel?: string;
    addresses: {
      registered: {
        street1: string;
        street2?: string;
        city: string;
        state: string;
        postal_code: string;
        country: string;
      };
    };
  };
  legalInfo?: { pan?: string; gst?: string; cin?: string };
}

/** `POST /v2/accounts` — creates a Route linked account. */
export async function createLinkedAccount(input: CreateLinkedAccountInput): Promise<RouteAccountResult> {
  const payload: Record<string, unknown> = {
    email: input.email,
    phone: input.phone,
    type: "route",
    legal_business_name: input.legalBusinessName,
    business_type: input.businessType,
    contact_name: input.contactName,
    profile: input.profile,
  };
  if (input.customerFacingBusinessName) {
    payload.customer_facing_business_name = input.customerFacingBusinessName;
  }
  if (input.legalInfo) payload.legal_info = input.legalInfo;

  const response = await getRazorpay().accounts.create(payload as never);
  return normaliseAccount(response as unknown as Record<string, unknown>);
}

/** `GET /v2/accounts/:id` — authoritative provider status. */
export async function fetchLinkedAccount(accountId: string): Promise<RouteAccountResult> {
  const response = await getRazorpay().accounts.fetch(accountId);
  return normaliseAccount(response as unknown as Record<string, unknown>);
}

/**
 * Fetches the current Route status of every configured linked account.
 * Returns a map keyed by account id. Failures are reported per account so one
 * bad id cannot hide the state of the rest.
 */
export async function fetchLinkedAccountStatuses(
  accountIds: string[]
): Promise<Record<string, { status: RouteAccountStatus | "unreachable"; error?: string }>> {
  const results: Record<string, { status: RouteAccountStatus | "unreachable"; error?: string }> = {};
  for (const id of accountIds) {
    try {
      const account = await fetchLinkedAccount(id);
      results[id] = { status: account.status };
    } catch (error) {
      results[id] = {
        status: "unreachable",
        error: error instanceof Error ? error.message : "Razorpay unreachable",
      };
    }
  }
  return results;
}

function normaliseAccount(raw: Record<string, unknown>): RouteAccountResult {
  const status = String(raw.status ?? "created") as RouteAccountStatus;
  return {
    id: String(raw.id),
    type: String(raw.type ?? "route"),
    status,
    email: typeof raw.email === "string" ? raw.email : undefined,
    legal_business_name:
      typeof raw.legal_business_name === "string" ? raw.legal_business_name : undefined,
    customer_facing_business_name:
      typeof raw.customer_facing_business_name === "string"
        ? raw.customer_facing_business_name
        : undefined,
    settlement_beneficiary: raw.settlement_beneficiary as RouteAccountResult["settlement_beneficiary"],
    profile: (raw.profile as Record<string, unknown>) ?? undefined,
    notes: (raw.notes as Record<string, string>) ?? undefined,
  };
}

/**
 * A linked account may receive transfers only once Razorpay reports it active.
 * Anything else (or an unreachable provider) blocks the sale rather than
 * guessing.
 */
export function isRouteAccountEligible(status: RouteAccountStatus | null | undefined): boolean {
  return status === "active";
}

/* -------------------------------------------------------------------------- */
/* Route: transfers and settlements                                            */
/* -------------------------------------------------------------------------- */

/** `POST /v1/transfers` — used only for recovery of an order-time split that failed. */
export async function createTransferFromPayment(params: {
  account: string;
  amountPaise: number;
  currency?: "INR";
  onHold?: boolean;
  notes?: Record<string, string>;
}): Promise<RouteTransferResult> {
  assertInr(params.currency ?? "INR");
  assertIntegerPaise(params.amountPaise);
  const response = await getRazorpay().transfers.create({
    account: params.account,
    amount: params.amountPaise,
    currency: "INR",
    ...(params.onHold ? { on_hold: true } : {}),
    ...(params.notes ? { notes: params.notes } : {}),
  });
  return normaliseTransfer(response as unknown as Record<string, unknown>);
}

export async function fetchTransfer(transferId: string): Promise<RouteTransferResult> {
  const response = await getRazorpay().transfers.fetch(transferId);
  return normaliseTransfer(response as unknown as Record<string, unknown>);
}

function normaliseTransfer(raw: Record<string, unknown>): RouteTransferResult {
  return {
    id: String(raw.id),
    status: String(raw.status ?? "created"),
    recipient: String(raw.recipient ?? raw.account ?? ""),
    amount: Number(raw.amount ?? 0),
    currency: String(raw.currency ?? "INR"),
    amount_reversed: Number(raw.amount_reversed ?? 0),
    on_hold: Boolean(raw.on_hold),
  };
}

export interface RouteSettlementResult {
  id: string;
  transfer_id: string;
  account_id: string;
  amount: number;
  currency: string;
  status: string;
  settled_at?: number;
}

export async function fetchTransferSettlements(
  transferId?: string,
  accountId?: string
): Promise<RouteSettlementResult[]> {
  const data: Record<string, unknown> = { count: 100 };
  if (transferId) data.transfer_id = transferId;
  if (accountId) data.account_id = accountId;
  // `GET /v1/settlements` — the Route filters are not part of the SDK's typed
  // pagination options, so the request goes through the authenticated instance.
  const response = (await (
    getRazorpay() as unknown as {
      get: (options: { url: string; data: Record<string, unknown> }) => Promise<unknown>;
    }
  ).get({ url: "/settlements", data })) as { items?: RouteSettlementResult[] };
  return response.items ?? [];
}

/* -------------------------------------------------------------------------- */
/* Webhook payloads                                                            */
/* -------------------------------------------------------------------------- */

export interface RazorpayWebhookPayload {
  entity: string;
  event: string;
  account_id?: string;
  contains?: string[];
  payload?: {
    payment?: {
      entity: string;
      id: string;
      amount: number;
      currency: string;
      status: string;
      method?: string;
      fee?: number;
      tax?: number;
      error_code?: string;
      error_description?: string;
      order_id?: string;
    };
    transfer?: {
      entity: string;
      id: string;
      status: string;
      amount: number;
      currency: string;
      amount_reversed: number;
      recipient?: string;
      on_hold?: boolean;
    };
    settlement?: {
      entity: string;
      id: string;
      amount: number;
      currency: string;
      transfer_id?: string;
      account_id?: string;
      settled_at?: number;
    };
    order?: { entity: string; id: string; amount: number; currency: string; status: string };
  };
}

/**
 * Webhook events Zybble subscribes to. Anything else is recorded and ignored.
 *
 * Razorpay `refund.*` / `payment.refunded` events are deliberately absent: the
 * marketplace has no refund flow. They are still durably recorded in
 * `webhook_events` so an administrator can see one happened, but no code path
 * acts on them.
 */
export const SUPPORTED_WEBHOOK_EVENTS = [
  "payment.captured",
  "payment.authorized",
  "payment.failed",
  "transfer.processed",
  "transfer.failed",
  "transfer.reversed",
  "transfer.partially_reversed",
  "settlement.processed",
  "settlement.failed",
  "order.paid",
] as const;

export type SupportedWebhookEvent = (typeof SUPPORTED_WEBHOOK_EVENTS)[number];

export function isSupportedWebhookEvent(event: string): event is SupportedWebhookEvent {
  return (SUPPORTED_WEBHOOK_EVENTS as readonly string[]).includes(event);
}
