"use client";

import { format } from "date-fns";
import {
  AlertTriangle,
  ExternalLink,
  Eye,
  Heart,
  MessageCircle,
  Repeat2,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { StatCard } from "@/components/app/stat-card";
import { ConnectLinkedInDialog } from "@/components/app/connect-linkedin-dialog";
import { TrendChart } from "@/components/charts/trend-chart";
import { BestTimeHeatmap } from "@/components/charts/best-time-heatmap";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAnalytics } from "@/lib/app/hooks";
import type { MetricPoint, TopPostRow } from "@/lib/app/types";

/**
 * Analytics.
 *
 * Every number comes from `post_analytics` / `analytics_snapshots`, which are
 * only ever written from LinkedIn API responses. Missing metrics stay null, the
 * 12-month range is refused on Free rather than truncated, and the best-time
 * grid reports its own sample size instead of implying confidence it does not
 * have.
 */

const SERIES = [
  { key: "impressions", label: "Impressions", color: "#2563eb" },
  { key: "reactions", label: "Reactions", color: "#7a9ff9" },
  { key: "comments", label: "Comments", color: "#94a3b8" },
] as const satisfies ReadonlyArray<{
  key: keyof Omit<MetricPoint, "date">;
  label: string;
  color: string;
}>;

type Range = "7d" | "28d" | "12m";

const RANGE_LABEL: Record<Range, string> = {
  "7d": "Last 7 days",
  "28d": "Last 28 days",
  "12m": "Last 12 months",
};

