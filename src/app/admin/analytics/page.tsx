"use client";

import { LocalizedText, useTranslate } from "@/components/providers/localized-text";
import * as React from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BadgePercent,
  BookOpen,
  Download,
  Info,
  Landmark,
  MousePointerClick,
  TrendingUp,
  Users,
} from "lucide-react";
import { CATEGORIES, COURSES } from "@/data/mock-data";
import { useAdmin } from "@/components/providers/admin-provider";
import { useCreator } from "@/components/providers/creator-provider";
import { adminSeries, commissionOf, creatorShareOf, downloadCsv } from "@/lib/admin";
import { formatCompact } from "@/lib/format";
import { money } from "@/lib/creator";
import { categoryIcon } from "@/lib/icons";
import { StatCard } from "@/components/creator/stat-card";
import { AreaChart, BarList } from "@/components/creator/charts";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Range = "7d" | "30d" | "90d" | "1y";
const RANGES: { id: Range; label: string }[] = [
  { id: "7d", label: "7D" },
  { id: "30d", label: "30D" },
  { id: "90d", label: "90D" },
  { id: "1y", label: "1Y" },
];

const CATEGORY_FUNNEL: Record<string, number> = {
  "generative-ai": 9.8,
  automation: 7.9,
  development: 7.1,
  business: 6.4,
  "data-science": 5.9,
  creation: 5.2,
  marketing: 4.8,
  productivity: 6.1,
};

