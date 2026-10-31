import { billableSeats, monthlyAmountCents } from "@/features/billing/entitlements";
import type { WorkspaceContext } from "@/features/workspaces/access";
import { AppError, IntegrationNotConfiguredError } from "@/lib/errors";
import { isDodoConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createProCheckoutSession, createCustomerPortalSession, cancelSubscription } from "@/lib/dodo/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { BillingPaymentRow, SubscriptionRow, WorkspaceMemberRow } from "@/lib/supabase/database.types";

/**
 * Checkout and subscription management.
 *
 * The cardinal rule: the browser is never the source of truth for payment state.
 * Checkout only ever returns a Dodo-hosted URL; entitlement changes arrive from
 * verified webhooks and are read back from `public.subscriptions`.
 */

export type BillingState = {
  plan: "free" | "pro";
  status: string;
  seats: number;
  monthlyAmountCents: number;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  paymentMethodBrand: string | null;
  paymentMethodLast4: string | null;
  dodoConfigured: boolean;
  invoices: Array<{
    id: string;
    issuedAt: string;
    amountUsd: number;
    status: string;
    pdfUrl: string | null;
  }>;
};

export async function getBillingState(
  context: WorkspaceContext,
): Promise<BillingState> {
  const admin = createSupabaseAdminClient();

  const [{ data: subscription }, { data: payments }, { data: members }] = await Promise.all([
    admin.from("subscriptions").select("*").eq("workspace_id", context.workspace.id).maybeSingle(),
    admin
      .from("billing_payments")
      .select("*")
      .eq("workspace_id", context.workspace.id)
      .order("issued_at", { ascending: false })
      .limit(24),
    admin
      .from("workspace_members")
      .select("status")
      .eq("workspace_id", context.workspace.id),
  ]);

  const row = subscription as SubscriptionRow | null;
  const seats = billableSeats(((members ?? []) as Array<{ status: string }>).map((m) => ({ status: m.status })));
  const latestPaid = ((payments ?? []) as BillingPaymentRow[]).find((payment) => payment.status === "paid");

  return {
    plan: row?.plan ?? "free",
    status: row?.status ?? "free",
    seats: row?.seats ?? seats,
    monthlyAmountCents: monthlyAmountCents(row?.seats ?? seats),
    currentPeriodEnd: row?.current_period_end ?? null,
    cancelAtPeriodEnd: row?.cancel_at_period_end ?? false,
    canceledAt: row?.canceled_at ?? null,
    paymentMethodBrand: latestPaid?.brand ?? null,
    paymentMethodLast4: latestPaid?.last4 ?? null,
    dodoConfigured: isDodoConfigured(),
    invoices: ((payments ?? []) as BillingPaymentRow[]).map((payment) => ({
      id: payment.id,
      issuedAt: payment.issued_at,
      amountUsd: payment.amount_cents / 100,
      status: payment.status,
      pdfUrl: payment.invoice_url,
    })),
  };
}

