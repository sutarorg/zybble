import { Clock, Users, Wallet, BookOpen } from "lucide-react";
import { getCreatorAnalytics, getCreatorCourses } from "@/lib/server/creator";
import { money } from "@/lib/creator";
import { formatInrCompact } from "@/lib/money";
import { StatCard } from "@/components/creator/stat-card";
import { AreaChart, BarList } from "@/components/creator/charts";
import { EmptyState } from "@/components/ui/empty-state";
import { AnalyticsRangeSelector } from "../analytics-range";

export const metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

type Range = "7d" | "30d" | "90d" | "1y";

export default async function CreatorAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range } = await searchParams;
  const active: Range = range === "7d" || range === "90d" || range === "1y" ? range : "30d";

  const [analytics, courses] = await Promise.all([getCreatorAnalytics(active), getCreatorCourses()]);

  const chartData = analytics.points.map((point) => ({ label: point.label, value: point.revenuePaise }));
  const enrollChart = analytics.points.map((point) => ({ label: point.label, value: point.enrollments }));

  const byCourse = [...courses]
    .filter((course) => course.studentsCount > 0)
    .sort((a, b) => b.studentsCount - a.studentsCount)
    .slice(0, 8)
    .map((course) => ({
      id: course.id,
      label: course.title,
      value: course.studentsCount,
      sub: `${course.lessonsCount} lessons · ${course.ratingsCount} ratings`,
    }));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] leading-tight font-bold tracking-tight">Analytics</h1>
          <p className="mt-1.5 text-[14px] text-muted-foreground">
            Aggregated from your own orders, entitlements and reviews. No sampling or modelled figures.
          </p>
        </div>
        <AnalyticsRangeSelector active={active} />
      </header>

      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Wallet}
          label={`Net revenue (${active})`}
          value={formatInrCompact(analytics.totals.revenuePaise)}
        />
        <StatCard icon={Users} label="New enrollments" value={String(analytics.totals.enrollments)} />
        <StatCard icon={BookOpen} label="Courses" value={String(analytics.totals.courses)} />
        <StatCard icon={Users} label="Total students" value={String(analytics.totals.students)} />
      </div>

      <section className="rounded-xl border border-border bg-white p-5 shadow-card">
        <h2 className="font-display text-[15px] font-semibold tracking-tight">Revenue over time</h2>
        {chartData.length === 0 || analytics.totals.revenuePaise === 0 ? (
          <EmptyState
            className="mt-4 border-0 bg-muted/30 py-10"
            icon={Clock}
            title="No revenue in this window"
            description="Nothing has been sold in the selected period, so there is nothing to chart."
          />
        ) : (
          <AreaChart className="mt-4" data={chartData} formatValue={(value) => money(value)} />
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-white p-5 shadow-card">
          <h2 className="font-display text-[15px] font-semibold tracking-tight">Enrollments over time</h2>
          {analytics.totals.enrollments === 0 ? (
            <p className="mt-4 text-[13px] text-muted-foreground">No enrollments in this window.</p>
          ) : (
            <AreaChart className="mt-4" data={enrollChart} />
          )}
        </section>

        <section className="rounded-xl border border-border bg-white p-5 shadow-card">
          <h2 className="font-display text-[15px] font-semibold tracking-tight">Learners per course</h2>
          {byCourse.length === 0 ? (
            <p className="mt-4 text-[13px] text-muted-foreground">
              No course has enrolled a learner yet.
            </p>
          ) : (
            <BarList className="mt-5" data={byCourse} />
          )}
        </section>
      </div>
    </div>
  );
}