"use client";

import { LocalizedText, useTranslate } from "@/components/providers/localized-text";
import * as React from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgePercent,
  ClipboardCheck,
  Clock3,
  Flag,
  LibraryBig,
  Receipt,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import { COURSES } from "@/data/mock-data";
import { useAdmin } from "@/components/providers/admin-provider";
import { useCreator } from "@/components/providers/creator-provider";
import { adminSeries, commissionOf } from "@/lib/admin";
import { STATUS_META } from "@/lib/creator";
import { formatCompact, formatDate, formatPrice, timeAgo } from "@/lib/format";
import { money } from "@/lib/creator";
import { StatCard } from "@/components/creator/stat-card";
import { AreaChart } from "@/components/creator/charts";
import { StatusBadge } from "@/components/creator/status-badge";
import { ReportStatusBadge } from "@/components/admin/report-badge";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Range = "7d" | "30d" | "90d" | "1y";
const RANGES: { id: Range; label: string }[] = [
  { id: "7d", label: "7D" },
  { id: "30d", label: "30D" },
  { id: "90d", label: "90D" },
  { id: "1y", label: "1Y" },
];

export default function AdminOverviewPage() {
  const translateUi = useTranslate();
  const { hydrated, users, orders, payouts, reports, activity } = useAdmin();
  const { courses } = useCreator();
  const [range, setRange] = useState<Range>("30d");
  const [metric, setMetric] = useState<"revenue" | "users">("revenue");

  const stats = useMemo(() => {
    const paidOrders = orders.filter((o) => o.status === "paid");
    const gross = paidOrders.reduce((a, o) => a + o.gross, 0);
    const localPublished = courses.filter((c) => c.status === "published" && !COURSES.some((s) => s.id === c.id)).length;
    return {
      users: users.filter((u) => u.status === "active").length,
      published: COURSES.length + localPublished,
      pending: courses.filter((c) => c.status === "pending" || c.status === "changes_requested").length,
      gross,
      commission: commissionOf(gross),
      reports: reports.filter((r) => r.status === "open" || r.status === "under_review").length,
    };
  }, [orders, courses, users, reports]);

  const series = useMemo(() => adminSeries(range), [range]);
  const chartData = useMemo(
    () => series.map((p) => ({ label: p.label, value: metric === "revenue" ? p.revenue : p.users })),
    [series, metric]
  );
  const total = chartData.reduce((a, p) => a + p.value, 0);

  const queue = useMemo(
    () => courses.filter((c) => c.status === "pending" || c.status === "changes_requested"),
    [courses]
  );
  const recentOrders = orders.slice(0, 6);
  const recentCreators = useMemo(
    () =>
      users
        .filter((u) => u.role === "creator")
        .sort((a, b) => +new Date(b.registeredAt) - +new Date(a.registeredAt))
        .slice(0, 4),
    [users]
  );

  if (!hydrated) {
    return (
      <div aria-busy>
        <Skeleton className="h-9 w-72" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="mt-6 h-72 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold tracking-[0.14em] text-primary uppercase"><LocalizedText text={"Admin Portal"} /></p>
          <h1 className="font-display mt-1.5 text-[26px] font-bold tracking-tight sm:text-3xl"><LocalizedText text={"Marketplace operations"} /></h1>
          <p className="mt-1.5 text-[14px] text-muted-foreground"><LocalizedText text={"All statistics on this page are sample data — the portal is a frontend simulation."} /></p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3.5 py-1.5">
          <ShieldCheck className="size-4 text-amber-600" aria-hidden />
          <span className="text-[12.5px] font-semibold text-amber-700"><LocalizedText text={"Simulation mode · local state only"} /></span>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard icon={Users} label={translateUi("Total users")} value={formatCompact(stats.users)} hint={`${users.filter((u) => u.status === "suspended").length} suspended`} />
        <StatCard icon={LibraryBig} label={translateUi("Published courses")} value={String(stats.published)} hint={`${stats.published - COURSES.length} community`} />
        <StatCard icon={Clock3} label={translateUi("Pending reviews")} value={String(stats.pending)} hint="in queue" />
        <StatCard icon={Wallet} label={translateUi("Gross sales")} value={money(stats.gross)} hint="illustrative" />
        <StatCard icon={BadgePercent} label={translateUi("Platform commission")} value={money(stats.commission)} hint="10% of gross" />
        <StatCard icon={Flag} label={translateUi("Open reports")} value={String(stats.reports)} hint="needs attention" />
      </div>

      {/* Charts */}
      <section className="rounded-xl border border-border bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-[15.5px] font-semibold">
              {metric === "revenue" ? "Marketplace revenue" : "User growth"} — {range === "7d" ? "last 7 days" : range === "30d" ? "last 30 days" : range === "90d" ? "last 90 days" : "last 12 months"}
            </h2>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              <span className="font-display text-[17px] font-bold text-foreground tabular-nums">
                <LocalizedText text={metric === "revenue" ? money(total) : formatCompact(total)} />
              </span><LocalizedText text={" "} /><LocalizedText text={"in range · hover for details"} /></p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              {(["revenue", "users"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMetric(m)}
                  aria-pressed={metric === m}
                  className={cn(
                    "h-7 cursor-pointer rounded-md px-3 text-[12px] font-medium capitalize transition-colors",
                    metric === m ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {m === "revenue" ? "Revenue" : "Users"}
                </button>
              ))}
            </div>
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              {RANGES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRange(r.id)}
                  aria-pressed={range === r.id}
                  className={cn(
                    "h-7 cursor-pointer rounded-md px-2.5 text-[12px] font-medium transition-colors",
                    range === r.id ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <LocalizedText text={r.label} />
                </button>
              ))}
            </div>
          </div>
        </div>
        <AreaChart className="mt-4" data={chartData} formatValue={(v) => (metric === "revenue" ? money(v) : `${v} users`)} />
      </section>

      {/* Rails */}
      <div className="grid gap-4 xl:grid-cols-3">
        {/* Moderation queue */}
        <section className="rounded-xl border border-border bg-white shadow-card xl:col-span-1">
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <h2 className="font-display text-[15.5px] font-semibold"><LocalizedText text={"Moderation queue"} /></h2>
            <Link href="/admin/courses" className="group flex items-center gap-1 text-[12.5px] font-medium text-primary hover:underline"><LocalizedText text={"Open queue"} /><ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </div>
          {queue.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13px] text-muted-foreground"><LocalizedText text={"Queue is clear — no submissions waiting."} /></p>
          ) : (
            <ul className="divide-y divide-border">
              {queue.slice(0, 4).map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/admin/courses/${c.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold"><LocalizedText text={c.title} /></p>
                      <p className="text-[11.5px] text-zinc-400">
                        <LocalizedText text={STATUS_META[c.status].label} /><LocalizedText text={"· updated"} /><LocalizedText text={timeAgo(c.lastUpdated)} />
                      </p>
                    </div>
                    <ClipboardCheck className="size-4 shrink-0 text-zinc-300" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Recent orders */}
        <section className="overflow-hidden rounded-xl border border-border bg-white shadow-card xl:col-span-2">
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <h2 className="font-display text-[15.5px] font-semibold"><LocalizedText text={"Recent orders"} /></h2>
            <Link href="/admin/orders" className="group flex items-center gap-1 text-[12.5px] font-medium text-primary hover:underline"><LocalizedText text={"All orders"} /><ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-140 text-left">
              <thead>
                <tr className="border-b border-border text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
                  <th className="py-2.5 pr-4 pl-5"><LocalizedText text={"Order"} /></th>
                  <th className="px-4 py-2.5"><LocalizedText text={"Learner"} /></th>
                  <th className="px-4 py-2.5"><LocalizedText text={"Course"} /></th>
                  <th className="px-4 py-2.5"><LocalizedText text={"Status"} /></th>
                  <th className="py-2.5 pr-5 pl-4 text-right"><LocalizedText text={"Gross"} /></th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => (
                  <tr key={o.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="py-2.5 pr-4 pl-5 font-mono text-[11.5px] text-zinc-500"><LocalizedText text={o.orderRef} /></td>
                    <td className="max-w-32 truncate px-4 py-2.5 text-[12.5px]"><LocalizedText text={o.learnerName} /></td>
                    <td className="max-w-52 truncate px-4 py-2.5 text-[12.5px] text-muted-foreground"><LocalizedText text={o.courseTitle} /></td>
                    <td className="px-4 py-2.5">
                      <OrderStatusBadge status={o.status} />
                    </td>
                    <td className="py-2.5 pr-5 pl-4 text-right text-[12.5px] font-semibold tabular-nums">
                      <LocalizedText text={formatPrice(o.gross)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* Recent creator registrations */}
        <section className="rounded-xl border border-border bg-white p-5 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[15.5px] font-semibold"><LocalizedText text={"Creator registrations"} /></h2>
            <Link href="/admin/users?role=creator" className="text-[12.5px] font-medium text-primary hover:underline"><LocalizedText text={"All users"} /></Link>
          </div>
          <ul className="mt-4 space-y-3">
            {recentCreators.map((u) => (
              <li key={u.id} className="flex items-center gap-3">
                <span className={cn("flex size-8.5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold", u.avatarColor)}>
                  <LocalizedText text={u.initials} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium"><LocalizedText text={u.name} /></p>
                  <p className="text-[11.5px] text-zinc-400">
                    {u.coursesCreated} {u.coursesCreated === 1 ? "course" : "courses"}<LocalizedText text={"· joined"} /><LocalizedText text={formatDate(u.registeredAt)} />
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Admin activity */}
        <section className="rounded-xl border border-border bg-white p-5 shadow-card xl:col-span-2">
          <h2 className="font-display text-[15.5px] font-semibold"><LocalizedText text={"Recent admin activity"} /></h2>
          <ul className="mt-4 space-y-3">
            {activity.slice(0, 6).map((a) => (
              <li key={a.id} className="flex items-start gap-2.5">
                <span className={cn("mt-0.5 flex size-6.5 shrink-0 items-center justify-center rounded-lg",
                  a.kind === "moderation" && "bg-amber-100 text-amber-700",
                  a.kind === "payout" && "bg-emerald-100 text-emerald-700",
                  a.kind === "user" && "bg-sky-100 text-sky-700",
                  a.kind === "review" && "bg-violet-100 text-violet-700",
                  a.kind === "settings" && "bg-zinc-200 text-zinc-600",
                  a.kind === "order" && "bg-cyan-100 text-cyan-700"
                )}>
                  {a.kind === "moderation" ? <ClipboardCheck className="size-3.5" aria-hidden />
                    : a.kind === "payout" ? <Wallet className="size-3.5" aria-hidden />
                    : a.kind === "user" ? <Users className="size-3.5" aria-hidden />
                    : a.kind === "review" ? <Flag className="size-3.5" aria-hidden />
                    : a.kind === "order" ? <Receipt className="size-3.5" aria-hidden />
                    : <ShieldCheck className="size-3.5" aria-hidden />}
                </span>
                <div className="min-w-0">
                  <p className="text-[12.5px] leading-snug">
                    <span className="font-semibold"><LocalizedText text={a.actor.split(" ")[0]} /></span><LocalizedText text={" "} />
                    <span className="text-muted-foreground"><LocalizedText text={a.action.toLowerCase()} /></span><LocalizedText text={" "} />
                    <span className="font-medium"><LocalizedText text={a.target} /></span>
                  </p>
                  <p className="text-[11px] text-zinc-400"><LocalizedText text={timeAgo(a.at)} /></p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Open reports strip */}
      <section className="rounded-xl border border-border bg-white p-5 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[15.5px] font-semibold"><LocalizedText text={"Reports needing review"} /></h2>
          <Link href="/admin/reports" className="text-[12.5px] font-medium text-primary hover:underline"><LocalizedText text={"All reports"} /></Link>
        </div>
        {reports.filter((r) => r.status === "open" || r.status === "under_review").length === 0 ? (
          <p className="mt-4 text-[13px] text-muted-foreground"><LocalizedText text={"No open reports. Nice."} /></p>
        ) : (
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {reports
              .filter((r) => r.status === "open" || r.status === "under_review")
              .slice(0, 4)
              .map((r) => (
                <li key={r.id} className="rounded-lg border border-border bg-muted/40 p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[13px] font-semibold"><LocalizedText text={r.targetTitle} /></p>
                    <ReportStatusBadge status={r.status} />
                  </div>
                  <p className="mt-1 line-clamp-2 text-[12px] text-muted-foreground"><LocalizedText text={r.reason} /></p>
                  <p className="mt-1.5 text-[11px] text-zinc-400">
                    {r.type}<LocalizedText text={"· by"} /><LocalizedText text={r.reporterName} /> · <LocalizedText text={timeAgo(r.submittedAt)} />
                  </p>
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function OrderStatusBadge({ status }: { status: "paid" | "pending" | "refunded" | "failed" }) {
  if (status === "paid") return <Badge variant="emerald"><LocalizedText text={"Paid"} /></Badge>;
  if (status === "pending") return <Badge variant="amber"><LocalizedText text={"Pending"} /></Badge>;
  if (status === "refunded") return <Badge variant="secondary"><LocalizedText text={"Refunded"} /></Badge>;
  return <Badge className="border-red-200 bg-red-50 text-red-600"><LocalizedText text={"Failed"} /></Badge>;
}
