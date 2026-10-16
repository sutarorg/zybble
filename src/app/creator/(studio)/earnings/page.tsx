import Link from "next/link";
import {
  ArrowRight,
  BadgeIndianRupee,
  CircleDollarSign,
  HandCoins,
  Landmark,
  Lock,
  Percent,
  ReceiptIndianRupee,
  Wallet,
} from "lucide-react";
import { getCreatorEarningsSeries, getCreatorFinance } from "@/lib/server/creator";
import { formatInr, formatInrCompact } from "@/lib/money";
import { formatCount } from "@/lib/format";
import { StatCard } from "@/components/creator/stat-card";
import { AreaChart } from "@/components/creator/charts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "Earnings" };
export const dynamic = "force-dynamic";

const PAYOUT_TONE: Record<string, { variant: "violet" | "amber" | "emerald" | "sky" | "outline"; label: string }> = {
  requested: { variant: "amber", label: "Requested" },
  approved: { variant: "sky", label: "Approved" },
  paid: { variant: "emerald", label: "Paid" },
  rejected: { variant: "outline", label: "Rejected" },
  failed: { variant: "outline", label: "Failed" },
  cancelled: { variant: "outline", label: "Cancelled" },
};

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Creator earnings.
 *
 * This page is deliberately about money and nothing else — reach, views and
 * watch time live on Analytics, so the two pages never repeat each other. Every
 * figure is integer paise derived from captured learner orders, the immutable
 * ledger and confirmed manual payouts.
 */