export default function AnalyticsPage() {
  const [range, setRange] = useState<Range>("28d");
  const analytics = useAnalytics(range);

  const data = analytics.data;
  const totals = data?.totals ?? null;
  const series = data?.series ?? [];
  const topPosts = data?.topPosts ?? [];
  const bestTime = data?.bestTime ?? null;
  const capabilities = data?.capabilities ?? null;

  const bestTimeReady =
    Boolean(capabilities?.bestTimeUnlocked) &&
    bestTime !== null &&
    bestTime.insufficientData === null &&
    bestTime.cells.length > 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Range selector + honesty note */}
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={range} onValueChange={(value) => setRange(value as Range)}>
          <TabsList aria-label="Analytics range">
            <TabsTrigger value="7d">7 days</TabsTrigger>
            <TabsTrigger value="28d">28 days</TabsTrigger>
            <TabsTrigger value="12m" className="gap-1.5">
              12 months
              <Badge size="sm" className="!px-1.5 !py-0">
                Pro
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <p className="ml-auto max-w-xs text-right text-[13px] leading-5 text-slate-400">
          Zybble charts only what LinkedIn&rsquo;s API reports — never estimates or synthetic
          numbers.
        </p>
      </div>

      {analytics.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-red-50 p-4 ring-1 ring-red-200">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-600" aria-hidden />
          <div>
            <p className="text-sm font-medium text-red-900">This range could not be loaded</p>
            <p className="mt-1 text-[13px] leading-6 text-red-800">{analytics.error}</p>
            {range === "12m" && (
              <Button variant="secondary" size="sm" className="mt-3" onClick={() => setRange("28d")}>
                Back to 28 days
              </Button>
            )}
          </div>
        </div>
      )}

      {capabilities?.note && (
        <p className="flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-[13px] leading-6 text-amber-900 ring-1 ring-amber-200">
          <Badge variant="neutral">Limited access</Badge>
          {capabilities.note}
        </p>
      )}

      {/* Metric cards */}
      <section aria-label="Key metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Impressions"
          value={totals ? totals.impressions.toLocaleString() : null}
          icon={Eye}
          hint={RANGE_LABEL[range].toLowerCase()}
          delta={data?.deltas.impressions ?? null}
        />
        <StatCard
          label="Reactions"
          value={totals ? totals.reactions.toLocaleString() : null}
          icon={Heart}
          hint={RANGE_LABEL[range].toLowerCase()}
        />
        <StatCard
          label="Comments"
          value={totals ? totals.comments.toLocaleString() : null}
          icon={MessageCircle}
          hint={RANGE_LABEL[range].toLowerCase()}
        />
        <StatCard
          label="Reposts"
          value={totals ? totals.reposts.toLocaleString() : null}
          icon={Repeat2}
          hint={RANGE_LABEL[range].toLowerCase()}
        />
      </section>

      {/* Trend */}
      <section
        aria-labelledby="trend-heading"
        className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-xs"
      >
        <div className="flex items-center justify-between">
          <h2 id="trend-heading" className="text-[15px] font-semibold text-slate-900">
            Performance over time
          </h2>
          <Badge variant="neutral">{RANGE_LABEL[range]}</Badge>
        </div>
        <div className="mt-5">
          <TrendChart
            data={[...series]}
            series={[...SERIES]}
            status={analytics.loading ? "loading" : analytics.error ? "error" : series.length === 0 ? "empty" : "ready"}
            height={280}
            yAxisLabel="Daily totals"
            emptyTitle="No metrics in this window yet"
            emptyDescription="Connect LinkedIn and publish through Zybble — daily impressions, reactions and comments chart here, verbatim from the LinkedIn API."
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top posts */}
        <section
          aria-labelledby="top-heading"
          className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-xs"
        >
          <h2 id="top-heading" className="text-[15px] font-semibold text-slate-900">
            Top-performing posts
          </h2>
          <p className="mt-1 text-[13px] text-slate-500">
            Ranked by engagement rate, minimum reach threshold applied.
          </p>
          <div className="mt-5">
            {analytics.loading ? (
              <div className="space-y-2.5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />
                ))}
              </div>
            ) : topPosts.length === 0 ? (
              <EmptyState
                compact
                icon={Eye}
                title="No published posts to rank"
                description="Your best posts by engagement rate will surface here — with impressions, reactions, comments and reposts side by side."
              >
                <ConnectLinkedInDialog>
                  <Button variant="secondary">Connect LinkedIn</Button>
                </ConnectLinkedInDialog>
              </EmptyState>
            ) : (
              <ul className="divide-y divide-slate-100">
                {topPosts.map((post) => (
                  <TopPostRowItem key={post.postId} post={post} />
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Best time heatmap */}
        <section
          aria-labelledby="heatmap-heading"
          className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <h2 id="heatmap-heading" className="text-[15px] font-semibold text-slate-900">
              Best time to post
            </h2>
            <Badge>Pro insight</Badge>
          </div>
          <p className="mt-1 text-[13px] leading-5 text-slate-500">
            Relative engagement by weekday and hour, from your own history.
          </p>
          <div className="mt-5">
            {bestTimeReady ? (
              <>
                <BestTimeHeatmap
                  cells={bestTime!.cells}
                  height={220}
                  emptyTitle="Not enough signal yet"
                  emptyDescription="Keep publishing to build a sample."
                />
                {bestTime!.meta && (
                  <p className="mt-3 text-[12px] leading-5 text-slate-400">
                    Estimated from {bestTime!.meta.observations} published posts in{" "}
                    {bestTime!.meta.timeZone}, weighted towards the last{" "}
                    {bestTime!.meta.halfLifeDays} days (half-life). Sample minimum{" "}
                    {bestTime!.meta.minCellSample} per slot. Not a prediction.
                  </p>
                )}
              </>
            ) : (
              <BestTimeHeatmap
                cells={[]}
                status="empty"
                height={220}
                emptyTitle={
                  capabilities?.bestTimeUnlocked ? "Not enough signal yet" : "Pro insight"
                }
                emptyDescription={
                  capabilities?.bestTimeUnlocked
                    ? `The engine needs at least ${
                        bestTime?.insufficientData?.requiredPosts ?? 12
                      } published posts — it has ${
                        bestTime?.insufficientData?.observedPosts ?? 0
                      } so far.`
                    : "Best-time insights are part of Pro, alongside 12 months of analytics history."
                }
              />
            )}
            {!capabilities?.bestTimeUnlocked && (
              <Button asChild size="sm" variant="secondary" className="mt-4">
                <Link href="/settings/billing">Upgrade to Pro</Link>
              </Button>
            )}
          </div>
        </section>
      </div>

      {/* Method note */}
      <section aria-label="What Zybble measures" className="rounded-2xl bg-slate-50 p-6 ring-1 ring-slate-200">
        <h2 className="text-sm font-semibold text-slate-900">How this page works</h2>
        <ul className="mt-3 grid gap-x-8 gap-y-2 text-[13px] leading-6 text-slate-600 sm:grid-cols-2">
          <li>· Metrics sync from the LinkedIn API for posts published through Zybble.</li>
          <li>· Free keeps a 7-day window; Pro extends it to 12 months and unlocks best-time.</li>
          <li>· Engagement rate = (reactions + comments + reposts) ÷ impressions.</li>
          <li>· No reach estimates, no modelled numbers, no vanity padding.</li>
        </ul>
      </section>
    </div>
  );
}

function TopPostRowItem({ post }: { post: TopPostRow }) {
  const { metrics } = post;
  const engagement =
    metrics.engagementRate === null ? null : metrics.engagementRate * 100;

  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/posts/${post.postId}/edit`}
            className="block truncate text-sm font-medium text-slate-800 hover:text-brand-700"
          >
            {post.text.slice(0, 80) || "Untitled post"}
          </Link>
          <p className="mt-1 text-[12px] text-slate-400">
            {post.publishedAt ? format(new Date(post.publishedAt), "d MMM yyyy") : "Unpublished"}
          </p>
        </div>
        {post.permalink && (
          <a
            href={post.permalink}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="Open on LinkedIn"
            className="flex size-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        )}
      </div>
      <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-slate-500">
        <div className="flex gap-1">
          <dt className="sr-only">Impressions</dt>
          <dd className="tabular-nums">{metrics.impressions.toLocaleString()} impressions</dd>
        </div>
        <div className="flex gap-1">
          <dt className="sr-only">Reactions</dt>
          <dd className="tabular-nums">{metrics.reactions.toLocaleString()} reactions</dd>
        </div>
        <div className="flex gap-1">
          <dt className="sr-only">Comments</dt>
          <dd className="tabular-nums">{metrics.comments.toLocaleString()} comments</dd>
        </div>
        <div className="flex gap-1">
          <dt className="sr-only">Reposts</dt>
          <dd className="tabular-nums">{metrics.reposts.toLocaleString()} reposts</dd>
        </div>
        {engagement !== null && (
          <div className="flex gap-1">
            <dt className="sr-only">Engagement rate</dt>
            <dd className="font-medium tabular-nums text-brand-700">
              {engagement.toFixed(1)}% engagement
            </dd>
          </div>
        )}
      </dl>
    </li>
  );
}
