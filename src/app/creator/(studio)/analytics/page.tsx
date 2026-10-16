import { ArrowRight, BarChart3, Eye, MousePointerClick, PlayCircle, Timer, TrendingUp, Users } from "lucide-react";
import { getCreatorEngagement, parseAnalyticsRange } from "@/lib/server/creator";
import { formatCount } from "@/lib/format";
import { StatCard } from "@/components/creator/stat-card";
import { AreaChart, BarList } from "@/components/creator/charts";
import { StatusBadge } from "@/components/creator/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { AnalyticsRangeSelector } from "../analytics-range";

export const metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

/** `132` → `2m 12s`; `3725` → `1h 02m`. */
function formatWatch(seconds: number): string {
  if (seconds <= 0) return "0s";
  if (seconds < 60) return `${seconds}s`;
  const totalMinutes = Math.floor(seconds / 60);
  if (totalMinutes < 60) return `${totalMinutes}m ${seconds % 60}s`;
  const hours = Math.floor(totalMinutes / 60);
  return `${hours}h ${String(totalMinutes % 60).padStart(2, "0")}m`;
}

function formatMinutes(minutes: number): string {
  if (minutes <= 0) return "0m";
  if (minutes < 60) return `${formatCount(minutes)}m`;
  return `${formatCount(Math.round(minutes / 60))}h`;
}

function percent(part: number, whole: number): string {
  if (whole <= 0) return "0%";
  const value = (part / whole) * 100;
  return `${value >= 10 ? Math.round(value) : Math.round(value * 10) / 10}%`;
}

/** Delta chip for a StatCard, or nothing when both windows are flat. */
function delta(current: number, previous: number): { label: string; down: boolean } | undefined {
  if (previous <= 0) return current > 0 ? { label: "New", down: false } : undefined;
  const change = Math.round(((current - previous) / previous) * 100);
  if (change === 0) return { label: "No change", down: false };
  return { label: `${Math.abs(change)}% vs previous`, down: change < 0 };
}

function FunnelStep({
  icon: Icon,
  label,
  value,
  rate,
  rateLabel,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  rate?: string;
  rateLabel?: string;
}) {
  return (
    <div className="flex-1 rounded-lg border border-border bg-muted/40 px-3.5 py-3">
      <span className="flex size-7 items-center justify-center rounded-md bg-accent text-primary">
        <Icon className="size-3.5" aria-hidden />
      </span>
      <p className="font-display mt-2.5 text-[19px] leading-none font-bold tabular-nums">{value}</p>
      <p className="mt-1.5 text-[12px] text-muted-foreground">{label}</p>
      {rate ? (
        <p className="mt-2 text-[11.5px] font-medium text-primary">
          {rate} <span className="text-zinc-400">{rateLabel}</span>
        </p>
      ) : null}
    </div>
  );
}

