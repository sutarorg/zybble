import { getAdminAnalytics, getAdminOverview } from "@/lib/server/admin";
import { money } from "@/lib/admin";
import { AreaChart } from "@/components/creator/charts";
import { StatCard } from "@/components/creator/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { IndianRupee, Receipt, GraduationCap, Users } from "lucide-react";

export const metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days } = await searchParams;
  const windowDays = days === "7" || days === "90" ? Number(days) : 30;

  const [points, overview] = await Promise.all([getAdminAnalytics(windowDays), getAdminOverview()]);

  const grossChart = points.map((point) => ({ label: point.label, value: point.grossPaise }));
  const orderChart = points.map((point) => ({ label: point.label, value: point.orders }));
  const windowGross = points.reduce((sum, point) => sum + point.grossPaise, 0);
  const windowOrders = points.reduce((sum, point) => sum + point.orders, 0);
  const windowEnrollments = points.reduce((sum, point) => sum + point.enrollments, 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] leading-tight font-bold tracking-tight">Marketplace analytics</h1>
          <p className="mt-1.5 text-[14px] text-muted-foreground">
            Aggregated from paid orders and entitlements in Postgres over the last {windowDays} days.
          </p>
        </div>
        <nav className="flex gap-1.5" aria-label="Analytics window">
          {[7, 30, 90].map((value) => (
            <a
              key={value}
              href={`/admin/analytics?days=${value}`}
              className={`rounded-lg border px-3 py-1.5 text-[12.5px] font-medium ${
                windowDays === value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-white text-muted-foreground hover:bg-muted/60"
              }`}
            >
              {value}D
            </a>
          ))}
        </nav>
      </header>

      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={IndianRupee} label={`Gross (${windowDays}d)`} value={money(windowGross)} />
        <StatCard icon={Receipt} label="Paid orders" value={String(windowOrders)} />
        <StatCard icon={GraduationCap} label="Enrollments granted" value={String(windowEnrollments)} />
        <StatCard
          icon={Users}
          label="Lifetime commission"
          value={money(overview.commissionPaise)}
          hint="all time"
        />
      </div>

      {points.length === 0 || windowGross === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No sales in this window"
          description="Zybble charts only real transactions. With no paid orders in the selected period there is nothing to plot."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-border bg-white p-5 shadow-card">
            <h2 className="font-display text-[15px] font-semibold tracking-tight">Gross volume</h2>
            <AreaChart className="mt-4" data={grossChart} valueFormat="money" />
          </section>
          <section className="rounded-xl border border-border bg-white p-5 shadow-card">
            <h2 className="font-display text-[15px] font-semibold tracking-tight">Paid orders</h2>
            <AreaChart className="mt-4" data={orderChart} />
          </section>
        </div>
      )}
    </div>
  );
}