export default async function CreatorEarningsPage() {
  const [finance, series] = await Promise.all([getCreatorFinance(), getCreatorEarningsSeries(6)]);

  const creatorShare = finance.commissionBps > 0 ? 100 - finance.commissionBps / 100 : 100;
  const chartData = series.map((point) => ({ label: point.label, value: point.creatorSharePaise }));
  const windowSales = series.reduce((total, point) => total + point.sales, 0);
  const windowGross = series.reduce((total, point) => total + point.grossPaise, 0);
  const windowShare = series.reduce((total, point) => total + point.creatorSharePaise, 0);
  const transfers = finance.transfers;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] leading-tight font-bold tracking-tight">Earnings</h1>
          <p className="mt-1.5 max-w-2xl text-[14px] text-muted-foreground">
            Money from captured learner orders, computed in integer paise. Platform commission is{" "}
            <span className="font-medium text-foreground">{finance.commissionPercentLabel}%</span> on
            new orders — your share is{" "}
            <span className="font-medium text-foreground">{creatorShare}%</span>, snapshotted per
            order so a later change never rewrites the past.
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/creator/payouts">
            Payouts & destination <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Button>
      </header>

      {/* Balance hero — the one number that decides whether a payout can be requested. */}
      <section className="overflow-hidden rounded-xl border border-primary/25 bg-gradient-to-br from-accent via-white to-white p-5 shadow-card sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-accent-foreground">
              <Wallet className="size-3.5" aria-hidden /> Available to request
            </p>
            <p className="font-display mt-2 text-[38px] leading-none font-bold tracking-tight tabular-nums sm:text-[44px]">
              {formatInr(finance.availablePaise)}
            </p>
            <p className="mt-2.5 max-w-md text-[12.5px] text-muted-foreground">
              {finance.destination ? (
                <>
                  Pays to your saved{" "}
                  <span className="font-medium text-foreground">
                    {finance.destination.method === "upi" ? "UPI ID" : "bank account"}
                  </span>{" "}
                  · <span className="font-mono">{finance.destination.maskedDestination}</span>. An
                  administrator reviews every request before it is paid.
                </>
              ) : (
                <>
                  Save a UPI ID or an Indian bank account on the Payouts page before requesting your
                  first payout.
                </>
              )}
            </p>
            <div className="mt-4">
              {finance.availablePaise > 0 ? (
                <Button asChild size="sm">
                  <Link href="/creator/payouts">
                    <HandCoins className="size-4" aria-hidden /> Request a payout
                  </Link>
                </Button>
              ) : (
                <Button size="sm" disabled title="No available earnings to request yet">
                  <HandCoins className="size-4" aria-hidden /> Nothing to request yet
                </Button>
              )}
            </div>
          </div>

          <dl className="grid w-full max-w-sm grid-cols-2 gap-2.5">
            <HeroStat
              icon={Lock}
              label="Reserved in requests"
              value={formatInr(finance.reservedPendingPaise)}
            />
            <HeroStat
              icon={Landmark}
              label="Paid out to you"
              value={formatInr(finance.paidOutPaise)}
            />
            <HeroStat
              icon={ReceiptIndianRupee}
              label="Outstanding payable"
              value={formatInr(finance.outstandingPayablePaise)}
              span
            />
          </dl>
        </div>
      </section>

      {finance.negativeAdjustmentPaise > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-[13px] text-amber-900">
          <p className="font-semibold">Balance offset of {formatInr(finance.negativeAdjustmentPaise)}</p>
          <p className="mt-1 text-amber-800">
            A confirmed payout exceeded the earnings that were available for it. Zybble records the
            difference as an offset against your future earnings instead of showing a negative
            balance, and never fabricates a bank clawback.
          </p>
        </div>
      ) : null}

      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={BadgeIndianRupee}
          label="Gross sales"
          value={formatInrCompact(finance.grossPaise)}
          hint="all captured orders"
        />
        <StatCard
          icon={Percent}
          label={`Platform commission (${finance.commissionPercentLabel}%)`}
          value={formatInrCompact(finance.commissionPaise)}
        />
        <StatCard
          icon={CircleDollarSign}
          label="Net creator share"
          value={formatInrCompact(finance.netEarnedPaise)}
          hint={`${creatorShare}% of gross`}
        />
        <StatCard
          icon={HandCoins}
          label="Last 6 months"
          value={formatInrCompact(windowShare)}
          hint={`${formatCount(windowSales)} sales · ${formatInrCompact(windowGross)} gross`}
        />
      </div>

      <section className="rounded-xl border border-border bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-[15px] font-semibold tracking-tight">Your share by month</h2>
          <p className="text-[12px] text-muted-foreground">
            After {finance.commissionPercentLabel}% commission · current month still open
          </p>
        </div>
        {windowShare === 0 ? (
          <EmptyState
            className="mt-4 border-0 bg-muted/30 py-10"
            icon={BadgeIndianRupee}
            title="No earnings in the last six months"
            description="Sales appear here as soon as a learner payment is captured and verified on the server."
          />
        ) : (
          <>
            <AreaChart className="mt-4" data={chartData} valueFormat="money" />
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead className="border-b border-border text-[11.5px] tracking-wide text-muted-foreground uppercase">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Month</th>
                    <th className="px-3 py-2 text-right font-medium">Sales</th>
                    <th className="px-3 py-2 text-right font-medium">Gross</th>
                    <th className="px-3 py-2 text-right font-medium">Commission</th>
                    <th className="py-2 pl-3 text-right font-medium">Your share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {series.map((point) => (
                    <tr key={point.key} className="hover:bg-muted/30">
                      <td className="py-2.5 pr-3 font-medium">{point.label}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatCount(point.sales)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatInr(point.grossPaise)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                        {formatInr(point.commissionPaise)}
                      </td>
                      <td className="py-2.5 pl-3 text-right font-semibold tabular-nums">
                        {formatInr(point.creatorSharePaise)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-white shadow-card">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-5 py-4">
          <div>
            <h2 className="font-display text-[15px] font-semibold tracking-tight">Course revenue</h2>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Captured learner orders grouped by course, all-time.
            </p>
          </div>
          <span className="text-[12px] text-muted-foreground">
            {finance.courseBreakdown.length} {finance.courseBreakdown.length === 1 ? "course" : "courses"} with sales
          </span>
        </div>

        {finance.courseBreakdown.length === 0 ? (
          <EmptyState
            className="border-0 bg-white"
            icon={ReceiptIndianRupee}
            title="No captured sales yet"
            description="Once a learner's payment is captured, its course appears here with the commission already split out."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-muted/40 text-[11.5px] tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Course</th>
                  <th className="px-3 py-2.5 text-right font-medium">Sales</th>
                  <th className="px-3 py-2.5 text-right font-medium">Gross</th>
                  <th className="px-3 py-2.5 text-right font-medium">Commission</th>
                  <th className="px-5 py-2.5 text-right font-medium">Your share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {finance.courseBreakdown.map((row) => (
                  <tr key={row.courseId} className="hover:bg-muted/30">
                    <td className="max-w-[320px] px-5 py-3">
                      <p className="truncate font-medium">{row.courseTitle}</p>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatCount(row.salesCount)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatInr(row.grossPaise)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                      {formatInr(row.commissionPaise)}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums">
                      {formatInr(row.creatorSharePaise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-white shadow-card">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-5 py-4">
          <div>
            <h2 className="font-display text-[15px] font-semibold tracking-tight">Payout ledger</h2>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Requests, masked destination snapshots, and UTR references.
            </p>
          </div>
          <span className="text-[12px] text-muted-foreground">
            {finance.payoutRequests.length} {finance.payoutRequests.length === 1 ? "request" : "requests"}
          </span>
        </div>

        {finance.payoutRequests.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-[13px] text-muted-foreground">
              No payout requests yet.{" "}
              <Link href="/creator/payouts" className="font-medium text-foreground underline">
                Save a destination
              </Link>{" "}
              and request a payout when you have available earnings.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-muted/40 text-[11.5px] tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Request</th>
                  <th className="px-3 py-2.5 font-medium">Destination</th>
                  <th className="px-3 py-2.5 text-right font-medium">Amount</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 font-medium">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {finance.payoutRequests.map((request) => {
                  const tone = PAYOUT_TONE[request.status] ?? { variant: "outline" as const, label: request.status };
                  return (
                    <tr key={request.id} className="hover:bg-muted/30">
                      <td className="px-5 py-3">
                        <p className="font-mono text-[11.5px]">{request.publicId}</p>
                        <p className="mt-0.5 text-[12px] text-muted-foreground">
                          Requested {formatDate(request.requestedAt)}
                          {request.paidAt ? ` · paid ${formatDate(request.paidAt)}` : null}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-mono text-[12px]">{request.destinationMasked}</p>
                        <p className="mt-0.5 text-[11.5px] text-muted-foreground uppercase">
                          {request.destinationMethod === "upi" ? "UPI" : request.destinationMethod}
                          {request.destinationBankLabel ? ` · ${request.destinationBankLabel}` : ""}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums">
                        {formatInr(request.amountPaise)}
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant={tone.variant}>{tone.label}</Badge>
                        {request.rejectionReason ? (
                          <p className="mt-1 max-w-[220px] text-[11.5px] text-muted-foreground">
                            {request.rejectionReason}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-5 py-3 font-mono text-[11.5px] text-muted-foreground">
                        {request.paymentReference ?? request.failureReason ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {transfers.length > 0 ? (
        <section className="overflow-hidden rounded-xl border border-border bg-white shadow-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-display text-[15px] font-semibold tracking-tight">Legacy transfers</h2>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Historical automated transfers kept for the record. New payouts are manual requests.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-muted/40 text-[11.5px] tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Course</th>
                  <th className="px-3 py-2.5 font-medium">Transfer</th>
                  <th className="px-3 py-2.5 text-right font-medium">Amount</th>
                  <th className="px-3 py-2.5 text-right font-medium">Reversed</th>
                  <th className="px-5 py-2.5 font-medium">Settlement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transfers.map((transfer) => (
                  <tr key={transfer.transferId} className="hover:bg-muted/30">
                    <td className="max-w-[260px] px-5 py-3">
                      <p className="truncate font-medium">{transfer.courseTitle}</p>
                    </td>
                    <td className="px-3 py-3 font-mono text-[11.5px]">{transfer.transferId}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatInr(transfer.amountPaise)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                      {transfer.reversedPaise > 0 ? formatInr(transfer.reversedPaise) : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant="outline">{transfer.settlementStatus ?? transfer.status}</Badge>
                      {transfer.settledAt ? (
                        <p className="mt-1 text-[11.5px] text-muted-foreground">
                          {formatDate(transfer.settledAt)}
                        </p>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <p className="text-[12px] leading-relaxed text-zinc-400">
        Gross sales count only learner orders whose payment was captured and verified on the server.
        Commission is the rate snapshotted on each order item at purchase time. Available earnings are
        net creator share minus confirmed payouts minus amounts reserved by open requests, and never
        go negative. Figures are exact integer paise — nothing here is estimated or rounded early.
      </p>
    </div>
  );
}

function HeroStat({
  icon: Icon,
  label,
  value,
  span = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  span?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border border-border/70 bg-white/80 px-3.5 py-3 ${span ? "col-span-2" : ""}`}
    >
      <p className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
        <Icon className="size-3.5 text-primary" aria-hidden />
        {label}
      </p>
      <p className="font-display mt-1.5 text-[19px] leading-none font-bold tabular-nums">{value}</p>
    </div>
  );
}
