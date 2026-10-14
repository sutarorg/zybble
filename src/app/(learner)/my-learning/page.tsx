import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, PlayCircle } from "lucide-react";
import { getEnrollments } from "@/lib/server/learner";
import { formatInr } from "@/lib/money";
import { ProgressBar } from "@/components/learner/progress-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { imagePath } from "@/lib/image-path";

export const metadata: Metadata = {
  title: "My Learning",
  description: "Courses you're enrolled in, with your progress.",
};

export const dynamic = "force-dynamic";

export default async function MyLearningPage() {
  const enrollments = await getEnrollments();
  const inProgress = enrollments.filter((e) => e.progressPercent > 0 && e.progressPercent < 100);
  const notStarted = enrollments.filter((e) => e.progressPercent === 0);
  const completed = enrollments.filter((e) => e.progressPercent >= 100);

  return (
    <div className="space-y-6 px-4 py-7 sm:px-6 lg:px-9">
      <header>
        <h1 className="font-display text-[26px] leading-tight font-bold tracking-tight">My learning</h1>
        <p className="mt-1.5 text-[14px] text-muted-foreground">
          {enrollments.length === 0
            ? "Courses you buy or start for free appear here."
            : `${enrollments.length} course${enrollments.length === 1 ? "" : "s"} · ${completed.length} completed`}
        </p>
      </header>

      {enrollments.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Nothing here yet"
          description="Buy a course, or start with a free preview lesson, and it will appear in this list with your progress."
          action={
            <Button asChild>
              <Link href="/explore">Browse the catalog</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {[
            { title: "In progress", items: inProgress },
            { title: "Not started", items: notStarted },
            { title: "Completed", items: completed },
          ]
            .filter((group) => group.items.length > 0)
            .map((group) => (
              <section key={group.title}>
                <h2 className="font-display text-[15px] font-semibold tracking-tight">
                  {group.title}{" "}
                  <span className="text-[13px] font-normal text-muted-foreground">({group.items.length})</span>
                </h2>
                <ul className="mt-3 grid gap-3 lg:grid-cols-2">
                  {group.items.map((enrollment) => (
                    <li key={enrollment.course.id} className="flex gap-3.5 rounded-xl border border-border bg-white p-3.5 shadow-card">
                      {enrollment.course.thumbnailKey ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={imagePath("thumbnails", enrollment.course.thumbnailKey)}
                          alt=""
                          className="h-20 w-32 shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-20 w-32 shrink-0 items-center justify-center rounded-lg bg-muted text-zinc-400">
                          <BookOpen className="size-5" aria-hidden />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/courses/${enrollment.course.slug}`}
                          className="line-clamp-2 text-[14px] font-semibold hover:underline"
                        >
                          {enrollment.course.title}
                        </Link>
                        <p className="mt-0.5 text-[12px] text-muted-foreground">
                          {enrollment.course.creatorName} · {enrollment.totalLessons} lessons ·{" "}
                          {enrollment.course.pricePaise === 0 ? "Free" : formatInr(enrollment.course.pricePaise)}
                        </p>
                        <ProgressBar
                          className="mt-2.5"
                          percent={enrollment.progressPercent}
                          label={`${enrollment.course.title} progress`}
                        />
                        <p className="mt-1.5 text-[11.5px] text-zinc-400">
                          {enrollment.completedCount}/{enrollment.totalLessons} lessons ·{" "}
                          {enrollment.progressPercent}%
                        </p>
                      </div>
                      <Button asChild size="sm" className="shrink-0 self-center">
                        <Link href={`/learn/${enrollment.course.id}`}>
                          <PlayCircle className="size-4" aria-hidden />
                          {enrollment.progressPercent === 0 ? "Start" : "Resume"}
                        </Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
        </div>
      )}
    </div>
  );
}