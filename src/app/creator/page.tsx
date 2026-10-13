"use client";

import { LocalizedText, useTranslate } from "@/components/providers/localized-text";
import * as React from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  Clock,
  Compass,
  Eye,
  GraduationCap,
  Pencil,
  Plus,
  Sparkles,
  Users,
  Wallet,
  ClipboardCheck,
} from "lucide-react";
import type { AnalyticsRange } from "@/types";
import { useCreator } from "@/components/providers/creator-provider";
import { money, ANALYTICS_BASE, analyticsSeries, STATUS_META } from "@/lib/creator";
import { formatCompact, timeAgo } from "@/lib/format";
import { StatCard } from "@/components/creator/stat-card";
import { AreaChart, BarList } from "@/components/creator/charts";
import { CoursesTable } from "@/components/creator/courses-table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const RANGES: { id: AnalyticsRange; label: string }[] = [
  { id: "7d", label: "7D" },
  { id: "30d", label: "30D" },
  { id: "90d", label: "90D" },
  { id: "1y", label: "1Y" },
];

const TIPS = [
  "Courses with 4+ learning outcomes convert 23% better. Check your drafts.",
  "A compare-at price lifts perceived value during launch weeks.",
  "Replying to reviews within 48 hours measurably improves your rating.",
  "Free preview lessons are the #1 driver of enrollments. Mark your best lesson free.",
  "Update one lesson every month — the 'last updated' date signals an active course.",
];

