"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import { Info, Star, Users, Wallet, ClipboardCheck } from "lucide-react";
import Link from "next/link";
import type { AnalyticsRange } from "@/types";
import { useCreator } from "@/components/providers/creator-provider";
import { ANALYTICS_BASE, analyticsSeries, money, PLATFORM_COMMISSION } from "@/lib/creator";
import { formatCompact } from "@/lib/format";
import { REVIEWS } from "@/data/mock-data";
import { StatCard } from "@/components/creator/stat-card";
import { AreaChart, BarList } from "@/components/creator/charts";
import { StatusBadge } from "@/components/creator/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const RANGES: { id: AnalyticsRange; label: string }[] = [
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "Last 90 days" },
  { id: "1y", label: "Last 12 months" },
];

type Metric = "revenue" | "enrollments";

export default function AnalyticsPage() {
  const { hydrated, courses, finances } = useCreator();
  const [range, setRange] = useState<AnalyticsRange>("30d");
  const [metric, setMetric] = useState<Metric>("revenue");

  const series = useMemo(
    () => analyticsSeries(range, ANALYTICS_BASE.revenue30d, ANALYTICS_BASE.enrollments30d),
    [range]
  );
  const chartData = useMemo(
    () => series.map((p) => ({ label: p.label, value: metric === "revenue" ? p.revenue : p.enrollments })),
    [series, metric]
  );
  const rangeTotal = useMemo(() => chartData.reduce((a, p) => a + p.value, 0), [chartData]);

  const published = courses.filter((c) => c.status === "published");
  const revenueByCourse = useMemo(
    () =>
      published
        .map((c) => ({ id: c.id, label: c.title, value: c.demoRevenue }))
        .sort((a, b) => b.value - a.value),
    [published]
  );

  const myReviews = useMemo(() => {
    const ids = new Set(courses.map((c) => c.id));
    return REVIEWS.filter((r) => ids.has(r.courseId));
  }, [courses]);

  const avgRating = myReviews.length
    ? (myReviews.reduce((a, r) => a + r.rating, 0) / myReviews.length).toFixed(1)
    : "—";

  if (!hydrated) {
    return (
      <div aria-busy>
        <Skeleton className="h-9 w-56" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="mt-6 h-80 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold tracking-[0.14em] text-primary uppercase">Creator Studio</p>
          <h1 className="font-display mt-1.5 text-[26px] font-bold tracking-tight sm:text-3xl">Analytics</h1>
          <p className="mt-1.5 text-[14px] text-muted-foreground">
            Performance across your courses. All figures are illustrative demo data.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRange(r.id)}
              aria-pressed={range === r.id}
              className={cn(
                "h-8 cursor-pointer rounded-md px-3 text-[12.5px] font-medium transition-colors",
                range === r.id ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} label="Students (all time)" value={formatCompact(published.reduce((a, c) => a + c.studentsCount, 0))} delta="12%" />
        <StatCard icon={Wallet} label="Net earnings (all time)" value={money(finances.lifetimeNet)} delta="8.4%" hint="after 10% commission" />
        <StatCard icon={Star} label="Average rating" value={avgRating} hint={`${myReviews.length} reviews shown`} />
        <StatCard icon={ClipboardCheck} label="Pending review" value={String(courses.filter((c) => c.status === "pending").length)} hint="courses in queue" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* Trend chart */}
        <section className="rounded-xl border border-border bg-white p-5 shadow-card xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-[15.5px] font-semibold">
                {metric === "revenue" ? "Revenue" : "Enrollments"} — {RANGES.find((r) => r.id === range)!.label.toLowerCase()}
              </h2>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                <span className="font-display text-[17px] font-bold text-foreground tabular-nums">
                  {metric === "revenue" ? money(rangeTotal) : formatCompact(rangeTotal)}
                </span>{" "}
                total in range
              </p>
            </div>
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              {(["revenue", "enrollments"] as const).map((m) => (
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
                  {m}
                </button>
              ))}
            </div>
          </div>
          <AreaChart
            className="mt-4"
            data={chartData}
            formatValue={(v) => (metric === "revenue" ? money(v) : `${Math.round(v)} enrollments`)}
          />
        </section>

        {/* Revenue by course */}
        <section className="rounded-xl border border-border bg-white p-5 shadow-card">
          <h2 className="font-display text-[15.5px] font-semibold">Revenue by course</h2>
          <p className="mb-4 text-[12px] text-muted-foreground">Lifetime gross · illustrative</p>
          {revenueByCourse.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-zinc-400">No published paid courses yet.</p>
          ) : (
            <BarList data={revenueByCourse} formatValue={(v) => money(v)} />
          )}
          <div className="mt-5 rounded-lg border border-violet-200 bg-accent p-3 text-[12px] leading-relaxed text-violet-950/70">
            <p className="font-semibold">Commission reminder</p>
            <p className="mt-0.5">
              Zybble keeps {Math.round(PLATFORM_COMMISSION * 100)}% of each sale; your share is the
              remaining {100 - Math.round(PLATFORM_COMMISSION * 100)}% before fees and taxes.
            </p>
          </div>
        </section>
      </div>

      {/* Course table */}
      <section className="overflow-hidden rounded-xl border border-border bg-white shadow-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-display text-[15.5px] font-semibold">Course performance</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-160 text-left">
            <thead>
              <tr className="border-b border-border text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
                <th className="py-3 pr-4 pl-5">Course</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Students</th>
                <th className="px-4 py-3 text-right">Gross revenue</th>
                <th className="px-4 py-3 text-right">Your share</th>
                <th className="py-3 pr-5 pl-4 text-right">Rating</th>
              </tr>
            </thead>
            <tbody>
              {[...courses]
                .sort((a, b) => b.demoRevenue - a.demoRevenue)
                .map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="max-w-72 py-3 pr-4 pl-5">
                      <Link href={`/creator/courses/${c.id}/edit`} className="block truncate text-[13px] font-medium hover:text-primary">
                        {c.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3 text-right text-[13px] tabular-nums">{formatCompact(c.studentsCount)}</td>
                    <td className="px-4 py-3 text-right text-[13px] font-medium tabular-nums">{money(c.demoRevenue)}</td>
                    <td className="px-4 py-3 text-right text-[13px] tabular-nums text-success">
                      {money(c.demoRevenue * (1 - PLATFORM_COMMISSION))}
                    </td>
                    <td className="py-3 pr-5 pl-4 text-right text-[13px]">
                      {c.ratingsCount > 0 ? (
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Star className="size-3.5 fill-star text-star" aria-hidden />
                          {c.rating.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="flex items-center gap-1.5 text-[12px] text-zinc-400">
        <Info className="size-3.5" aria-hidden />
        Analytics on this page are generated demo data rendered locally — they do not reflect real learners.
      </p>
    </div>
  );
}
