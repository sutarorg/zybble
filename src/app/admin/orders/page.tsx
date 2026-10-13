"use client";

import { LocalizedText, useTranslate } from "@/components/providers/localized-text";
import * as React from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpDown,
  CalendarDays,
  CreditCard,
  Download,
  Info,
  Search,
  SearchX,
} from "lucide-react";
import { toast } from "sonner";
import type { AdminOrder } from "@/types";
import { useAdmin } from "@/components/providers/admin-provider";
import { commissionOf, downloadCsv } from "@/lib/admin";
import { formatDate, formatPrice } from "@/lib/format";
import { money } from "@/lib/creator";
import { AdminDrawer } from "@/components/admin/admin-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type Sort = "date" | "gross" | "course";
const DAYS: { id: string; label: string; days: number | null }[] = [
  { id: "7", label: "7 days", days: 7 },
  { id: "30", label: "30 days", days: 30 },
  { id: "90", label: "90 days", days: 90 },
  { id: "all", label: "All time", days: null },
];

function StatusBadge({ status }: { status: AdminOrder["status"] }) {
  if (status === "paid") return <Badge variant="emerald"><LocalizedText text={"Paid"} /></Badge>;
  if (status === "pending") return <Badge variant="amber"><LocalizedText text={"Pending"} /></Badge>;
  if (status === "refunded") return <Badge variant="secondary"><LocalizedText text={"Refunded"} /></Badge>;
  return <Badge className="border-red-200 bg-red-50 text-red-600"><LocalizedText text={"Failed"} /></Badge>;
}

