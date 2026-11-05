import type { Metadata } from "next";
import {
  DataTable,
  EmptyRow,
  PageHeader,
  Panel,
  StatTile,
  StatusPill,
  Td,
  Th,
} from "@/components/admin/primitives";
import { formatDate, formatMoney, formatNumber } from "@/features/admin/format";
import { loadBilling } from "@/features/admin/billing";
import { safeLoad } from "@/features/admin/safe";

/**
 * Platform billing. READ-ONLY.
 *
 * Two things this page is careful about:
 *
 *  1. **MRR is summed only from `subscriptions.unit_amount_cents`** — the
 *     amount the payment provider reports it will charge. Where that value is
 *     missing the subscription is counted under "excluded" rather than filled
 *     in from the $15 list price, because a reconstructed number looks exact
 *     and is invented.
 *  2. **No payment instruments.** `billing_payments` has `brand` and `last4`
 *     columns; they are never selected, so they cannot reach this page.
 *
 * There are no write controls. Changing money belongs in the provider's own
 * console, where the party that moves it keeps the audit trail.
 */

export const metadata: Metadata = { title: "Billing" };
export const dynamic = "force-dynamic";

const PAYMENT_TONE = {
  paid: "success",
  failed: "danger",
  refunded: "neutral",
  pending: "warning",
} as const;

function subscriptionTone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "active") return "success";
  if (status === "past_due" || status === "pending") return "warning";
  if (status === "failed" || status === "cancelled" || status === "expired") return "danger";
  return "neutral";
}

