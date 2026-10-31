"use client";

import {
  BarChart3,
  CalendarClock,
  CalendarDays,
  Eye,
  PenSquare,
  Send,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { StatCard } from "@/components/app/stat-card";
import { ConnectLinkedInDialog } from "@/components/app/connect-linkedin-dialog";
import { TrendChart } from "@/components/charts/trend-chart";
import { BestTimeHeatmap } from "@/components/charts/best-time-heatmap";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { LinkedinIcon } from "@/components/icons";
import { useAnalytics, useLinkedInAccounts, usePosts } from "@/lib/app/hooks";
import type { MetricPoint } from "@/lib/app/types";

const TREND_SERIES = [
  { key: "impressions", label: "Impressions", color: "#2563eb" },
] as const satisfies ReadonlyArray<{
  key: keyof Omit<MetricPoint, "date">;
  label: string;
  color: string;
}>;

/**
 * Dashboard.
 *
 * Every number on this page comes from `/api/*`. Counts come from `posts`,
 * metrics from `post_analytics` — rows that are only ever written from LinkedIn
 * API responses. When there is nothing to show the page says so: an em-dash, an
 * empty state, or an explicit "not enough data" for the best-time grid.
 */
export default function DashboardPage() {
  const scheduled = usePosts({ status: "scheduled", limit: 50 });
  const drafts = usePosts({ status: "draft", limit: 50 });
  const analytics = useAnalytics("7d");
  const accounts = useLinkedInAccounts();

  const scheduledPosts = scheduled.data ?? [];
  const draftPosts = drafts.data ?? [];
  const connected = accounts.data?.connections ?? [];
  const hasConnection = connected.length > 0;
  const loading = scheduled.loading || analytics.loading || accounts.loading;

  const totals = analytics.data?.totals ?? null;
  const series = analytics.data?.series ?? [];
  const bestTime = analytics.data?.bestTime ?? null;
  const bestTimeReady =
    Boolean(analytics.data?.capabilities.bestTimeUnlocked) &&
    bestTime !== null &&
    bestTime.insufficientData === null &&
    bestTime.cells.length > 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Connection state — the one thing everything else depends on */}
      {!hasConnection && !accounts.loading && (
        <section
          aria-labelledby="connect-heading"
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 p-8 text-white sm:p-10"
        >
          <div
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255/0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.07)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_70%_80%_at_70%_20%,black,transparent)]"
          />
          <div className="relative max-w-xl">
            <span className="flex size-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
              <LinkedinIcon className="size-5" />
            </span>
            <h2 id="connect-heading" className="mt-5 text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
              Connect LinkedIn to wake this dashboard up
            </h2>
            <p className="mt-3 text-pretty text-[15px] leading-7 text-brand-100">
              Publishing, real analytics and best-time insights all start the moment your LinkedIn
              account is linked. Until then you can write and schedule freely — nothing is published
              without a connected account.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ConnectLinkedInDialog>
                <Button variant="inverse" size="lg">
                  <LinkedinIcon className="size-4" />
                  Connect LinkedIn
                </Button>
              </ConnectLinkedInDialog>
              <Button variant="outline-inverse" size="lg" asChild>
                <Link href="/posts/new">
                  <PenSquare aria-hidden />
                  Draft a post
                </Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Publishing overview */}
      <section aria-label="Publishing overview" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Scheduled"
          value={scheduled.loading ? null : String(scheduledPosts.length)}
          icon={CalendarClock}
          hint={hasConnection ? "queued for the LinkedIn API" : "waiting for a connected account"}
        />
        <StatCard
          label="Published (7 days)"
          value={analytics.loading ? null : String(countPublished(analytics.data?.topPosts ?? []))}
          icon={Send}
          hint={hasConnection ? "from your LinkedIn account" : "connect an account to publish"}
        />
        <StatCard
          label="Impressions (7 days)"
          value={totals ? totals.impressions.toLocaleString() : null}
          icon={Eye}
          hint={
            analytics.data?.capabilities.note ??
            (hasConnection ? "reported by the LinkedIn API" : "available after connecting LinkedIn")
          }
          delta={analytics.data?.deltas.impressions ?? null}
        />
        <StatCard
          label="Engagement trend"
          value={formatDelta(analytics.data?.deltas.engagement ?? null)}
          icon={TrendingUp}
          hint="vs. the previous 7 days"
          delta={analytics.data?.deltas.engagement ?? null}
        />
      </section>

      {analytics.data?.capabilities.note && (
        <p className="flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-[13px] leading-6 text-amber-900 ring-1 ring-amber-200">
          <Badge variant="neutral">Limited access</Badge>
          {analytics.data.capabilities.note}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming content */}
        <section aria-labelledby="upcoming-heading" className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <h2 id="upcoming-heading" className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
              <CalendarClock className="size-4 text-brand-600" aria-hidden />
              Upcoming content
            </h2>
            {scheduledPosts.length > 0 && <Badge variant="neutral">{scheduledPosts.length} queued</Badge>}
          </div>
          {loading ? (
            <div className="mt-5 space-y-3">
              {[0, 1].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : scheduled.error ? (
            <p role="alert" className="mt-5 text-[13px] text-red-600">
              {scheduled.error}
            </p>
          ) : scheduledPosts.length === 0 ? (
            <div className="mt-5">
              <EmptyState
                compact
                icon={CalendarDays}
                title="Nothing scheduled yet"
                description="Schedule a post and it is queued server-side, then published by Inngest at the exact time — even while your browser is closed."
              >
                <Button asChild size="sm">
                  <Link href="/posts/new">New post</Link>
                </Button>
              </EmptyState>
            </div>
          ) : (
            <ul className="mt-5 space-y-2.5">
              {scheduledPosts.slice(0, 4).map((post) => (
                <li key={post.id}>
                  <Link
                    href={`/posts/${post.id}/edit`}
                    className="flex items-start gap-3 rounded-xl p-3 ring-1 ring-slate-200 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-brand-600"
                  >
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                      <PenSquare className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800">
                        {post.text || "Untitled post"}
                      </span>
                      <span className="mt-0.5 block text-[13px] text-slate-500">
                        {post.scheduledAt
                          ? format(new Date(post.scheduledAt), "EEEE d MMM · HH:mm")
                          : "Unscheduled"}
                        {post.timezone ? ` · ${post.timezone}` : ""}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {scheduledPosts.length > 0 && (
            <Link
              href="/calendar"
              className="mt-4 inline-block text-[13px] font-medium text-brand-700 hover:text-brand-800"
            >
              Open calendar →
            </Link>
          )}
        </section>

        {/* Recent performance */}
        <section aria-labelledby="performance-heading" className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-xs">
          <h2 id="performance-heading" className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
            <BarChart3 className="size-4 text-brand-600" aria-hidden />
            Recent performance
          </h2>
          <div className="mt-5">
            {analytics.error ? (
              <p role="alert" className="text-[13px] text-red-600">
                {analytics.error}
              </p>
            ) : (
              <TrendChart
                data={[...series]}
                series={[...TREND_SERIES]}
                status={analytics.loading ? "loading" : series.length === 0 ? "empty" : "ready"}
                yAxisLabel="Impressions per day"
                emptyTitle="No published posts to measure"
                emptyDescription="Once scheduled posts go live through your connected account, their daily impressions chart here — verbatim from the LinkedIn API."
              />
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Best posting times — Pro */}
        <section aria-labelledby="besttime-heading" className="relative overflow-hidden rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <h2 id="besttime-heading" className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
              <Sparkles className="size-4 text-brand-600" aria-hidden />
              Best posting times
            </h2>
            <Badge>Pro</Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            A heatmap of when your audience historically engages — computed from your published
            posts, never from generic averages.
          </p>

          {bestTimeReady ? (
            <div className="mt-5">
              <BestTimeHeatmap
                cells={bestTime!.cells}
                height={220}
                emptyTitle="Not enough signal yet"
                emptyDescription="Keep publishing to build a sample."
              />
              {bestTime!.meta && (
                <p className="mt-3 text-[12px] leading-5 text-slate-500">
                  Estimate from {bestTime!.meta.observations} published posts in{" "}
                  {bestTime!.meta.timeZone}, weighted towards the last{" "}
                  {bestTime!.meta.halfLifeDays} days. Not a prediction.
                </p>
              )}
            </div>
          ) : (
            <>
              <div
                aria-hidden
                className="pointer-events-none mt-5 grid grid-cols-[2.5rem_repeat(8,1fr)] gap-1 opacity-60 blur-[1.5px]"
              >
                <span />
                {["6", "8", "10", "12", "14", "16", "18", "20"].map((h) => (
                  <span key={h} className="text-center text-[10px] text-slate-500">
                    {h}:00
                  </span>
                ))}
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <span key={d} className="contents">
                    <span className="text-[10px] text-slate-600">{d}</span>
                    {Array.from({ length: 8 }).map((_, i) => (
                      <span key={i} className="h-6 rounded-[5px] bg-slate-100" />
                    ))}
                  </span>
                ))}
              </div>
              <div className="absolute inset-x-6 bottom-6 top-[92px] flex flex-col items-center justify-center rounded-xl bg-white/70 backdrop-blur-[1px]">
                <p className="text-sm font-medium text-slate-700">
                  {analytics.data?.capabilities.bestTimeUnlocked
                    ? "Not enough data yet"
                    : "Unlocks with Pro"}
                </p>
                <p className="mt-1 max-w-[240px] text-center text-[13px] leading-5 text-slate-500">
                  {analytics.data?.capabilities.bestTimeUnlocked
                    ? `The engine needs at least ${
                        bestTime?.insufficientData?.requiredPosts ?? 12
                      } published posts — it has ${
                        bestTime?.insufficientData?.observedPosts ?? 0
                      } so far.`
                    : "Best-time insights are part of Pro, alongside 12 months of analytics history."}
                </p>
                <Button asChild size="sm" variant="secondary" className="mt-4">
                  <Link href="/settings/billing">See Pro</Link>
                </Button>
              </div>
            </>
          )}
        </section>

        {/* Quick actions */}
        <section aria-labelledby="quick-heading" className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-xs">
          <h2 id="quick-heading" className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
            <PenSquare className="size-4 text-brand-600" aria-hidden />
            Quick actions
          </h2>
          <ul className="mt-4 space-y-2.5">
            {[
              { href: "/posts/new", icon: PenSquare, title: "Write a post", copy: "Draft it, schedule it, or publish it now." },
              { href: "/calendar", icon: CalendarDays, title: "Open the calendar", copy: "See the week and month at a glance." },
              { href: "/settings/linkedin", icon: LinkedinIcon, title: "Manage LinkedIn accounts", copy: "Connect, check permissions, reauthorise." },
            ].map((action) => (
              <li key={action.href}>
                <Link
                  href={action.href}
                  className="flex items-start gap-3.5 rounded-xl p-3.5 ring-1 ring-slate-200 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-brand-600"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-brand-100">
                    <action.icon className="size-4" aria-hidden />
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-slate-900">{action.title}</span>
                    <span className="mt-0.5 block text-[13px] leading-5 text-slate-500">
                      {action.copy}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {draftPosts.length > 0 && (
            <p className="mt-4 rounded-lg bg-slate-50 px-3.5 py-2.5 text-[13px] text-slate-600 ring-1 ring-slate-100">
              You have {draftPosts.length} {draftPosts.length === 1 ? "draft" : "drafts"} waiting —{" "}
              <Link href="/posts" className="font-medium text-brand-700 hover:text-brand-800">
                review them
              </Link>
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

/** Signed percentage for the trend card; null when there is nothing to compare. */
function formatDelta(value: number | null): string | null {
  if (value === null) return null;
  return `${value >= 0 ? "+" : ""}${value}%`;
}

/** Published posts in the window, counted from the analytics top-post rows. */
function countPublished(rows: Array<{ publishedAt: string | null }>): number {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return rows.filter((row) => row.publishedAt !== null && Date.parse(row.publishedAt) >= cutoff)
    .length;
}
