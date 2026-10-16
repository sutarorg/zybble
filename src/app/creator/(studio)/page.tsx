import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  Clock,
  Eye,
  GraduationCap,
  Plus,
  Sparkles,
  Users,
  Wallet,
  ClipboardCheck,
} from "lucide-react";
import { getCreatorCourses, getCreatorFinance, getCreatorAnalytics, getRouteOnboardingState } from "@/lib/server/creator";
import { money } from "@/lib/creator";
import { formatInrCompact } from "@/lib/money";
import { formatCompact } from "@/lib/format";
import { StatCard } from "@/components/creator/stat-card";
import { AreaChart, BarList } from "@/components/creator/charts";
import { StatusBadge } from "@/components/creator/status-badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { AnalyticsRangeSelector } from "./analytics-range";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function CreatorDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range } = await searchParams;
  const activeRange: AnalyticsRangeSelectorRange =
    range === "7d" || range === "90d" || range === "1y" ? range : "30d";

  const [courses, finance, analytics, route] = await Promise.all([
    getCreatorCourses(),
    getCreatorFinance(),
    getCreatorAnalytics(activeRange),
    getRouteOnboardingState(),
  ]);

  const published = courses.filter((course) => course.status === "published");
  const pending = courses.filter(
    (course) => course.status === "pending" || course.status === "changes_requested"
  );
  const students = published.reduce((total, course) => total + course.studentsCount, 0);

  const chartData = analytics.points.map((point) => ({ label: point.label, value: point.revenuePaise }));
  const rangeTotal = chartData.reduce((sum, point) => sum + point.value, 0);

  const topCourses = [...published]
    .sort((a, b) => b.studentsCount - a.studentsCount)
    .slice(0, 5)
    .map((course) => ({
      id: course.id,
      label: course.title,
      value: course.studentsCount,
      sub: course.ratingsCount > 0 ? `${course.rating.toFixed(1)} ★ from ${course.ratingsCount} ratings` : "No ratings yet",
    }));

  const firstName = courses.length > 0 ? "" : "";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] leading-tight font-bold tracking-tight">
            Creator dashboard
          </h1>
          <p className="mt-1.5 text-[14px] text-muted-foreground">
            Real figures from your courses, captured learner orders, and manual payouts.
          </p>
        </div>
        <Button asChild>
          <Link href="/creator/courses/new">
            <Plus className="size-4" aria-hidden /> New course
          </Link>
        </Button>
      </header>

      {!route.hasAccount && finance.netEarnedPaise > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-[13px] text-amber-900">
          <p className="font-semibold">Save a payout destination to request your earnings</p>
          <p className="mt-1 text-amber-800">
            You have {money(finance.availablePaise)} in available creator earnings. Add a UPI ID or
            Indian bank account whenever you are ready to request a manual payout.
          </p>
          <Link href="/creator/payouts" className="mt-2 inline-flex items-center gap-1 font-medium underline">
            Configure payout destination <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      ) : null}

      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={BookOpenCheck}
          label="Published courses"
          value={String(published.length)}
          hint={`of ${courses.length} total`}
        />
        <StatCard icon={Users} label="Students enrolled" value={formatCompact(students)} />
        <StatCard
          icon={Wallet}
          label="Net earnings"
          value={formatInrCompact(finance.netEarnedPaise)}
          hint={`after ${finance.commissionPercentLabel}% commission`}
        />
        <StatCard
          icon={ClipboardCheck}
          label="Awaiting review"
          value={String(pending.length)}
          hint={pending.length > 0 ? "in the moderation queue" : "nothing queued"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-border bg-white p-5 shadow-card lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-[15px] font-semibold tracking-tight">Revenue trend</h2>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                Your share of ₹{formatInrCompact(rangeTotal).replace("₹", "")} in gross sales this period
              </p>
            </div>
            <AnalyticsRangeSelector active={activeRange} />
          </div>
          <div className="mt-5">
            {chartData.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="No sales in this period"
                description="Once a learner pays for one of your courses, your share appears here."
                className="border-0 bg-muted/30 py-10"
              />
            ) : (
              <AreaChart data={chartData} formatValue={(value) => money(value)} />
            )}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-white p-5 shadow-card">
          <h2 className="font-display text-[15px] font-semibold tracking-tight">Top courses by learners</h2>
          {topCourses.length === 0 ? (
            <p className="mt-4 text-[13px] text-muted-foreground">
              Publish a course to start seeing enrollment numbers here.
            </p>
          ) : (
            <BarList className="mt-5" data={topCourses} formatValue={(value) => String(value)} />
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-white p-5 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-[15px] font-semibold tracking-tight">Your courses</h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="/creator/courses">
                View all ({courses.length}) <ArrowRight className="ml-1 size-3.5" aria-hidden />
              </Link>
            </Button>
          </div>
          {courses.length === 0 ? (
            <EmptyState
              className="mt-4"
              icon={GraduationCap}
              title="No courses yet"
              description="Create your first course, add its curriculum, then submit it for review."
              action={
                <Button asChild>
                  <Link href="/creator/courses/new">
                    <Plus className="size-4" aria-hidden /> New course
                  </Link>
                </Button>
              }
            />
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {courses.slice(0, 6).map((course) => (
                <li key={course.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium">{course.title}</p>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      {course.lessonsCount} lessons · {course.studentsCount} learners · {money(course.pricePaise)}
                    </p>
                  </div>
                  <StatusBadge status={course.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-border bg-white p-5 shadow-card">
          <h2 className="font-display text-[15px] font-semibold tracking-tight">Money movement</h2>
          <dl className="mt-4 space-y-3">
            {[
              { label: "Gross course sales", value: finance.grossPaise },
              { label: `Zybble commission (${finance.commissionPercentLabel}%)`, value: -finance.commissionPaise },
              { label: "Net earned", value: finance.netEarnedPaise },
              { label: "Available to request", value: finance.availablePaise },
              { label: "Reserved in pending requests", value: finance.reservedPendingPaise },
              { label: "Paid out to you", value: finance.paidOutPaise },
              { label: "Refund adjustments", value: finance.refundedCreatorSharePaise },
            ].map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-4 text-[13px]">
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className="font-medium tabular-nums">{money(row.value)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-[12px] text-zinc-400">
            Figures reconcile captured orders, processed refunds, and confirmed manual payouts in INR paise.
          </p>
        </section>
      </div>

      {firstName ? null : null}

      <section className="rounded-xl border border-border bg-white p-5 shadow-card">
        <h2 className="flex items-center gap-2 font-display text-[15px] font-semibold tracking-tight">
          <Sparkles className="size-4 text-primary" aria-hidden /> Creator checklist
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Creator profile complete", done: true, href: "/creator/profile" },
            { label: "Payout destination saved", done: route.hasAccount, href: "/creator/payouts" },
            { label: "At least one course", done: courses.length > 0, href: "/creator/courses" },
            {
              label: "A published course",
              done: published.length > 0,
              href: "/creator/courses",
            },
          ].map((item) => (
            <li key={item.label}>
              <Link
                href={item.href}
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-[13px] transition-colors hover:bg-muted/50"
              >
                <span
                  className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    item.done ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"
                  }`}
                  aria-hidden
                >
                  {item.done ? "✓" : "·"}
                </span>
                <span className={item.done ? "text-muted-foreground line-through" : ""}>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-4 flex items-center gap-1.5 text-[12px] text-zinc-400">
          <Eye className="size-3.5" aria-hidden /> Every figure on this page is read from the database at request time.
        </p>
      </section>
    </div>
  );
}

type AnalyticsRangeSelectorRange = "7d" | "30d" | "90d" | "1y";