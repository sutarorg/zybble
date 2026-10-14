import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Clock,
  Flame,
  GraduationCap,
  PlayCircle,
  Sparkles,
  Target,
} from "lucide-react";
import {
  getEnrollments,
  getRecentViews,
  getOrders,
  getWishlist,
} from "@/lib/server/learner";
import { requireSession } from "@/lib/server/session";
import { formatInr } from "@/lib/money";
import { timeAgo } from "@/lib/format";
import { StatCard } from "@/components/creator/stat-card";
import { ProgressBar } from "@/components/learner/progress-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { imagePath } from "@/lib/image-path";

export const metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

export default async function LearnerDashboardPage() {
  const session = await requireSession();
  const [enrollments, recentViews, orders, wishlist] = await Promise.all([
    getEnrollments(),
    getRecentViews(),
    getOrders(),
    getWishlist(),
  ]);

  const inProgress = enrollments.filter((enrollment) => enrollment.progressPercent > 0 && enrollment.progressPercent < 100);
  const completed = enrollments.filter((enrollment) => enrollment.progressPercent >= 100);
  const minutesLearned = enrollments.reduce(
    (sum, enrollment) => sum + Math.round((enrollment.course.durationMinutes * enrollment.progressPercent) / 100),
    0
  );
  const totalSpent = orders
    .filter((order) => order.status === "paid")
    .reduce((sum, order) => sum + order.totalPaise, 0);
  const firstName = session.fullName.split(" ")[0] ?? session.fullName;

  return (
    <div className="space-y-6 px-4 py-7 sm:px-6 lg:px-9">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] leading-tight font-bold tracking-tight">
            Welcome back, {firstName}
          </h1>
          <p className="mt-1.5 text-[14px] text-muted-foreground">
            Pick up where you left off, or explore what other Indian creators are teaching.
          </p>
        </div>
        <Button asChild>
          <Link href="/explore">
            Explore courses <ArrowRight className="ml-1 size-4" aria-hidden />
          </Link>
        </Button>
      </header>

      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={GraduationCap}
          label="Courses enrolled"
          value={String(enrollments.length)}
          hint={`${completed.length} completed`}
        />
        <StatCard icon={Clock} label="Minutes learned" value={String(minutesLearned)} />
        <StatCard icon={Target} label="In progress" value={String(inProgress.length)} />
        <StatCard
          icon={Flame}
          label="Total spent"
          value={formatInr(totalSpent)}
          hint={`${orders.length} orders`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-border bg-white p-5 shadow-card lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-[15px] font-semibold tracking-tight">Continue learning</h2>
            <Link href="/my-learning" className="text-[13px] font-medium text-primary underline">
              All courses
            </Link>
          </div>

          {inProgress.length === 0 ? (
            <EmptyState
              className="mt-4"
              icon={BookOpen}
              title={enrollments.length === 0 ? "You are not enrolled in anything yet" : "Nothing in progress"}
              description={
                enrollments.length === 0
                  ? "Free preview lessons let you try a course before you buy it."
                  : "Every enrolled course is already complete. Nice work."
              }
              action={
                <Button asChild>
                  <Link href="/explore">Browse the catalog</Link>
                </Button>
              }
            />
          ) : (
            <ul className="mt-4 space-y-3">
              {inProgress.slice(0, 5).map((enrollment) => (
                <li key={enrollment.course.id} className="flex gap-3.5 rounded-xl border border-border p-3">
                  {enrollment.course.thumbnailKey ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imagePath("thumbnails", enrollment.course.thumbnailKey)}
                      alt=""
                      className="h-16 w-28 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-28 shrink-0 items-center justify-center rounded-lg bg-muted text-zinc-400">
                      <BookOpen className="size-5" aria-hidden />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold">{enrollment.course.title}</p>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      {enrollment.course.creatorName} · {enrollment.totalLessons} lessons
                    </p>
                    <ProgressBar className="mt-2.5" percent={enrollment.progressPercent} />
                    <p className="mt-1.5 text-[11.5px] text-zinc-400">
                      {enrollment.completedCount} of {enrollment.totalLessons} lessons complete
                    </p>
                  </div>
                  <Button asChild size="sm" className="shrink-0 self-center">
                    <Link href={`/learn/${enrollment.course.id}`}>
                      <PlayCircle className="size-4" aria-hidden /> Resume
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-4">
          <section className="rounded-xl border border-border bg-white p-5 shadow-card">
            <h2 className="flex items-center gap-2 font-display text-[15px] font-semibold tracking-tight">
              <Sparkles className="size-4 text-primary" aria-hidden /> Recently viewed
            </h2>
            {recentViews.length === 0 ? (
              <p className="mt-3 text-[13px] text-muted-foreground">
                Courses you open are listed here so you can come back to them.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {recentViews.slice(0, 5).map((view) => (
                  <li key={view.course.id}>
                    <Link href={`/courses/${view.course.slug}`} className="group block">
                      <p className="truncate text-[13.5px] font-medium group-hover:underline">
                        {view.course.title}
                      </p>
                      <p className="mt-0.5 text-[11.5px] text-zinc-400">{timeAgo(view.viewedAt)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-border bg-white p-5 shadow-card">
            <h2 className="font-display text-[15px] font-semibold tracking-tight">Wishlist</h2>
            {wishlist.length === 0 ? (
              <p className="mt-3 text-[13px] text-muted-foreground">
                Your wishlist is empty. Bookmark a course to save it here.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {wishlist.slice(0, 5).map((course) => (
                  <li key={course.id}>
                    <Link href={`/courses/${course.slug}`} className="text-[13px] font-medium hover:underline">
                      {course.title}
                    </Link>
                    <span className="ml-2 text-[12px] text-muted-foreground tabular-nums">
                      {course.pricePaise === 0 ? "Free" : formatInr(course.pricePaise)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}