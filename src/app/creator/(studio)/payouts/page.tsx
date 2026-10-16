import { getCreatorFinance } from "@/lib/server/creator";
import { isPayoutEncryptionConfigured } from "@/lib/env";
import { formatInr } from "@/lib/money";
import {
  PayoutDestinationForm,
  PayoutRequestPanel,
} from "./payout-destination-form";

export const dynamic = "force-dynamic";

export default async function CreatorPayoutsPage() {
  const finance = await getCreatorFinance();
  const encryptionReady = isPayoutEncryptionConfigured();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Payouts & destination</h1>
        <p className="mt-1 text-xs text-muted-foreground max-w-2xl">
          Learners pay Zybble in INR through standard Razorpay Checkout. Zybble deducts the{" "}
          {finance.commissionPercentLabel}% marketplace commission on each captured order and
          credits the remaining {100 - finance.commissionBps / 100}% to your creator balance. Save a
          UPI ID or Indian bank account below to request manual payouts of your available balance.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Metric
          label="Gross course sales"
          value={formatInr(finance.grossPaise)}
          sub={`Before ${finance.commissionPercentLabel}% commission`}
        />
        <Metric
          label="Net creator share"
          value={formatInr(finance.netEarnedPaise)}
          sub="Captured sales less commission"
        />
        <Metric
          label="Available to request"
          value={formatInr(finance.availablePaise)}
          sub="Unreserved payable balance"
          highlight
        />
        <Metric
          label="Reserved in requests"
          value={formatInr(finance.reservedPendingPaise)}
          sub="Requested or approved"
        />
        <Metric
          label="Total paid out"
          value={formatInr(finance.paidOutPaise)}
          sub="Confirmed manual transfers"
        />
      </div>

      <PayoutDestinationForm
        currentDestination={finance.destination}
        encryptionReady={encryptionReady}
      />

      <PayoutRequestPanel
        availablePaise={finance.availablePaise}
        reservedPendingPaise={finance.reservedPendingPaise}
        negativeAdjustmentPaise={finance.negativeAdjustmentPaise}
        currentDestination={finance.destination}
        requests={finance.payoutRequests}
      />
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  highlight = false,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-card"
      }`}
    >
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-lg font-bold tabular-nums">{value}</p>
      {sub ? <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p> : null}
    </div>
  );
}
