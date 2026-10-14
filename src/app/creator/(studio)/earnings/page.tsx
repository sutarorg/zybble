import { Landmark, TrendingDown, Wallet } from "lucide-react";
import { getCreatorFinance } from "@/lib/server/creator";
import { money } from "@/lib/creator";
import { StatCard } from "@/components/creator/stat-card";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "Earnings" };
export const dynamic = "force-dynamic";

const TRANSFER_TONE: Record<string, string> = {
  processed: "text-emerald-700",
  queued: "text-amber-700",
  pending: "text-amber-700",
  created: "text-amber-700",
  failed: "text-red-700",
  reversed: "text-red-700",
  partially_reversed: "text-orange-700",
};

export default async function CreatorEarningsPage() {
  const finance = await getCreatorFinance();
  const hasSales = finance.grossPaise > 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-[26px] leading-tight font-bold tracking-tight">Earnings</h1>
        <p className="mt-1.5 text-[14px] text-muted-foreground">
          Every figure is derived from order items and verified Razorpay Route transfers. Amounts are INR (₹),
          stored as integer paise.
        </p>
      </header>

      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Wallet} label="Net earnings" value={money(finance.netEarnedPaise)} />
        <StatCard
          icon={TrendingDown}
          label="Zybble commission"
          value={money(finance.commissionPaise)}
          hint={`${finance.commissionPercentLabel}% of gross`}
        />
        <StatCard icon={Landmark} label="Transferred to your Route account" value={money(finance.transferredPaise)} />
        <StatCard icon={Landmark} label="Settled in your bank account" value={money(finance.settledPaise)} />
      </div>

      <section className="rounded-xl border border-border bg-white p-5 shadow-card">
        <h2 className="font-display text-[15px] font-semibold tracking-tight">Route transfers</h2>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          Each row is a transfer Razorpay actually created. Settlement to your bank follows Razorpay&apos;s
          own timeline and is never assumed here.
        </p>

        {finance.transfers.length === 0 ? (
          <EmptyState
            className="mt-4"
            icon={Landmark}
            title={hasSales ? "No transfers yet" : "No sales yet"}
            description={
              hasSales
                ? "Transfers are created once a learner's payment is verified. Razorpay Route settles these on its own schedule."
                : "Once a learner buys one of your courses, your share and the matching Route transfer appear here."
            }
          />
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-border text-[12px] text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Course</th>
                  <th className="py-2 pr-4 font-medium">Transfer id</th>
                  <th className="py-2 pr-4 text-right font-medium">Amount</th>
                  <th className="py-2 pr-4 font-medium">Transfer status</th>
                  <th className="py-2 pr-4 font-medium">Settlement</th>
                  <th className="py-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {finance.transfers.map((transfer) => (
                  <tr key={transfer.transferId}>
                    <td className="py-3 pr-4 font-medium">{transfer.courseTitle}</td>
                    <td className="py-3 pr-4 font-mono text-[11.5px] text-muted-foreground">
                      {transfer.transferId}
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums">
                      {money(transfer.amountPaise)}
                      {transfer.reversedPaise > 0 ? (
                        <span className="block text-[11.5px] text-red-600">
                          −{money(transfer.reversedPaise)} reversed
                        </span>
                      ) : null}
                    </td>
                    <td className={`py-3 pr-4 ${TRANSFER_TONE[transfer.status] ?? "text-muted-foreground"}`}>
                      {transfer.status}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {transfer.settlementStatus ? (
                        <>
                          {transfer.settlementStatus}
                          {transfer.settledAt ? (
                            <span className="block text-[11.5px]">
                              {new Date(transfer.settledAt).toLocaleDateString("en-IN")}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        "not reported yet"
                      )}
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {new Date(transfer.createdAt).toLocaleDateString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-white p-5 shadow-card">
        <h2 className="font-display text-[15px] font-semibold tracking-tight">How your share is calculated</h2>
        <dl className="mt-4 space-y-3 text-[13px]">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted-foreground">Gross course sales</dt>
            <dd className="font-medium tabular-nums">{money(finance.grossPaise)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted-foreground">
              Zybble commission at {finance.commissionPercentLabel}% (server-configurable, snapshotted per order)
            </dt>
            <dd className="font-medium tabular-nums text-red-600">−{money(finance.commissionPaise)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-t border-border pt-3">
            <dt className="font-medium">Net earned</dt>
            <dd className="font-display text-[15px] font-bold tabular-nums">{money(finance.netEarnedPaise)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted-foreground">Pending with Razorpay (not yet transferred)</dt>
            <dd className="tabular-nums">{money(finance.pendingPaise)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted-foreground">Reversed</dt>
            <dd className="tabular-nums text-red-600">{money(finance.reversedPaise)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted-foreground">Refunded to learners</dt>
            <dd className="tabular-nums text-red-600">{money(finance.refundPaise)}</dd>
          </div>
        </dl>
        <p className="mt-4 text-[12px] text-zinc-400">
          Zybble does not publish a refund policy. A refund can only exist because Razorpay recorded one, and the
          numbers above reflect those provider events exactly.
        </p>
      </section>
    </div>
  );
}