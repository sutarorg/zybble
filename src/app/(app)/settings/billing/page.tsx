"use client";

import { format } from "date-fns";
import { AlertTriangle, Check, CreditCard, ExternalLink, FileText, Loader2, ReceiptText } from "lucide-react";
import { useState } from "react";
import { SettingsNav } from "@/components/app/settings-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip } from "@/components/ui/tooltip";
import { apiGet, apiPost, errorMessage } from "@/lib/api/client";
import { useBilling, useMembers, useUsage } from "@/lib/app/hooks";
import { cn } from "@/lib/utils";

/**
 * Billing settings.
 *
 * The plan shown here is read from `public.subscriptions`, which is written only
 * by verified Dodo webhooks — never from a client claim. Checkout, the customer
 * portal and cancellation are all server-side calls that return a provider URL;
 * entitlement changes appear after the webhook lands, so a cancelled-but-paid
 * period still shows Pro until it actually ends.
 */

const FREE_FEATURES = [
  "1 LinkedIn account",
  "10 scheduled posts per month",
  "Unlimited drafts",
  "7-day basic analytics",
  "Content calendar",
];

const PRO_FEATURES = [
  "Up to 5 LinkedIn accounts per workspace",
  "Unlimited scheduled posts",
  "12-month advanced analytics",
  "Best-time-to-post insights",
  "Team collaboration",
];

type SeatInfo = {
  seats: number;
  seatPriceCents: number;
  monthlyAmountCents: number;
  definition: string;
};

