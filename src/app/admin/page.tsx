import Link from "next/link";
import {
  BookOpenCheck,
  GraduationCap,
  IndianRupee,
  Landmark,
  ShieldAlert,
  Users,
  Wallet,
  ArrowRight,
} from "lucide-react";
import { getAdminOverview, getAdminCourses, getAdminReports } from "@/lib/server/admin";
import { money } from "@/lib/admin";
import { StatCard } from "@/components/creator/stat-card";
import { StatusBadge } from "@/components/creator/status-badge";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const [overview, pending, reports] = await Promise.all([
    getAdminOverview(),
    getAdminCourses("pending"),
    getAdminReports(),
  ]);

  const openReports = reports.filter((report) => report.status === "open" || report.status === "under_review");
  const urgentReports = openReports.filter((report) => report.priority === "high");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-[26px] leading-tight font-bold tracking-tight">Marketplace overview</h1>
        <p className="mt-1.5 text-[14px] text-muted-foreground">
          Live figures from Postgres. Money is INR (₹), stored as integer paise.
        </p>
      </header>

      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={IndianRupee} label="Gross volume" value={money(overview.grossPaise)} />
        <StatCard icon={Wallet} label="Creator payable" value={money(overview.creatorPayablePaise)} />
        <StatCard icon={Landmark} label="Settled by Razorpay" value={money(overview.settledPaise)} />
        <StatCard
          icon={ShieldAlert}
          label="Failed transfers"
          value={String(overview.failedTransfers)}
          hint={overview.failedTransfers > 0 ? "needs attention" : "none"}
        />
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={BookOpenCheck} label="Courses" value={String(overview.courses)} hint={`${overview.publishedCourses} published`} />
        <StatCard icon={Users} label="Learners" value={String(overview.learners)} hint={`${overview.creators} creators`} />
        <StatCard icon={GraduationCap} label="Paid orders" value={String(overview.orders)} />
        <StatCard icon={IndianRupee} label="Commission earned" value={money(overview.commissionPaise)} />
      </div>

      {overview.refundedPaise > 0 ? (
        <div className="rounded-xl border border-orange-200 bg-orange-50/60 px-4 py-3 text-[13px] text-orange-900">
          Razorpay has recorded {money(overview.refundedPaise)} in refunds against marketplace payments. These are
          provider events recorded for accurate accounting — Zybble publishes no customer-facing refund policy.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-white p-5 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-[15px] font-semibold tracking-tight">
              Awaiting review
              <span className="ml-2 rounded-md bg-amber-100 px-1.5 py-0.5 text-[11.5px] font-semibold text-amber-700">
                {pending.length}
              </span>
            </h2>
            <Link href="/admin/courses?status=pending" className="text-[13px] font-medium text-primary underline">
              Open queue
            </Link>
          </div>
          {pending.length === 0 ? (
            <p className="mt-4 text-[13px] text-muted-foreground">
              The moderation queue is empty. Nothing is auto-approved.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {pending.slice(0, 6).map((course) => (
                <li key={course.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/courses/${course.id}`} className="truncate text-[13.5px] font-medium hover:underline">
                      {course.title}
                    </Link>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      {course.creatorName} · {course.lessonsCount} lessons ·{" "}
                      {course.pricePaise === 0 ? "Free" : money(course.pricePaise)}
                    </p>
                  </div>
                  <StatusBadge status={course.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-border bg-white p-5 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-[15px] font-semibold tracking-tight">Open reports</h2>
            <Link href="/admin/reports" className="text-[13px] font-medium text-primary underline">
              View all
            </Link>
          </div>
          {openReports.length === 0 ? (
            <p className="mt-4 text-[13px] text-muted-foreground">No open reports.</p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {openReports.slice(0, 6).map((report) => (
                <li key={report.id} className="py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10.5px] font-semibold uppercase ${
                        report.priority === "high"
                          ? "bg-red-100 text-red-700"
                          : report.priority === "medium"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      {report.priority}
                    </span>
                    <span className="truncate text-[13.5px] font-medium">{report.targetTitle}</span>
                  </div>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    {report.reason} · {report.reporterName} · {new Date(report.submittedAt).toLocaleDateString("en-IN")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {urgentReports.length > 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
          <ShieldAlert className="size-4 shrink-0" aria-hidden />
          {urgentReports.length} high-priority report{urgentReports.length === 1 ? "" : "s"} need a decision.{" "}
          <Link href="/admin/reports" className="font-medium underline">
            Review now <ArrowRight className="inline size-3.5" aria-hidden />
          </Link>
        </div>
      ) : (
        <EmptyState
          className="py-8"
          icon={BookOpenCheck}
          title="The marketplace has no activity yet"
          description="These counters come straight from Postgres. They stay at zero — honestly — until real creators, courses and buyers exist."
        />
      )}
    </div>
  );
}