export default function CreatorDashboardPage() {
  const translateUi = useTranslate();
  const { hydrated, courses, profile, finances, transactions, creatorNotifications, deleteCourse } =
    useCreator();
  const [range, setRange] = useState<AnalyticsRange>("30d");

  const stats = useMemo(() => {
    const published = courses.filter((c) => c.status === "published");
    const pending = courses.filter((c) => c.status === "pending" || c.status === "changes_requested");
    const students = published.reduce((a, c) => a + c.studentsCount, 0);
    return { published: published.length, pending: pending.length, students };
  }, [courses]);

  const chartData = useMemo(
    () =>
      analyticsSeries(range, finances.lifetimeGross, courses.reduce((sum, c) => sum + c.studentsCount, 0)).map((p) => ({
        label: p.label,
        value: p.revenue,
      })),
    [range, finances.lifetimeGross, courses]
  );
  const rangeTotal = useMemo(() => chartData.reduce((a, p) => a + p.value, 0), [chartData]);

  const topCourses = useMemo(
    () =>
      courses
        .filter((c) => c.status === "published")
        .sort((a, b) => b.demoRevenue - a.demoRevenue)
        .slice(0, 4)
        .map((c) => ({ id: c.id, label: c.title, value: c.demoRevenue, sub: c.price === 0 ? "Free course" : undefined })),
    [courses]
  );

  const recentActivity = useMemo(() => {
    const reviewEvents = courses
      .flatMap((c) =>
        c.reviewHistory.map((e) => ({
          id: `${c.id}-${e.id}`,
          text: `“${c.title}” → ${STATUS_META[e.status].label}${e.actor === "reviewer" ? " (reviewer)" : ""}`,
          at: e.at,
          href: `/creator/courses/${c.id}/publish`,
        }))
      )
      .map((e) => ({ ...e, kind: "review" as const }));
    const txnEvents = transactions.slice(0, 5).map((t) => ({
      id: t.id,
      kind: "sale" as const,
      text: `${t.status === "refunded" ? "Refund" : "Sale"}: ${t.courseTitle} (${money(t.gross)})`,
      at: t.date,
      href: "/creator/earnings",
    }));
    return [...reviewEvents, ...txnEvents]
      .sort((a, b) => +new Date(b.at) - +new Date(a.at))
      .slice(0, 7);
  }, [courses, transactions]);

  const tip = TIPS[new Date().getDate() % TIPS.length];

  if (!hydrated) {
    return (
      <div aria-busy>
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-3 h-9 w-72" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="mt-6 h-72 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold tracking-[0.14em] text-primary uppercase"><LocalizedText text={"Creator Studio"} /></p>
          <h1 className="font-display mt-1.5 text-[26px] font-bold tracking-tight sm:text-3xl"><LocalizedText text={"Create. Teach. Earn."} /></h1>
          <p className="mt-1.5 text-[14px] text-muted-foreground"><LocalizedText text={"Welcome back,"} /><LocalizedText text={profile.displayName.split(" ")[0]} /><LocalizedText text={"— here's how your courses are doing."} /></p>
        </div>
        <Button asChild size="lg">
          <Link href="/creator/courses/new">
            <Plus aria-hidden /><LocalizedText text={"Create Course"} /></Link>
        </Button>
      </div>

      {/* Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} label={translateUi("Total students")} value={formatCompact(stats.students)}  />
        <StatCard icon={Wallet} label={translateUi("Course revenue")} value={money(finances.lifetimeGross)} hint="all time, gross" />
        <StatCard icon={BookOpenCheck} label={translateUi("Published courses")} value={String(stats.published)} hint={`of ${courses.length} total`} />
        <StatCard icon={Clock} label={translateUi("Pending review")} value={String(stats.pending)} hint={stats.pending > 0 ? "action may be needed" : "queue clear"} />
      </div>

      {/* Revenue chart + right rail */}
      <div className="grid gap-4 xl:grid-cols-3">
        <section className="rounded-xl border border-border bg-white p-5 shadow-card xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-[15.5px] font-semibold"><LocalizedText text={"Revenue trend"} /></h2>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                <span className="font-display text-[17px] font-bold text-foreground tabular-nums">
                  <LocalizedText text={money(rangeTotal)} />
                </span><LocalizedText text={" "} /><LocalizedText text={"in this range · this period"} /></p>
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
          <AreaChart className="mt-4" data={chartData} formatValue={(v) => money(v)} />
        </section>

        <div className="space-y-4">
          {/* Creator tip */}
          <section className="rounded-xl border border-violet-200/80 bg-accent p-5">
            <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.12em] text-accent-foreground uppercase">
              <Sparkles className="size-3.5" aria-hidden /><LocalizedText text={"Creator tip"} /></p>
            <p className="mt-2 text-[13.5px] leading-relaxed text-violet-950/80"><LocalizedText text={tip} /></p>
            <div className="mt-3 flex flex-wrap gap-2 text-[12px] font-medium">
              <Link href="/creator/profile" className="inline-flex items-center gap-1 text-primary hover:underline">
                <Pencil className="size-3" aria-hidden /><LocalizedText text={"Edit profile"} /></Link>
              <span className="text-violet-300" aria-hidden>·</span>
              <Link href="/" className="inline-flex items-center gap-1 text-primary hover:underline">
                <Compass className="size-3" aria-hidden /><LocalizedText text={"View catalog"} /></Link>
            </div>
          </section>

          {/* Top courses */}
          <section className="rounded-xl border border-border bg-white p-5 shadow-card">
            <h2 className="font-display text-[15.5px] font-semibold"><LocalizedText text={"Top performing"} /></h2>
            <p className="mb-4 text-[12px] text-muted-foreground"><LocalizedText text={"By lifetime gross (illustrative)"} /></p>
            <BarList data={topCourses} formatValue={(v) => money(v)} />
          </section>
        </div>
      </div>

      {/* My courses + activity */}
      <div className="grid gap-4 xl:grid-cols-3">
        <section className="xl:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-[15.5px] font-semibold"><LocalizedText text={"My courses"} /></h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="/creator/courses"><LocalizedText text={"View all"} />{courses.length}
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
          <CoursesTable
            compact
            courses={[...courses]
              .sort((a, b) => b.demoRevenue - a.demoRevenue || b.studentsCount - a.studentsCount)
              .slice(0, 5)}
            emptySlot={
              <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center">
                <GraduationCap className="mx-auto size-8 text-zinc-300" aria-hidden />
                <p className="mt-3 text-sm font-medium"><LocalizedText text={"No courses yet"} /></p>
                <p className="mt-1 text-[13px] text-muted-foreground"><LocalizedText text={"Create your first course to get started."} /></p>
                <Button asChild className="mt-4" size="sm">
                  <Link href="/creator/courses/new">
                    <Plus aria-hidden /><LocalizedText text={"Create Course"} /></Link>
                </Button>
              </div>
            }
          />
        </section>

        {/* Recent activity */}
        <section className="rounded-xl border border-border bg-white p-5 shadow-card">
          <h2 className="font-display text-[15.5px] font-semibold"><LocalizedText text={"Recent activity"} /></h2>
          <ul className="mt-4 space-y-3.5">
            {recentActivity.map((a) => (
              <li key={a.id} className="flex items-start gap-2.5">
                <span
                  className={cn(
                    "mt-0.5 flex size-6.5 shrink-0 items-center justify-center rounded-lg",
                    a.kind === "review" ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
                  )}
                >
                  {a.kind === "review" ? (
                    <ClipboardCheck className="size-3.5" aria-hidden />
                  ) : (
                    <Wallet className="size-3.5" aria-hidden />
                  )}
                </span>
                <div className="min-w-0">
                  <Link href={a.href} className="block truncate text-[13px] font-medium hover:text-primary">
                    <LocalizedText text={a.text} />
                  </Link>
                  <p className="text-[11.5px] text-zinc-400"><LocalizedText text={timeAgo(a.at)} /></p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-border pt-3 text-[11.5px] text-zinc-400">
            {creatorNotifications.length}<LocalizedText text={"studio notifications · activity is simulated locally"} /></p>
        </section>
      </div>
    </div>
  );
}