export default function BillingSettingsPage() {
  const billing = useBilling();
  const usage = useUsage();
  const members = useMembers();

  const [pending, setPending] = useState<"checkout" | "portal" | "cancel" | "seats" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const state = billing.data;
  const isPro = state?.plan === "pro";
  const canManage = state?.role === "owner" || state?.role === "admin";
  const loading = billing.loading || usage.loading;

  async function run(
    kind: "checkout" | "portal" | "cancel" | "seats",
    action: () => Promise<{ url?: string } | SeatInfo>,
  ) {
    setPending(kind);
    setActionError(null);
    try {
      const result = await action();
      if ("url" in result && result.url) {
        window.location.href = result.url;
        return;
      }
      billing.reload();
      usage.reload();
    } catch (error) {
      setActionError(errorMessage(error, "That billing action could not be completed."));
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <SettingsNav />
      <div className="space-y-6">
        {billing.error && (
          <div className="flex items-start gap-3 rounded-2xl bg-red-50 p-4 ring-1 ring-red-200">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-600" aria-hidden />
            <div>
              <p className="text-sm font-medium text-red-900">Billing could not be loaded</p>
              <p className="mt-1 text-[13px] leading-6 text-red-800">{billing.error}</p>
            </div>
          </div>
        )}

        {actionError && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-2xl bg-red-50 px-4 py-3 text-[13px] text-red-800 ring-1 ring-red-200"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {actionError}
          </p>
        )}

        {state?.dodoConfigured === false && (
          <div className="flex items-start gap-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden />
            <p className="text-[13px] leading-6 text-amber-900">
              Dodo Payments is not configured on this deployment yet, so checkout and the customer
              portal are unavailable. Nothing is charged and no plan is invented — the workspace
              stays on Free until a verified subscription webhook arrives.
            </p>
          </div>
        )}

        {/* Plans */}
        <section aria-label="Plans" className="grid gap-4 sm:grid-cols-2">
          <article
            className={cn(
              "rounded-2xl bg-white p-6 shadow-xs",
              isPro ? "ring-1 ring-slate-200" : "ring-2 ring-brand-600",
            )}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Free</h2>
              {!isPro && <Badge variant="neutral">Current plan</Badge>}
            </div>
            <p className="mt-3 flex items-baseline gap-1.5">
              <span className="text-3xl font-semibold tracking-tight text-slate-950">$0</span>
              <span className="text-sm text-slate-500">/ month</span>
            </p>
            <ul className="mt-5 space-y-2.5">
              {FREE_FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-[13px] leading-5 text-slate-600">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-brand-600" aria-hidden />
                  {feature}
                </li>
              ))}
            </ul>
            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-500">
                Scheduled posts used this period:{" "}
                <span className="font-semibold tabular-nums text-slate-700">
                  {usage.loading
                    ? "…"
                    : `${usage.data?.scheduledThisMonth ?? 0} / ${usage.data?.monthlyLimit ?? 10}`}
                </span>
              </p>
            </div>
          </article>

          <article
            className={cn(
              "relative rounded-2xl bg-white p-6 shadow-panel",
              isPro ? "ring-2 ring-brand-600" : "ring-1 ring-slate-200",
            )}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Pro</h2>
              {isPro ? <Badge variant="brand-solid">Current plan</Badge> : <Badge>Recommended</Badge>}
            </div>
            <p className="mt-3 flex items-baseline gap-1.5">
              <span className="text-3xl font-semibold tracking-tight text-slate-950">$15</span>
              <span className="text-sm text-slate-500">/ seat / month</span>
            </p>
            <ul className="mt-5 space-y-2.5">
              {PRO_FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-[13px] leading-5 text-slate-600">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-brand-600" aria-hidden />
                  {feature}
                </li>
              ))}
            </ul>
            <div className="mt-5 border-t border-slate-100 pt-4">
              {isPro ? (
                <div className="space-y-2">
                  <Button
                    variant="secondary"
                    className="w-full"
                    disabled={pending !== null || !canManage || state?.dodoConfigured === false}
                    onClick={() =>
                      void run("portal", () =>
                        apiPost<{ url: string }>("/api/billing/portal", {}),
                      )
                    }
                  >
                    {pending === "portal" && <Loader2 className="animate-spin" aria-hidden />}
                    <ExternalLink aria-hidden />
                    Manage in billing portal
                  </Button>
                  {!state?.cancelAtPeriodEnd && (
                    <Button
                      variant="ghost"
                      className="w-full text-slate-500"
                      disabled={pending !== null || !canManage || state?.dodoConfigured === false}
                      onClick={() =>
                        void run("cancel", () =>
                          apiPost<{ url?: string }>("/api/billing/cancel", { immediately: false }),
                        )
                      }
                    >
                      Cancel at period end
                    </Button>
                  )}
                </div>
              ) : (
                <Button
                  className="w-full"
                  disabled={pending !== null || !canManage || state?.dodoConfigured === false}
                  onClick={() =>
                    void run("checkout", () =>
                      apiPost<{ checkoutUrl: string }>("/api/billing/checkout", {
                        returnPath: "/settings/billing",
                      }).then((result) => ({ url: result.checkoutUrl })),
                    )
                  }
                >
                  {pending === "checkout" && <Loader2 className="animate-spin" aria-hidden />}
                  Upgrade to Pro
                </Button>
              )}
              <p className="mt-2.5 text-center text-xs leading-5 text-slate-500">
                One seat = one active workspace member · cancel anytime · cards handled by Dodo
                Payments, never stored by Zybble
              </p>
              {!canManage && state && (
                <p className="mt-2 text-center text-xs text-slate-500">
                  Only owners and admins can change billing.
                </p>
              )}
            </div>
          </article>
        </section>

        {/* Seats */}
        <section aria-labelledby="seats-heading" className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="seats-heading" className="text-[15px] font-semibold text-slate-900">
                Seats
              </h2>
              <p className="mt-1 text-[13px] leading-6 text-slate-500">
                One seat = one active member of this workspace (minimum 1). Pending invitations and
                removed members are not billed.
              </p>
            </div>
            {isPro && canManage && (
              <Button
                variant="secondary"
                size="sm"
                disabled={pending !== null || state?.dodoConfigured === false}
                onClick={() => void run("seats", () => apiPost<SeatInfo>("/api/billing/seats", {}))}
              >
                {pending === "seats" && <Loader2 className="animate-spin" aria-hidden />}
                Sync seats
              </Button>
            )}
          </div>
          <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-3">
            <div>
              <dt className="text-[13px] text-slate-500">Active members</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">
                {members.loading ? "…" : (members.data?.members.filter((member) => member.status === "active").length ?? 0)}
              </dd>
            </div>
            <div>
              <dt className="text-[13px] text-slate-500">Billable seats</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">
                {state ? state.seats : "…"}
              </dd>
            </div>
            <div>
              <dt className="text-[13px] text-slate-500">Monthly total</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">
                {state ? `$${(state.monthlyAmountCents / 100).toFixed(2)}` : "…"}
              </dd>
            </div>
          </dl>
        </section>

        {/* Payment method + invoices */}
        <div className="grid gap-6 sm:grid-cols-2">
          <section aria-labelledby="payment-heading" className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-xs">
            <h2 id="payment-heading" className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
              <CreditCard className="size-4 text-brand-600" aria-hidden />
              Payment method
            </h2>
            <div className="mt-4">
              {loading ? (
                <Skeleton className="h-20 w-full" />
              ) : state?.paymentMethodLast4 ? (
                <div className="rounded-xl ring-1 ring-slate-200">
                  <p className="px-4 py-3 text-sm font-medium text-slate-800">
                    {state.paymentMethodBrand ?? "Card"} ·••• {state.paymentMethodLast4}
                  </p>
                  {isPro && canManage && state.dodoConfigured && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full rounded-t-none"
                      disabled={pending !== null}
                      onClick={() => void run("portal", () => apiPost<{ url: string }>("/api/billing/portal", {}))}
                    >
                      Update in portal
                    </Button>
                  )}
                </div>
              ) : (
                <EmptyState
                  compact
                  icon={CreditCard}
                  title="No payment method on file"
                  description="The Free plan needs no card. When you upgrade, checkout is handled by Dodo Payments — Zybble never stores card numbers."
                />
              )}
            </div>
          </section>

          <section aria-labelledby="invoices-heading" className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-xs">
            <h2 id="invoices-heading" className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
              <ReceiptText className="size-4 text-brand-600" aria-hidden />
              Billing history
            </h2>
            <div className="mt-4">
              {loading ? (
                <Skeleton className="h-20 w-full" />
              ) : (state?.invoices.length ?? 0) === 0 ? (
                <EmptyState
                  compact
                  icon={FileText}
                  title="No invoices yet"
                  description="Invoices recorded from verified Dodo payment events appear here, newest first."
                />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {state!.invoices.slice(0, 5).map((invoice) => (
                    <li key={invoice.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-slate-800">
                          ${invoice.amountUsd.toFixed(2)}
                        </p>
                        <p className="text-[12px] text-slate-500">
                          {format(new Date(invoice.issuedAt), "d MMM yyyy")} · {invoice.status}
                        </p>
                      </div>
                      {invoice.pdfUrl && (
                        <a
                          href={invoice.pdfUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-700 hover:text-brand-800"
                        >
                          PDF
                          <ExternalLink className="size-3.5" aria-hidden />
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

        {/* Subscription state */}
        <section aria-label="Subscription status" className="rounded-2xl bg-slate-50 p-6 ring-1 ring-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">Subscription status</h2>
          <dl className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            <div className="flex justify-between sm:block">
              <dt className="text-slate-500">Plan</dt>
              <dd className="font-medium text-slate-800">{state ? (state.plan === "pro" ? "Pro" : "Free") : "…"}</dd>
            </div>
            <div className="flex justify-between sm:block">
              <dt className="text-slate-500">Status</dt>
              <dd className="font-medium text-slate-800">
                {state ? humanStatus(state.status, state.cancelAtPeriodEnd) : "…"}
              </dd>
            </div>
            <div className="flex justify-between sm:block">
              <dt className="text-slate-500">Seats</dt>
              <dd className="font-medium tabular-nums text-slate-800">{state ? state.seats : "…"}</dd>
            </div>
            <div className="flex justify-between sm:block">
              <dt className="text-slate-500">Renews</dt>
              <dd className="font-medium text-slate-800">
                {state?.currentPeriodEnd
                  ? format(new Date(state.currentPeriodEnd), "d MMM yyyy")
                  : "— (nothing to renew)"}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-[12px] leading-5 text-slate-500">
            This state is written by verified Dodo Payments webhooks. Nothing on this page is granted
            from the browser.
          </p>
        </section>
      </div>
    </div>
  );
}

function humanStatus(status: string, cancelAtPeriodEnd: boolean): string {
  if (cancelAtPeriodEnd) return "Cancels at period end";

  switch (status) {
    case "free":
      return "Active (no billing)";
    case "active":
      return "Active";
    case "past_due":
      return "Past due — payment retrying";
    case "pending":
      return "Awaiting first payment";
    case "on_hold":
    case "paused":
      return "Paused by provider";
    case "failed":
      return "Payment failed";
    case "cancelled":
      return "Cancelled";
    case "expired":
      return "Expired";
    default:
      return status;
  }
}
