import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getCreatorFinance } from "@/lib/server/creator";
import { formatInr } from "@/lib/money";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function CreatorEarningsPage() {
  const finance = await getCreatorFinance();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Earnings & ledger</h1>
          <p className="mt-1 text-xs text-muted-foreground max-w-2xl">
            Every figure below is computed in integer paise from captured learner orders,
            processed refunds, and confirmed manual payouts. Platform commission is{" "}
            {finance.commissionPercentLabel}% on new orders; your creator share is{" "}
            {100 - finance.commissionBps / 100}%.
          </p>
        </div>
        <Button asChild size="sm" variant="outline" className="gap-1.5">
          <Link href="/creator/payouts">
            Manage destination & request payout <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Metric label="Gross sales" value={formatInr(finance.grossPaise)} />
        <Metric
          label={`Commission (${finance.commissionPercentLabel}%)`}
          value={formatInr(finance.commissionPaise)}
        />
        <Metric
          label="Net creator share"
          value={formatInr(finance.netEarnedPaise)}
          sub={
            finance.refundedCreatorSharePaise > 0
              ? `After ${formatInr(finance.refundedCreatorSharePaise)} refund adjustments`
              : undefined
          }
        />
        <Metric
          label="Available to request"
          value={formatInr(finance.availablePaise)}
          highlight
        />
        <Metric
          label="Reserved in requests"
          value={formatInr(finance.reservedPendingPaise)}
        />
        <Metric label="Paid out to you" value={formatInr(finance.paidOutPaise)} />
      </div>

      {finance.negativeAdjustmentPaise > 0 ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-amber-800 dark:text-amber-300">
          <strong>Post-payout refund adjustment:</strong> {formatInr(finance.negativeAdjustmentPaise)}{" "}
          from a learner refund recorded after a manual payout is tracked as a receivable offset
          against future course earnings. Zybble never silently fabricates a bank clawback.
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border px-5 py-3.5 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Course revenue breakdown</h2>
            <p className="text-xs text-muted-foreground">
              Captured learner orders grouped by course.
            </p>
          </div>
          <span className="text-xs text-muted-foreground">
            {finance.courseBreakdown.length} courses with sales
          </span>
        </div>

        {finance.courseBreakdown.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No captured course sales yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Course</th>
                  <th className="px-4 py-2.5 font-medium text-right">Captured sales</th>
                  <th className="px-4 py-2.5 font-medium text-right">Gross (INR)</th>
                  <th className="px-4 py-2.5 font-medium text-right">Commission</th>
                  <th className="px-4 py-2.5 font-medium text-right">Your share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {finance.courseBreakdown.map((row) => (
                  <tr key={row.courseId}>
                    <td className="px-4 py-3 font-medium">{row.courseTitle}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.salesCount}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatInr(row.grossPaise)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {formatInr(row.commissionPaise)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      {formatInr(row.creatorSharePaise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border px-5 py-3.5 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Manual payout ledger</h2>
            <p className="text-xs text-muted-foreground">
              Payout requests, masked destination snapshots, and UTR / transaction references.
            </p>
          </div>
          <span className="text-xs text-muted-foreground">
            {finance.payoutRequests.length} requests
          </span>
        </div>

        {finance.payoutRequests.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No manual payout requests yet. Visit{" "}
            <Link href="/creator/payouts" className="underline font-medium text-foreground">
              Payouts & destination
            </Link>{" "}
            to save a UPI ID or bank account and request a payout when you have available earnings.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Payout ID</th>
                  <th className="px-4 py-2.5 font-medium">Requested</th>
                  <th className="px-4 py-2.5 font-medium">Destination</th>
                  <th className="px-4 py-2.5 font-medium text-right">Amount</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">UTR / Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {finance.payoutRequests.map((req) => (
                  <tr key={req.id}>
                    <td className="px-4 py-3 font-mono text-[11px]">{req.publicId}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(req.requestedAt).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-4 py-3">
                      <span className="uppercase text-[10.5px] text-muted-foreground">
                        {req.destinationMethod}
                      </span>{" "}
                      <span className="font-mono">{req.destinationMasked}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {formatInr(req.amountPaise)}
                    </td>
                    <td className="px-4 py-3 capitalize">{req.status}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                      {req.paymentReference ?? req.rejectionReason ?? req.failureReason ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
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
        highlight ? "border-primary/40 bg-primary/5" : "border-border bg-card"
      }`}
    >
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-lg font-bold tabular-nums">{value}</p>
      {sub ? <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p> : null}
    </div>
  );
}