export default async function AdminBillingPage() {
  const result = await safeLoad("admin.billing.failed", loadBilling);

  if (!result.ok) {
    return (
      <>
        <PageHeader title="Billing" description="Plans, subscriptions and recurring revenue." />
        <Panel className="mt-6">
          <p className="text-[13px] text-slate-600">{result.message}</p>
        </Panel>
      </>
    );
  }

  const billing = result.data;

  return (
    <>
      <PageHeader
        title="Billing"
        description="Revenue is summed only from provider-verified subscription amounts. Payment card details are never loaded."
      >
        <p className="text-[11px] text-slate-400">Generated {formatDate(billing.generatedAt)}</p>
      </PageHeader>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Monthly recurring revenue"
          value={formatMoney(billing.revenue.mrrCents, billing.revenue.currency)}
          hint={`${formatNumber(billing.revenue.counted)} verified subscriptions`}
          accent
        />
        <StatTile
          label="Active subscriptions"
          value={formatNumber(billing.subscriptions.active)}
          hint={`${formatNumber(billing.seats.billable)} billable seats`}
        />
        <StatTile
          label="Pro workspaces"
          value={formatNumber(billing.plans.pro)}
          hint={`${formatNumber(billing.plans.free)} on Free`}
        />
        <StatTile
          label="Collected to date"
          value={formatMoney(billing.payments.collectedCents)}
          hint={`${formatNumber(billing.payments.paid)} successful payments`}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel
          title="Plan breakdown"
          description="Effective plan, derived from the subscription row."
        >
          <dl className="space-y-2.5">
            {[
              { label: "Free", value: billing.plans.free },
              { label: "Pro", value: billing.plans.pro },
              { label: "Total workspaces", value: billing.plans.total },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between">
                <dt className="text-[13px] text-slate-600">{row.label}</dt>
                <dd className="text-[13px] font-medium text-slate-900 tabular-nums">
                  {formatNumber(row.value)}
                </dd>
              </div>
            ))}
          </dl>
        </Panel>

        <Panel
          title="Subscription status"
          description="Every status present in the table, most common first."
        >
          {billing.subscriptions.byStatus.length === 0 ? (
            <p className="text-[13px] text-slate-500">No subscription records yet.</p>
          ) : (
            <dl className="space-y-2.5">
              {billing.subscriptions.byStatus.map((row) => (
                <div key={row.status} className="flex items-center justify-between gap-3">
                  <dt>
                    <StatusPill tone={subscriptionTone(row.status)}>{row.status}</StatusPill>
                  </dt>
                  <dd className="text-[13px] font-medium text-slate-900 tabular-nums">
                    {formatNumber(row.count)}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {billing.subscriptions.lapsed > 0 ? (
            <p className="mt-4 border-t border-slate-100 pt-3 text-[12px] leading-5 text-amber-700">
              {formatNumber(billing.subscriptions.lapsed)} subscription
              {billing.subscriptions.lapsed === 1 ? "" : "s"} marked payable past a closed
              period — these fall back to Free on the next reconcile.
            </p>
          ) : null}
        </Panel>

        <Panel title="Payments" description="Outcome of recorded payment events.">
          <dl className="space-y-2.5">
            {(
              [
                ["paid", billing.payments.paid],
                ["failed", billing.payments.failed],
                ["refunded", billing.payments.refunded],
                ["pending", billing.payments.pending],
              ] as const
            ).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <dt>
                  <StatusPill tone={PAYMENT_TONE[status]}>{status}</StatusPill>
                </dt>
                <dd className="text-[13px] font-medium text-slate-900 tabular-nums">
                  {formatNumber(count)}
                </dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>

      {billing.revenue.unpriced > 0 || billing.revenue.otherCurrency > 0 ? (
        <Panel className="mt-4" title="Revenue notes">
          <ul className="space-y-1.5 text-[12px] leading-5 text-slate-600">
            {billing.revenue.unpriced > 0 ? (
              <li>
                {formatNumber(billing.revenue.unpriced)} active Pro subscription
                {billing.revenue.unpriced === 1 ? " has" : "s have"} no provider-verified
                amount and {billing.revenue.unpriced === 1 ? "is" : "are"} excluded from MRR
                rather than estimated.
              </li>
            ) : null}
            {billing.revenue.otherCurrency > 0 ? (
              <li>
                {formatNumber(billing.revenue.otherCurrency)} subscription
                {billing.revenue.otherCurrency === 1 ? " is" : "s are"} billed in a currency
                other than {billing.revenue.currency} and {billing.revenue.otherCurrency === 1 ? "is" : "are"}{" "}
                still summed at face value — verify before quoting the figure.
              </li>
            ) : null}
          </ul>
        </Panel>
      ) : null}

      <Panel
        title="Subscriptions"
        description="Renewal dates, seat counts and provider-reported amounts."
        className="mt-4"
        padded={false}
      >
        <DataTable>
          <thead>
            <tr>
              <Th>Workspace</Th>
              <Th>Owner</Th>
              <Th>Status</Th>
              <Th>Seats</Th>
              <Th>Amount</Th>
              <Th>Renews</Th>
              <Th>Last event</Th>
            </tr>
          </thead>
          <tbody>
            {billing.subscriptionsList.length === 0 ? (
              <EmptyRow colSpan={7}>
                No subscription records yet. Subscriptions appear once the first payment
                webhook is processed.
              </EmptyRow>
            ) : (
              billing.subscriptionsList.map((subscription) => (
                <tr key={subscription.id}>
                  <Td className="font-medium text-slate-900">
                    {subscription.workspaceName}
                  </Td>
                  <Td>{subscription.ownerEmail ?? <span className="text-slate-400">—</span>}</Td>
                  <Td>
                    <StatusPill tone={subscriptionTone(subscription.status)}>
                      {subscription.status}
                    </StatusPill>
                    {subscription.cancelAtPeriodEnd ? (
                      <span className="mt-0.5 block text-[11px] text-amber-700">
                        Cancels at period end
                      </span>
                    ) : null}
                  </Td>
                  <Td className="tabular-nums">{subscription.seats}</Td>
                  <Td className="tabular-nums">
                    {formatMoney(subscription.unitAmountCents, subscription.currency)}
                  </Td>
                  <Td className="tabular-nums text-slate-500">
                    {formatDate(subscription.currentPeriodEnd)}
                  </Td>
                  <Td className="text-slate-500">
                    {subscription.lastEventType ?? <span className="text-slate-400">—</span>}
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </DataTable>
      </Panel>
    </>
  );
}