export default function AdminAnalyticsPage() {
  const translateUi = useTranslate();
  const { hydrated, orders, users, settings } = useAdmin();
  const { communityCourses } = useCreator();
  const [range, setRange] = useState<Range>("30d");
  const [metric, setMetric] = useState<"revenue" | "users" | "enrollments">("revenue");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const series = useMemo(() => adminSeries(range), [range]);
  const chartData = useMemo(
    () => series.map((p) => ({ label: p.label, value: metric === "revenue" ? p.revenue : metric === "users" ? p.users : p.enrollments })),
    [series, metric]
  );

  const totals = useMemo(() => {
    const paid = orders.filter((o) => o.status === "paid" || o.status === "pending");
    const gross = paid.reduce((a, o) => a + o.gross, 0);
    return {
      gross,
      commission: paid.reduce((a, o) => a + o.commission, 0),
      creator: paid.reduce((a, o) => a + o.creatorShare, 0),
      enrollments: Math.round(gross / 18), // illustrative derived metric
      conversion: 6.2, // illustrative
    };
  }, [orders]);

  const topCourses = useMemo(
    () =>
      [...COURSES]
        .sort((a, b) => b.studentsCount * b.price - a.studentsCount * a.price)
        .filter((c) => categoryFilter === "all" || c.category === categoryFilter)
        .slice(0, 5)
        .map((c) => ({ id: c.id, label: c.title, value: Math.round((c.studentsCount * c.price) / 100), sub: `${formatCompact(c.studentsCount)} students` })),
    [categoryFilter]
  );

  const topCategories = useMemo(() => {
    return CATEGORIES.map((cat) => {
      const students = COURSES.filter((c) => c.category === cat.slug).reduce((a, c) => a + c.studentsCount, 0);
      return { id: cat.slug, label: cat.name, icon: cat.icon, value: students, sub: `${COURSES.filter((c) => c.category === cat.slug).length} courses` };
    }).sort((a, b) => b.value - a.value);
  }, []);

  const exportCsv = () => {
    downloadCsv(
      "zybble-marketplace-analytics-preview.csv",
      ["Period label", "Gross revenue (USD)", "New users", "Enrollments"],
      series.map((p) => [p.label, p.revenue, p.users, p.enrollments])
    );
    toast.success("Analytics CSV exported (sample data)");
  };

  if (!hydrated) return <Skeleton className="h-96 rounded-xl" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold tracking-[0.14em] text-primary uppercase"><LocalizedText text={"Admin Portal"} /></p>
          <h1 className="font-display mt-1.5 text-[26px] font-bold tracking-tight sm:text-3xl"><LocalizedText text={"Marketplace analytics"} /></h1>
          <p className="mt-1.5 text-[14px] text-muted-foreground"><LocalizedText text={"Illustrative preview metrics for the whole marketplace. Commission reflects the configured"} /><LocalizedText text={" "} />
            {Math.round(settings.commissionRate * 100)}<LocalizedText text={"% rate."} /></p>
        </div>
        <Button variant="outline" onClick={exportCsv}>
          <Download aria-hidden /><LocalizedText text={"Export CSV"} /></Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={TrendingUp} label={translateUi("Gross sales")} value={money(totals.gross)} hint="paid + pending" />
        <StatCard icon={BadgePercent} label={translateUi("Platform commission")} value={money(totals.commission)} hint={`${Math.round(settings.commissionRate * 100)}% of gross`} />
        <StatCard icon={Landmark} label={translateUi("Creator earnings")} value={money(totals.creator)} hint="before adjustments" />
        <StatCard icon={BookOpen} label={translateUi("Enrollments")} value={formatCompact(totals.enrollments)} hint="derived, illustrative" />
        <StatCard icon={MousePointerClick} label={translateUi("Conversion sample")} value={`${totals.conversion}%`} hint="visit → purchase" />
      </div>

      {/* Trend chart */}
      <section className="rounded-xl border border-border bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-[15.5px] font-semibold">
              {metric === "revenue" ? "Gross revenue" : metric === "users" ? "New users" : "Enrollments"}
            </h2>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              <span className="font-display text-[17px] font-bold text-foreground tabular-nums">
                <LocalizedText text={metric === "revenue" ? money(chartData.reduce((a, p) => a + p.value, 0)) : formatCompact(chartData.reduce((a, p) => a + p.value, 0))} />
              </span><LocalizedText text={" "} /><LocalizedText text={"in range"} /></p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              {(["revenue", "users", "enrollments"] as const).map((m) => (
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
        <AreaChart
          className="mt-4"
          data={chartData}
          formatValue={(v) => (metric === "revenue" ? money(v) : `${formatCompact(v)} ${metric}`)}
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Top courses */}
        <section className="rounded-xl border border-border bg-white p-5 shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-[15.5px] font-semibold"><LocalizedText text={"Top courses"} /></h2>
              <p className="text-[12px] text-muted-foreground"><LocalizedText text={"Revenue proxy: students × price · illustrative"} /></p>
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-8.5 w-44 text-[12.5px]" aria-label={translateUi("Filter by category")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="all"><LocalizedText text={"All categories"} /></SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.slug} value={c.slug}>
                    <LocalizedText text={c.name} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <BarList className="mt-4" data={topCourses} formatValue={(v) => money(v)} />
          {communityCourses.length > 0 && (
            <p className="mt-3 text-[11.5px] text-zinc-400">
              {communityCourses.length}<LocalizedText text={"locally published community course(s) are tracked separately in Moderation."} /></p>
          )}
        </section>

        {/* Top categories + conversion */}
        <section className="rounded-xl border border-border bg-white p-5 shadow-card">
          <h2 className="font-display text-[15.5px] font-semibold"><LocalizedText text={"Categories by enrollment"} /></h2>
          <ul className="mt-4 space-y-3">
            {topCategories.map((cat) => {
              const Icon = categoryIcon(cat.icon);
              return (
                <li key={cat.id} className="flex items-center gap-3">
                  <span className="flex size-8.5 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-[13px] font-medium"><LocalizedText text={cat.label} /></p>
                      <p className="shrink-0 text-[12px] font-semibold tabular-nums"><LocalizedText text={formatCompact(cat.value)} /></p>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${(cat.value / topCategories[0].value) * 100}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-400">
                      <LocalizedText text={cat.sub} /><LocalizedText text={"· conversion sample"} />{CATEGORY_FUNNEL[cat.id]}%
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <p className="flex items-center gap-1.5 text-[12px] text-zinc-400">
        <Info className="size-3.5" aria-hidden /><LocalizedText text={"Funnel percentages and derived enrollments are illustrative samples, not measured data."} /></p>
    </div>
  );
}