export default async function CreatorAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range } = await searchParams;
  const active = parseAnalyticsRange(range);
  const engagement = await getCreatorEngagement(active);
  const { totals, previous, points, byCourse } = engagement;

  const tracked = byCourse.filter((course) => course.impressions > 0 || course.views > 0 || course.watchSeconds > 0);
  const hasActivity = totals.impressions + totals.views + totals.watchSeconds > 0;

  const viewSeries = points.map((point) => ({ label: point.label, value: point.views }));
  const topByViews = [...byCourse]
    .sort((a, b) => b.views - a.views || b.impressions - a.impressions)
    .slice(0, 6)
    .filter((course) => course.views > 0)
    .map((course) => ({
      id: course.courseId,
      label: course.title,
      value: course.views,
      sub: `${formatCount(course.impressions)} impressions · ${formatWatch(course.avgWatchSeconds)} avg. watch`,
    }));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] leading-tight font-bold tracking-tight">Analytics</h1>
          <p className="mt-1.5 max-w-2xl text-[14px] text-muted-foreground">
            How learners discover and watch your catalog. Reach and watch time only — money lives on
            the <span className="font-medium text-foreground">Earnings</span> page.
          </p>
        </div>
        <AnalyticsRangeSelector active={active} />
      </header>

      {!engagement.available ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-[13px] text-amber-900">
          <p className="font-semibold">Engagement tracking is not available</p>
          <p className="mt-1 text-amber-800">
            The platform service key is not configured, so course events cannot be aggregated. The
            counts below stay at zero until it is set — they are never estimated.
          </p>
        </div>
      ) : null}

      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Eye}
          label={`Course views (${active})`}
          value={formatCount(totals.views)}
          delta={delta(totals.views, previous.views)?.label}
          deltaDown={delta(totals.views, previous.views)?.down}
          hint={`${formatCount(totals.viewers)} signed-in learners`}
        />
        <StatCard
          icon={MousePointerClick}
          label="Card impressions"
          value={formatCount(totals.impressions)}
          delta={delta(totals.impressions, previous.impressions)?.label}
          deltaDown={delta(totals.impressions, previous.impressions)?.down}
          hint="times a card entered a viewport"
        />
        <StatCard
          icon={Timer}
          label="Avg. watch duration"
          value={formatWatch(totals.avgWatchSeconds)}
          hint={`per sitting · ${formatMinutes(totals.watchMinutes)} total`}
        />
        <StatCard
          icon={Users}
          label="New enrollments"
          value={formatCount(totals.enrollments)}
          delta={delta(totals.enrollments, previous.enrollments)?.label}
          deltaDown={delta(totals.enrollments, previous.enrollments)?.down}
          hint={`${percent(totals.enrollments, totals.views)} of views`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-border bg-white p-5 shadow-card lg:col-span-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-[15px] font-semibold tracking-tight">Views over time</h2>
            <p className="text-[12px] text-muted-foreground">
              Daily course-page opens · last {engagement.days} days
            </p>
          </div>
          {!hasActivity ? (
            <EmptyState
              className="mt-4 border-0 bg-muted/30 py-10"
              icon={BarChart3}
              title="No engagement recorded yet"
              description="Nothing has been tracked in this window. Impressions start counting the moment a learner scrolls your course card into view."
            />
          ) : (
            <AreaChart className="mt-4" data={viewSeries} />
          )}
        </section>

        <section className="rounded-xl border border-border bg-white p-5 shadow-card">
          <h2 className="font-display text-[15px] font-semibold tracking-tight">Discovery funnel</h2>
          <p className="mt-1 text-[12px] text-muted-foreground">Where attention turns into sales.</p>
          <div className="mt-4 space-y-2">
            <FunnelStep
              icon={MousePointerClick}
              label="Impressions"
              value={formatCount(totals.impressions)}
            />
            <div className="flex justify-center text-zinc-300" aria-hidden>
              <ArrowRight className="size-4 rotate-90" />
            </div>
            <FunnelStep
              icon={Eye}
              label="Course views"
              value={formatCount(totals.views)}
              rate={percent(totals.views, totals.impressions)}
              rateLabel="of impressions clicked"
            />
            <div className="flex justify-center text-zinc-300" aria-hidden>
              <ArrowRight className="size-4 rotate-90" />
            </div>
            <FunnelStep
              icon={TrendingUp}
              label="Enrollments"
              value={formatCount(totals.enrollments)}
              rate={percent(totals.enrollments, totals.views)}
              rateLabel="of viewers enrolled"
            />
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-border bg-white p-5 shadow-card lg:col-span-2">
          <h2 className="font-display text-[15px] font-semibold tracking-tight">Watch time by course</h2>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Total minutes of lesson playback, longest first.
          </p>
          {totals.watchSeconds === 0 ? (
            <p className="mt-4 text-[13px] text-muted-foreground">
              No lesson playback has been recorded in this window.
            </p>
          ) : (
            <BarList
              className="mt-5"
              data={byCourse
                .filter((course) => course.watchSeconds > 0)
                .slice(0, 8)
                .map((course) => ({
                  id: course.courseId,
                  label: course.title,
                  value: Math.round(course.watchSeconds / 60),
                  sub: `${formatCount(course.watchSessions)} sittings · ${formatWatch(course.avgWatchSeconds)} each`,
                }))}
            />
          )}
        </section>

        <section className="rounded-xl border border-border bg-white p-5 shadow-card">
          <h2 className="font-display text-[15px] font-semibold tracking-tight">Most viewed</h2>
          <p className="mt-1 text-[12px] text-muted-foreground">Course pages opened in this window.</p>
          {topByViews.length === 0 ? (
            <p className="mt-4 text-[13px] text-muted-foreground">No course page has been opened yet.</p>
          ) : (
            <BarList className="mt-5" data={topByViews} />
          )}
        </section>
      </div>

      <section className="rounded-xl border border-border bg-white shadow-card">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-5 py-4">
          <h2 className="font-display text-[15px] font-semibold tracking-tight">Course breakdown</h2>
          <p className="text-[12px] text-muted-foreground">
            {tracked.length} of {totals.courses} courses tracked · {formatCount(totals.students)} learners all-time
          </p>
        </div>
        {byCourse.length === 0 ? (
          <EmptyState
            className="border-0 bg-white"
            icon={PlayCircle}
            title="Publish a course to see analytics"
            description="Engagement is measured on published catalog listings. Drafts collect nothing."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-muted/40 text-[11.5px] tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Course</th>
                  <th className="px-3 py-2.5 font-medium">Impressions</th>
                  <th className="px-3 py-2.5 font-medium">Views</th>
                  <th className="px-3 py-2.5 font-medium">Learners</th>
                  <th className="px-3 py-2.5 font-medium">Avg. watch</th>
                  <th className="px-3 py-2.5 font-medium">Watch time</th>
                  <th className="px-5 py-2.5 text-right font-medium">Enrolled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {byCourse.map((course) => (
                  <tr key={course.courseId} className="hover:bg-muted/30">
                    <td className="max-w-[280px] px-5 py-3">
                      <p className="truncate font-medium">{course.title}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <StatusBadge status={course.status} className="scale-90 -translate-x-1" />
                        <span className="text-[11.5px] text-zinc-400">
                          {formatCount(course.students)} all-time
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 tabular-nums">{formatCount(course.impressions)}</td>
                    <td className="px-3 py-3 tabular-nums">{formatCount(course.views)}</td>
                    <td className="px-3 py-3 tabular-nums">{formatCount(course.viewers)}</td>
                    <td className="px-3 py-3 tabular-nums">{formatWatch(course.avgWatchSeconds)}</td>
                    <td className="px-3 py-3 tabular-nums">{formatMinutes(Math.round(course.watchSeconds / 60))}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatCount(course.enrollments)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-[12px] leading-relaxed text-zinc-400">
        An impression is counted when a course card enters a learner&apos;s viewport, once per course per
        page view. A view is a course page open. Watch time is whole seconds of lesson playback from a
        signed-in learner, so previews watched while signed out are not included. Course events older
        than the platform retention window are pruned, and nothing here is sampled or modelled.
      </p>
    </div>
  );
}
