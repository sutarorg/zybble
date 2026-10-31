import DodoPayments from "dodopayments";
import { env, isDodoConfigured } from "@/lib/env";
import { IntegrationNotConfiguredError } from "@/lib/errors";

/**
 * Dodo Payments client.
 *
 * Pricing model (fixed by the product brief, no additional plans):
 *   Pro = $15 per paid seat per month, billed monthly.
 *
 * Dodo implements seat-based pricing as a subscription `quantity` (plus an
 * optional per-seat add-on). Zybble bills purely per seat, so the Pro product is
 * configured with quantity = number of active workspace members; when
 * DODO_PRO_SEAT_ADDON_ID is set, the same quantity is also pushed as the add-on
 * quantity for itemised invoices.
 */

let cached: DodoPayments | null = null;

export function dodo(): DodoPayments {
  const configuration = env();

  if (!isDodoConfigured()) {
    throw new IntegrationNotConfiguredError("Dodo Payments");
  }

  if (!cached) {
    cached = new DodoPayments({
      bearerToken: configuration.DODO_PAYMENTS_API_KEY,
      webhookKey: configuration.DODO_PAYMENTS_WEBHOOK_KEY,
      environment: configuration.DODO_PAYMENTS_ENVIRONMENT,
      maxRetries: 2,
      timeout: 20_000,
    });
  }

  return cached;
}

export function proProductId(): string {
  const productId = env().DODO_PRO_PRODUCT_ID;
  if (!productId) throw new IntegrationNotConfiguredError("Dodo Payments (DODO_PRO_PRODUCT_ID)");
  return productId;
}

export type CheckoutSessionInput = {
  workspaceId: string;
  seats: number;
  email: string;
  name: string;
  returnUrl: string;
  dodoCustomerId?: string | null;
};

export type CheckoutSessionResult = {
  sessionId: string;
  checkoutUrl: string;
};

/**
 * Create a hosted checkout session for the Pro plan.
 *
 * The workspace id travels in the session `metadata`, which Dodo echoes back on
 * every webhook. That — not anything the browser sends — is how we know which
 * workspace a payment belongs to.
 */
export async function createProCheckoutSession(
  input: CheckoutSessionInput,
): Promise<CheckoutSessionResult> {
  const client = dodo();
  const configuration = env();

  const productCart: Array<{ product_id: string; quantity: number }> = [
    { product_id: proProductId(), quantity: Math.max(input.seats, 1) },
  ];

  if (configuration.DODO_PRO_SEAT_ADDON_ID) {
    productCart.push({
      product_id: configuration.DODO_PRO_SEAT_ADDON_ID,
      quantity: Math.max(input.seats, 1),
    });
  }

  const session = await client.checkoutSessions.create({
    product_cart: productCart,
    customer: input.dodoCustomerId
      ? { customer_id: input.dodoCustomerId }
      : { email: input.email, name: input.name },
    // Dodo sends the customer back here after payment; the subscription only
    // becomes active once the signed webhook lands.
    return_url: input.returnUrl,
    metadata: {
      workspace_id: input.workspaceId,
      plan: "pro",
      seats: String(Math.max(input.seats, 1)),
    },
    billing_currency: "USD",
  });

  if (!session.checkout_url) {
    throw new Error("Dodo Payments did not return a checkout URL.");
  }

  return { sessionId: session.session_id, checkoutUrl: session.checkout_url };
}

/** Customer portal link for self-serve card and invoice management. */
export async function createCustomerPortalSession(input: {
  dodoCustomerId: string;
  returnUrl: string;
}): Promise<string> {
  const client = dodo();

  const session = await client.customers.customerPortal.create(input.dodoCustomerId, {
    return_url: input.returnUrl,
    send_email: false,
  });

  return session.link;
}

export type SeatChangeResult = {
  subscriptionId: string;
  quantity: number;
};

/**
 * Push a new seat count to Dodo.
 *
 * Uses `changePlan` with the same product: that is Dodo's supported route for
 * changing the quantity of a live subscription, and the proration mode is
 * configurable per deployment (`DODO_SEAT_PRORATION_MODE`, default
 * `difference_immediately` so the customer is charged only the difference).
 */
export async function updateSubscriptionSeats(input: {
  dodoSubscriptionId: string;
  seats: number;
}): Promise<SeatChangeResult> {
  const client = dodo();
  const configuration = env();
  const quantity = Math.max(input.seats, 1);

  const addons = configuration.DODO_PRO_SEAT_ADDON_ID
    ? [{ addon_id: configuration.DODO_PRO_SEAT_ADDON_ID, quantity }]
    : [];

  await client.subscriptions.changePlan(input.dodoSubscriptionId, {
    product_id: proProductId(),
    quantity,
    proration_billing_mode: configuration.DODO_SEAT_PRORATION_MODE,
    addons,
  });

  return { subscriptionId: input.dodoSubscriptionId, quantity };
}

/** Cancel at period end (default) or immediately. */
export async function cancelSubscription(input: {
  dodoSubscriptionId: string;
  immediately?: boolean;
}): Promise<void> {
  const client = dodo();

  await client.subscriptions.update(input.dodoSubscriptionId, {
    status: "cancelled",
    cancel_at_next_billing_date: !input.immediately,
    cancel_reason: "cancelled_by_customer",
  });
}

export async function retrieveSubscription(dodoSubscriptionId: string) {
  const client = dodo();
  return client.subscriptions.retrieve(dodoSubscriptionId);
}
