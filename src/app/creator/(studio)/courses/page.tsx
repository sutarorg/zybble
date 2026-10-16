import Link from "next/link";
import { GraduationCap, Plus } from "lucide-react";
import { getCreatorCourses } from "@/lib/server/creator";
import { money } from "@/lib/creator";
import { StatusBadge } from "@/components/creator/status-badge";
import { CourseRowActions } from "./course-row-actions";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "My courses" };
export const dynamic = "force-dynamic";

export default async function CreatorCoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const all = await getCreatorCourses();

  const FILTERS = [
    { id: "all", label: "All" },
    { id: "draft", label: "Drafts" },
    { id: "pending", label: "In review" },
    { id: "published", label: "Published" },
    { id: "changes_requested", label: "Needs changes" },
  ] as const;

  const active = FILTERS.some((filter) => filter.id === status) ? status! : "all";
  const courses = active === "all" ? all : all.filter((course) => course.status === active);

  return (
    <div className="space-y-6 [animation:fadeSlide_.35s_ease_both]">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] leading-tight font-bold tracking-tight">My courses</h1>
          <p className="mt-1.5 text-[14px] text-muted-foreground">
            {all.length} course{all.length === 1 ? "" : "s"} · every course is reviewed before it is listed publicly.
          </p>
        </div>
        <Button asChild>
          <Link href="/creator/courses/new">
            <Plus className="size-4" aria-hidden /> New course
          </Link>
        </Button>
      </header>

      <nav className="flex flex-wrap gap-2" aria-label="Filter courses by status">
        {FILTERS.map((filter) => {
          const count =
            filter.id === "all" ? all.length : all.filter((course) => course.status === filter.id).length;
          return (
            <Link
              key={filter.id}
              href={filter.id === "all" ? "/creator/courses" : `/creator/courses?status=${filter.id}`}
              className={`rounded-lg border px-3 py-1.5 text-[13px] transition-colors ${
                active === filter.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-white text-muted-foreground hover:bg-muted/60"
              }`}
            >
              {filter.label} <span className="tabular-nums opacity-70">{count}</span>
            </Link>
          );
        })}
      </nav>

      {courses.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title={all.length === 0 ? "You have not created a course yet" : "Nothing in this view"}
          description={
            all.length === 0
              ? "Create a course, add its curriculum and thumbnail, then submit it for review."
              : "Switch to another filter to see your other courses."
          }
          action={
            all.length === 0 ? (
              <Button asChild>
                <Link href="/creator/courses/new">
                  <Plus className="size-4" aria-hidden /> New course
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="space-y-3">
          {courses.map((course) => (
            <li key={course.id} className="rounded-2xl border border-border bg-white p-4 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate font-display text-[15px] font-semibold tracking-tight">
                      {course.title}
                    </h2>
                    <StatusBadge status={course.status} />
                  </div>
                  <p className="mt-1 line-clamp-1 text-[13px] text-muted-foreground">
                    {course.subtitle || "No subtitle yet"}
                  </p>
                  <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-muted-foreground">
                    <div className="flex gap-1">
                      <dt>Price</dt>
                      <dd className="font-medium text-foreground tabular-nums">
                        {course.pricePaise === 0 ? "Free" : money(course.pricePaise)}
                      </dd>
                    </div>
                    <div className="flex gap-1">
                      <dt>Lessons</dt>
                      <dd className="font-medium text-foreground tabular-nums">{course.lessonsCount}</dd>
                    </div>
                    <div className="flex gap-1">
                      <dt>Learners</dt>
                      <dd className="font-medium text-foreground tabular-nums">{course.studentsCount}</dd>
                    </div>
                    {course.categoryName ? (
                      <div className="flex gap-1">
                        <dt>Category</dt>
                        <dd className="font-medium text-foreground">{course.categoryName}</dd>
                      </div>
                    ) : null}
                    <div className="flex gap-1">
                      <dt>Updated</dt>
                      <dd className="font-medium text-foreground">{new Date(course.updatedAt).toLocaleDateString("en-IN")}</dd>
                    </div>
                  </dl>
                  {course.rejectionReason ? (
                    <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
                      <strong className="font-semibold">Reviewer note:</strong> {course.rejectionReason}
                    </p>
                  ) : null}
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  {course.status === "published" ? (
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/courses/${course.slug}`}>View live</Link>
                    </Button>
                  ) : null}
                  <CourseRowActions
                    courseId={course.id}
                    status={course.status}
                    lessonsCount={course.lessonsCount}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}