export async function startProCheckout(
  context: WorkspaceContext,
  options: { seats?: number; returnPath?: string } = {},
): Promise<{ checkoutUrl: string; seats: number; amountCents: number }> {
  if (!context.canManage) {
    throw new AppError("forbidden", "Only workspace owners and admins can change billing.");
  }

  if (!isDodoConfigured()) {
    throw new IntegrationNotConfiguredError("Dodo Payments");
  }

  const admin = createSupabaseAdminClient();

  const [{ data: members }, { data: profile }, { data: subscription }] = await Promise.all([
    admin.from("workspace_members").select("status").eq("workspace_id", context.workspace.id),
    admin.from("profiles").select("full_name, email").eq("id", context.user.id).maybeSingle(),
    admin.from("subscriptions").select("dodo_customer_id, status, plan").eq("workspace_id", context.workspace.id).maybeSingle(),
  ]);

  const existing = subscription as Pick<SubscriptionRow, "dodo_customer_id" | "status" | "plan"> | null;

  if (existing?.plan === "pro" && ["active", "past_due", "pending"].includes(existing.status ?? "")) {
    throw new AppError("conflict", "This workspace already has an active Pro subscription.");
  }

  const seats = options.seats ?? billableSeats((members ?? []) as WorkspaceMemberRow[]);
  const returnPath = options.returnPath ?? "/settings/billing";

  const { checkoutUrl } = await createProCheckoutSession({
    workspaceId: context.workspace.id,
    seats,
    email: context.user.email ?? (profile?.email as string) ?? "",
    name:
      (profile?.full_name as string | null) ??
      context.user.email?.split("@")[0] ??
      context.workspace.name,
    returnUrl: new URL(returnPath, process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").toString(),
    dodoCustomerId: existing?.dodo_customer_id ?? null,
  });

  await admin.from("audit_logs").insert({
    workspace_id: context.workspace.id,
    actor_type: "user",
    actor_user_id: context.user.id,
    action: "billing.checkout_started",
    entity_type: "subscription",
    entity_id: null,
    metadata: { seats, amountCents: monthlyAmountCents(seats) } as never,
  });

  return { checkoutUrl, seats, amountCents: monthlyAmountCents(seats) };
}

/**
 * Dodo's hosted customer portal handles cards, invoices and cancellation.
 * Falls back to an explicit cancellation API call when the portal is not
 * available for the customer.
 */
export async function openBillingPortal(
  context: WorkspaceContext,
  options: { returnPath?: string } = {},
): Promise<{ url: string }> {
  if (!context.canManage) {
    throw new AppError("forbidden", "Only workspace owners and admins can manage billing.");
  }

  if (!isDodoConfigured()) {
    throw new IntegrationNotConfiguredError("Dodo Payments");
  }

  const admin = createSupabaseAdminClient();

  const { data: subscription } = await admin
    .from("subscriptions")
    .select("dodo_customer_id, dodo_subscription_id")
    .eq("workspace_id", context.workspace.id)
    .maybeSingle();

  const row = subscription as Pick<SubscriptionRow, "dodo_customer_id" | "dodo_subscription_id"> | null;

  if (!row?.dodo_customer_id) {
    throw new AppError(
      "not_found",
      "No Dodo customer is linked to this workspace yet. Start checkout first.",
    );
  }

  const url = await createCustomerPortalSession({
    dodoCustomerId: row.dodo_customer_id,
    returnUrl: new URL(
      options.returnPath ?? "/settings/billing",
      process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    ).toString(),
  });

  return { url };
}

/**
 * Request cancellation.
 *
 * Default behaviour is cancel-at-period-end: the workspace keeps Pro until the
 * paid period ends, then `effectivePlan()` drops it to Free automatically. The
 * local row is only updated when Dodo confirms via webhook.
 */
export async function requestCancellation(
  context: WorkspaceContext,
  options: { immediately?: boolean } = {},
): Promise<{ cancelAtPeriodEnd: boolean }> {
  if (!context.canManage) {
    throw new AppError("forbidden", "Only workspace owners and admins can cancel billing.");
  }

  if (!isDodoConfigured()) {
    throw new IntegrationNotConfiguredError("Dodo Payments");
  }

  const admin = createSupabaseAdminClient();

  const { data: subscription } = await admin
    .from("subscriptions")
    .select("dodo_subscription_id, status")
    .eq("workspace_id", context.workspace.id)
    .maybeSingle();

  const row = subscription as Pick<SubscriptionRow, "dodo_subscription_id" | "status"> | null;

  if (!row?.dodo_subscription_id) {
    throw new AppError("not_found", "This workspace has no Pro subscription to cancel.");
  }

  await cancelSubscription({
    dodoSubscriptionId: row.dodo_subscription_id,
    immediately: options.immediately ?? false,
  });

  await admin.from("audit_logs").insert({
    workspace_id: context.workspace.id,
    actor_type: "user",
    actor_user_id: context.user.id,
    action: "billing.cancellation_requested",
    entity_type: "subscription",
    entity_id: row.dodo_subscription_id,
    metadata: { immediately: Boolean(options.immediately) } as never,
  });

  logger.info("billing.cancellation_requested", { workspaceId: context.workspace.id });

  return { cancelAtPeriodEnd: !options.immediately };
}
