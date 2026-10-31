"use client";

import { Eye, Heart, MessageCircle, Repeat2, Sparkles } from "lucide-react";
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
import type { MetricPoint } from "@/lib/app/types";

const SERIES = [
  { key: "impressions", label: "Impressions", color: "#2563eb" },
  { key: "reactions", label: "Reactions", color: "#7a9ff9" },
  { key: "comments", label: "Comments", color: "#94a3b8" },
] as const satisfies ReadonlyArray<{ key: keyof Omit<MetricPoint, "date">; label: string; color: string }>;

type Range = "7" | "28" | "365";

const RANGE_LABEL: Record<Range, string> = {
  "7": "Last 7 days",
  "28": "Last 28 days",
  "365": "Last 12 months",
};

export default function AnalyticsPage() {
  const [range, setRange] = useState<Range>("7");
  const proRangeSelected = range === "365";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Range selector + honesty note */}
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
          <TabsList aria-label="Analytics range">
            <TabsTrigger value="7">7 days</TabsTrigger>
            <TabsTrigger value="28">28 days</TabsTrigger>
            <TabsTrigger value="365" className="gap-1.5">
              12 months
              <Badge size="sm" className="!px-1.5 !py-0">Pro</Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <p className="ml-auto max-w-xs text-right text-[13px] leading-5 text-slate-400">
          Zybble charts only what LinkedIn&rsquo;s API reports — never estimates
          or synthetic numbers.
        </p>
      </div>

      {/* Metric cards */}
      <section aria-label="Key metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Impressions" value={null} icon={Eye} hint={`${RANGE_LABEL[range].toLowerCase()} · needs connection`} />
        <StatCard label="Reactions" value={null} icon={Heart} hint={`${RANGE_LABEL[range].toLowerCase()} · needs connection`} />
        <StatCard label="Comments" value={null} icon={MessageCircle} hint={`${RANGE_LABEL[range].toLowerCase()} · needs connection`} />
        <StatCard label="Reposts" value={null} icon={Repeat2} hint={`${RANGE_LABEL[range].toLowerCase()} · needs connection`} />
      </section>

      {/* Trend */}
      <section aria-labelledby="trend-heading" className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-xs">
        <div className="flex items-center justify-between">
          <h2 id="trend-heading" className="text-[15px] font-semibold text-slate-900">
            Performance over time
          </h2>
          <Badge variant="neutral">{RANGE_LABEL[range]}</Badge>
        </div>
        <div className="mt-5">
          {proRangeSelected ? (
            <EmptyState
              compact
              icon={Sparkles}
              title="12-month analytics is a Pro feature"
              description="Pro extends your visible history from 7 days to a full year, with engagement-rate trends and exports. Free keeps the rolling 7-day window."
            >
              <Button asChild>
                <Link href="/settings/billing">Upgrade to Pro</Link>
              </Button>
              <Button variant="ghost" onClick={() => setRange("7")}>
                Back to 7 days
              </Button>
            </EmptyState>
          ) : (
            <TrendChart
              data={[]}
              series={[...SERIES]}
              status="empty"
              height={280}
              yAxisLabel="Daily totals"
              emptyTitle="No metrics in this window yet"
              emptyDescription="Connect LinkedIn and publish through Zybble — daily impressions, reactions and comments chart here, verbatim from the LinkedIn API."
            />
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top posts */}
        <section aria-labelledby="top-heading" className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-xs">
          <h2 id="top-heading" className="text-[15px] font-semibold text-slate-900">
            Top-performing posts
          </h2>
          <p className="mt-1 text-[13px] text-slate-500">Ranked by engagement rate, minimum reach threshold applied.</p>
          <div className="mt-5">
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
          </div>
        </section>

        {/* Best time heatmap */}
        <section aria-labelledby="heatmap-heading" className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-xs">
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
            <BestTimeHeatmap
              cells={[]}
              status="empty"
              emptyTitle="Not enough signal yet"
              emptyDescription="After a few weeks of connected publishing, this heatmap pinpoints your audience's strongest windows."
            />
          </div>
        </section>
      </div>

      {/* Method note */}
      <section aria-label="What Zybble measures" className="rounded-2xl bg-slate-50 p-6 ring-1 ring-slate-200">
        <h2 className="text-sm font-semibold text-slate-900">How this page will work</h2>
        <ul className="mt-3 grid gap-x-8 gap-y-2 text-[13px] leading-6 text-slate-600 sm:grid-cols-2">
          <li>· Metrics sync from the LinkedIn API for posts published through Zybble.</li>
          <li>· Free keeps a rolling 7-day window; Pro keeps 12 months + best-time insights.</li>
          <li>· Engagement rate = (reactions + comments + reposts) ÷ impressions.</li>
          <li>· No reach estimates, no modelled numbers, no vanity padding.</li>
        </ul>
      </section>
    </div>
  );
}
