"use client";

import { LocalizedText, useTranslate } from "@/components/providers/localized-text";
import * as React from "react";
import { useMemo, useState } from "react";
import { Download, Info, Percent, SearchX, TrendingUp, Wallet, Clock3 } from "lucide-react";
import { toast } from "sonner";
import { useCreator } from "@/components/providers/creator-provider";
import { moneyExact, PLATFORM_COMMISSION } from "@/lib/creator";
import { formatDate } from "@/lib/format";
import { StatCard } from "@/components/creator/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { EarningTransaction } from "@/types";

function TxStatusBadge({ status }: { status: EarningTransaction["status"] }) {
  if (status === "paid") return <Badge variant="emerald"><LocalizedText text={"Paid"} /></Badge>;
  if (status === "pending") return <Badge variant="amber"><LocalizedText text={"Pending"} /></Badge>;
  return <Badge variant="secondary"><LocalizedText text={"Refunded"} /></Badge>;
}

export default function EarningsPage() {
  const translateUi = useTranslate();
  const { hydrated, transactions, finances, courses } = useCreator();
  const [status, setStatus] = useState("all");
  const [courseId, setCourseId] = useState("all");

  const filtered = useMemo(
    () =>
      transactions.filter((t) => {
        if (status !== "all" && t.status !== status) return false;
        if (courseId !== "all" && t.courseId !== courseId) return false;
        return true;
      }),
    [transactions, status, courseId]
  );

  const totals = useMemo(
    () => ({
      gross: filtered.reduce((a, t) => a + t.gross, 0),
      commission: filtered.reduce((a, t) => a + t.commission, 0),
      net: filtered.reduce((a, t) => a + t.net, 0),
    }),
    [filtered]
  );

  const exportCsv = () => {
    const header = "Date,Course,Order,Status,Gross,Commission,Net\n";
    const rows = filtered
      .map((t) =>
        [
          new Date(t.date).toISOString().slice(0, 10),
          `"${t.courseTitle.replace(/"/g, '""')}"`,
          t.orderRef,
          t.status,
          t.gross.toFixed(2),
          t.commission.toFixed(2),
          t.net.toFixed(2),
        ].join(",")
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "zybble-earnings-preview.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported (sample data)");
  };

  if (!hydrated) {
    return (
      <div aria-busy>
        <Skeleton className="h-9 w-56" />
        <Skeleton className="mt-6 h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold tracking-[0.14em] text-primary uppercase"><LocalizedText text={"Creator Studio"} /></p>
          <h1 className="font-display mt-1.5 text-[26px] font-bold tracking-tight sm:text-3xl"><LocalizedText text={"Earnings"} /></h1>
          <p className="mt-1.5 max-w-xl text-[14px] text-muted-foreground"><LocalizedText text={"Your sales ledger with the"} />{Math.round(PLATFORM_COMMISSION * 100)}<LocalizedText text={"% marketplace commission applied. All amounts are illustrative sample data in USD."} /></p>
        </div>
        <Button variant="outline" onClick={exportCsv}>
          <Download aria-hidden /><LocalizedText text={"Export CSV"} /></Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={TrendingUp} label={translateUi("Gross sales")} value={moneyExact(finances.lifetimeGross)} hint="all time" />
        <StatCard icon={Percent} label={translateUi("Platform commission")} value={moneyExact(finances.lifetimeCommission)} hint="10% of gross" />
        <StatCard icon={Wallet} label={translateUi("Your share")} value={moneyExact(finances.lifetimeNet)} hint="before fees & taxes" />
        <StatCard icon={Clock3} label={translateUi("Pending balance")} value={moneyExact(finances.pendingEarnings)} hint="clearing soon" />
      </div>

      {/* Ledger */}
      <section className="overflow-hidden rounded-xl border border-border bg-white shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 className="font-display text-[15.5px] font-semibold"><LocalizedText text={"Transaction ledger"} /></h2>
          <div className="flex items-center gap-2">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-8.5 w-36 text-[12.5px]" aria-label={translateUi("Filter by status")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="all"><LocalizedText text={"All statuses"} /></SelectItem>
                <SelectItem value="paid"><LocalizedText text={"Paid"} /></SelectItem>
                <SelectItem value="pending"><LocalizedText text={"Pending"} /></SelectItem>
                <SelectItem value="refunded"><LocalizedText text={"Refunded"} /></SelectItem>
              </SelectContent>
            </Select>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger className="h-8.5 w-52 text-[12.5px]" aria-label={translateUi("Filter by course")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="all"><LocalizedText text={"All courses"} /></SelectItem>
                {courses
                  .filter((c) => c.price > 0)
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <LocalizedText text={c.title} />
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={SearchX}
              title={translateUi("No transactions match")}
              description={translateUi("Try clearing the filters — or publish a paid course to start the (simulated) sales rolling.")}
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-200 text-left">
                <thead>
                  <tr className="border-b border-border text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
                    <th className="py-3 pr-4 pl-5"><LocalizedText text={"Date"} /></th>
                    <th className="px-4 py-3"><LocalizedText text={"Course"} /></th>
                    <th className="px-4 py-3"><LocalizedText text={"Order"} /></th>
                    <th className="px-4 py-3"><LocalizedText text={"Status"} /></th>
                    <th className="px-4 py-3 text-right"><LocalizedText text={"Gross"} /></th>
                    <th className="px-4 py-3 text-right"><LocalizedText text={"Commission"} /></th>
                    <th className="py-3 pr-5 pl-4 text-right"><LocalizedText text={"Net"} /></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => (
                    <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                      <td className="py-3 pr-4 pl-5 text-[12.5px] whitespace-nowrap text-muted-foreground">
                        <LocalizedText text={formatDate(t.date)} />
                      </td>
                      <td className="max-w-56 px-4 py-3">
                        <span className="block truncate text-[13px] font-medium"><LocalizedText text={t.courseTitle} /></span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[12px] text-muted-foreground"><LocalizedText text={t.orderRef} /></td>
                      <td className="px-4 py-3">
                        <TxStatusBadge status={t.status} />
                      </td>
                      <td className={cn("px-4 py-3 text-right text-[13px] tabular-nums", t.status === "refunded" && "text-zinc-400 line-through")}>
                        <LocalizedText text={moneyExact(t.gross)} />
                      </td>
                      <td className="px-4 py-3 text-right text-[13px] text-zinc-500 tabular-nums">
                        −<LocalizedText text={moneyExact(t.commission)} />
                      </td>
                      <td className={cn("py-3 pr-5 pl-4 text-right text-[13px] font-semibold tabular-nums", t.status === "refunded" ? "text-zinc-400" : "text-success")}>
                        <LocalizedText text={moneyExact(t.net)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Totals */}
            <div className="flex flex-wrap items-center justify-end gap-x-8 gap-y-1 border-t border-border bg-muted/40 px-5 py-3.5 text-[13px]">
              <span className="text-muted-foreground">
                {filtered.length} {filtered.length === 1 ? "transaction" : "transactions"}<LocalizedText text={"· filtered totals:"} /></span>
              <span><LocalizedText text={"Gross"} /><strong className="tabular-nums"><LocalizedText text={moneyExact(totals.gross)} /></strong>
              </span>
              <span><LocalizedText text={"Commission"} /><strong className="tabular-nums text-zinc-500">−<LocalizedText text={moneyExact(totals.commission)} /></strong>
              </span>
              <span><LocalizedText text={"Net"} /><strong className="tabular-nums text-success"><LocalizedText text={moneyExact(totals.net)} /></strong>
              </span>
            </div>
          </>
        )}
      </section>

      <p className="flex items-center gap-1.5 text-[12px] text-zinc-400">
        <Info className="size-3.5" aria-hidden /><LocalizedText text={"Ledger entries are generated sample data. A $20 sale = $2 platform commission + $18 creator share, before payment fees, taxes, refunds or adjustments."} /></p>
    </div>
  );
}