export default function AdminOrdersPage() {
  const translateUi = useTranslate();
  const { hydrated, orders, settings } = useAdmin();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [days, setDays] = useState("all");
  const [sort, setSort] = useState<Sort>("date");
  const [selected, setSelected] = useState<AdminOrder | null>(null);

  /**
   * preview data is historical, so "last N days" is measured from the newest order
   * in the dataset rather than from the wall clock — otherwise the filter would
   * always return an empty table.
   */
  const newestOrderAt = useMemo(
    () => orders.reduce((latest, o) => Math.max(latest, +new Date(o.date)), 0),
    [orders]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const cutoff = DAYS.find((d) => d.id === days)?.days;
    let list = orders.filter((o) => {
      if (status !== "all" && o.status !== status) return false;
      if (cutoff && newestOrderAt - +new Date(o.date) > cutoff * 86400_000) return false;
      if (q && !`${o.orderRef} ${o.learnerName} ${o.courseTitle} ${o.creatorName}`.toLowerCase().includes(q)) return false;
      return true;
    });
    return [...list].sort((a, b) => {
      if (sort === "gross") return b.gross - a.gross;
      if (sort === "course") return a.courseTitle.localeCompare(b.courseTitle);
      return +new Date(b.date) - +new Date(a.date);
    });
  }, [orders, newestOrderAt, query, status, days, sort]);

  const totals = useMemo(() => {
    const paid = filtered.filter((o) => o.status === "paid" || o.status === "pending");
    const gross = paid.reduce((a, o) => a + o.gross, 0);
    return {
      gross,
      commission: commissionOf(gross, settings.commissionRate),
      share: gross - commissionOf(gross, settings.commissionRate),
      count: filtered.length,
    };
  }, [filtered, settings.commissionRate]);

  const exportCsv = () => {
    downloadCsv(
      "zybble-admin-orders-preview.csv",
      ["Order", "Date", "Learner", "Course", "Creator", "Gross", "Commission", "Creator share", "Status", "Method"],
      filtered.map((o) => [o.orderRef, o.date.slice(0, 10), o.learnerName, o.courseTitle, o.creatorName, o.gross.toFixed(2), o.commission.toFixed(2), o.creatorShare.toFixed(2), o.status, o.method])
    );
    toast.success("CSV exported (sample data)");
  };

  if (!hydrated) return <Skeleton className="h-96 rounded-xl" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold tracking-[0.14em] text-primary uppercase"><LocalizedText text={"Marketplace"} /></p>
          <h1 className="font-display mt-1.5 text-[26px] font-bold tracking-tight sm:text-3xl"><LocalizedText text={"Orders"} /></h1>
          <p className="mt-1.5 max-w-2xl text-[14px] text-muted-foreground"><LocalizedText text={"Marketplace-wide simulated orders. Commission uses the configured"} /><LocalizedText text={" "} />
            {Math.round(settings.commissionRate * 100)}<LocalizedText text={"% rate from Settings."} /></p>
        </div>
        <Button variant="outline" onClick={exportCsv}>
          <Download aria-hidden /><LocalizedText text={"Export CSV"} /></Button>
      </div>

      {/* Totals strip */}
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "Filtered orders", value: String(totals.count) },
          { label: "Gross (paid+pending)", value: money(totals.gross) },
          { label: `Commission (${Math.round(settings.commissionRate * 100)}%)`, value: money(totals.commission) },
          { label: "Creator share", value: money(totals.share) },
        ].map((t) => (
          <div key={t.label} className="rounded-xl border border-border bg-white px-5 py-4 shadow-card">
            <p className="font-display text-[19px] font-bold tracking-tight tabular-nums"><LocalizedText text={t.value} /></p>
            <p className="mt-0.5 text-[12px] text-muted-foreground"><LocalizedText text={t.label} /></p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={translateUi("Search order, learner, course, creator…")}
            aria-label={translateUi("Search orders")}
            className="h-9.5 w-full rounded-lg border border-input bg-white pr-3 pl-9 text-sm shadow-xs outline-none placeholder:text-zinc-400 focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/20 [&::-webkit-search-cancel-button]:hidden"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-36" aria-label={translateUi("Filter by status")}><SelectValue /></SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="all"><LocalizedText text={"All statuses"} /></SelectItem>
            <SelectItem value="paid"><LocalizedText text={"Paid"} /></SelectItem>
            <SelectItem value="pending"><LocalizedText text={"Pending"} /></SelectItem>
            <SelectItem value="refunded"><LocalizedText text={"Refunded"} /></SelectItem>
            <SelectItem value="failed"><LocalizedText text={"Failed"} /></SelectItem>
          </SelectContent>
        </Select>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-36" aria-label={translateUi("Filter by date range")}>
            <CalendarDays className="size-3.5 text-zinc-400" aria-hidden />
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {DAYS.map((d) => (
              <SelectItem key={d.id} value={d.id}><LocalizedText text={d.label} /></SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
          <SelectTrigger className="w-40" aria-label={translateUi("Sort orders")}>
            <ArrowUpDown className="size-3.5 text-zinc-400" aria-hidden />
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="date"><LocalizedText text={"Newest first"} /></SelectItem>
            <SelectItem value="gross"><LocalizedText text={"Highest gross"} /></SelectItem>
            <SelectItem value="course"><LocalizedText text={"Course A–Z"} /></SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={translateUi("No orders match")}
          description={translateUi("Try broadening the date range, status or search.")}
          action={
            <Button variant="outline" onClick={() => { setQuery(""); setStatus("all"); setDays("all"); }}><LocalizedText text={"Clear filters"} /></Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-white shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-220 text-left">
              <thead>
                <tr className="border-b border-border text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
                  <th className="py-3 pr-4 pl-5"><LocalizedText text={"Order"} /></th>
                  <th className="px-4 py-3"><LocalizedText text={"Learner"} /></th>
                  <th className="px-4 py-3"><LocalizedText text={"Course"} /></th>
                  <th className="px-4 py-3"><LocalizedText text={"Creator"} /></th>
                  <th className="px-4 py-3 text-right"><LocalizedText text={"Gross"} /></th>
                  <th className="px-4 py-3 text-right"><LocalizedText text={"Commission"} /></th>
                  <th className="px-4 py-3 text-right"><LocalizedText text={"Share"} /></th>
                  <th className="px-4 py-3"><LocalizedText text={"Date"} /></th>
                  <th className="px-4 py-3"><LocalizedText text={"Status"} /></th>
                  <th className="py-3 pr-5 pl-4 text-right"><span className="sr-only"><LocalizedText text={"View"} /></span></th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 24).map((o) => (
                  <tr key={o.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="py-3 pr-4 pl-5 font-mono text-[11.5px] whitespace-nowrap text-zinc-500"><LocalizedText text={o.orderRef} /></td>
                    <td className="max-w-36 truncate px-4 py-3 text-[12.5px]"><LocalizedText text={o.learnerName} /></td>
                    <td className="max-w-48 truncate px-4 py-3 text-[12.5px] text-muted-foreground"><LocalizedText text={o.courseTitle} /></td>
                    <td className="max-w-36 truncate px-4 py-3 text-[12.5px] text-muted-foreground"><LocalizedText text={o.creatorName} /></td>
                    <td className="px-4 py-3 text-right text-[12.5px] font-semibold tabular-nums"><LocalizedText text={formatPrice(o.gross)} /></td>
                    <td className="px-4 py-3 text-right text-[12.5px] text-zinc-500 tabular-nums">−<LocalizedText text={formatPrice(o.commission)} /></td>
                    <td className="px-4 py-3 text-right text-[12.5px] text-success tabular-nums"><LocalizedText text={formatPrice(o.creatorShare)} /></td>
                    <td className="px-4 py-3 text-[12px] whitespace-nowrap text-muted-foreground"><LocalizedText text={formatDate(o.date)} /></td>
                    <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                    <td className="py-3 pr-5 pl-4 text-right">
                      <Button variant="outline" size="sm" onClick={() => setSelected(o)}><LocalizedText text={"View"} /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length > 24 && (
            <p className="border-t border-border bg-muted/40 px-5 py-2.5 text-[12px] text-zinc-400"><LocalizedText text={"Showing 24 of"} />{filtered.length}<LocalizedText text={"— export CSV for the full ledger."} /></p>
          )}
        </div>
      )}

      <p className="flex items-center gap-1.5 text-[12px] text-zinc-400">
        <CreditCard className="size-3.5" aria-hidden /><LocalizedText text={"Simulated ledger. Method names are masked preview descriptors — no real payment providers are connected."} /></p>

      {/* Order drawer */}
      <AdminDrawer
        open={!!selected}
        onOpenChange={() => setSelected(null)}
        title={translateUi(selected ? `Order ${selected.orderRef}` : "")}
        description={selected ? `${formatDate(selected.date)} · ${selected.method} · simulated transaction` : undefined}
        footer={selected ? <StatusBadge status={selected.status} /> : undefined}
      >
        {selected && (
          <div className="space-y-4 pb-4">
            <dl className="space-y-2.5 text-[13.5px]">
              {[
                { k: "Learner", v: selected.learnerName },
                { k: "Course", v: selected.courseTitle },
                { k: "Creator", v: selected.creatorName },
                { k: "Order reference", v: selected.orderRef },
                { k: "Payment method", v: selected.method },
              ].map((row) => (
                <div key={row.k} className="flex justify-between gap-4">
                  <dt className="text-muted-foreground"><LocalizedText text={row.k} /></dt>
                  <dd className="text-right font-medium"><LocalizedText text={row.v} /></dd>
                </div>
              ))}
            </dl>
            <Separator />
            <dl className="space-y-2 text-[13.5px]">
              <div className="flex justify-between">
                <dt className="text-muted-foreground"><LocalizedText text={"Gross amount"} /></dt>
                <dd className="tabular-nums font-medium"><LocalizedText text={formatPrice(selected.gross)} /></dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground"><LocalizedText text={"Platform commission ("} />{Math.round(settings.commissionRate * 100)}%)</dt>
                <dd className="tabular-nums text-zinc-500">−<LocalizedText text={formatPrice(selected.commission)} /></dd>
              </div>
              <div className="flex justify-between font-semibold">
                <dt><LocalizedText text={"Creator share"} /></dt>
                <dd className="tabular-nums text-success"><LocalizedText text={formatPrice(selected.creatorShare)} /></dd>
              </div>
            </dl>
            <p className="flex items-start gap-1.5 rounded-lg border border-border bg-muted/50 p-3 text-[11.5px] leading-relaxed text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden /><LocalizedText text={"Sample order from the seed ledger. Amounts are illustrative; no money ever moved."} /></p>
          </div>
        )}
      </AdminDrawer>
    </div>
  );
}
