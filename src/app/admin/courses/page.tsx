import Link from "next/link";
import { BookOpen, IndianRupee } from "lucide-react";
import { getAdminCourses } from "@/lib/server/admin";
import { money } from "@/lib/admin";
import { StatusBadge } from "@/components/creator/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { AdminCourseFilters } from "./course-filters";
import { QuickApproveButton } from "./quick-approve-button";

export const metadata = { title: "Courses" };
export const dynamic = "force-dynamic";

const FILTERS = [
  { id: "pending", label: "In review" },
  { id: "draft", label: "Drafts" },
  { id: "published", label: "Published" },
  { id: "changes_requested", label: "Needs changes" },
  { id: "rejected", label: "Rejected" },
  { id: "unpublished", label: "Unpublished" },
  { id: "archived", label: "Archived" },
  { id: "all", label: "All" },
];

export default async function AdminCoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const active = status && FILTERS.some((f) => f.id === status) ? status : "pending";
  const [courses, all] = await Promise.all([getAdminCourses(active), getAdminCourses(null)]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-[26px] leading-tight font-bold tracking-tight">Courses</h1>
        <p className="mt-1.5 text-[14px] text-muted-foreground">
          {all.length} course{all.length === 1 ? "" : "s"} in Zybble. Creators can publish and earn on
          paid courses immediately; saved UPI/bank details are required only when requesting a payout.
        </p>
      </header>

      <AdminCourseFilters filters={FILTERS} active={active} counts={countsByStatus(all)} />

      {courses.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No courses in this view"
          description="Nothing is generated: courses appear here only once a real creator creates them."
        />
      ) : (
        <ul className="space-y-3">
          {courses.map((course) => (
            <li key={course.id} className="rounded-xl border border-border bg-white p-4 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/admin/courses/${course.id}`} className="font-display text-[15px] font-semibold tracking-tight hover:underline">
                      {course.title}
                    </Link>
                    <StatusBadge status={course.status} />
                    {course.pricePaise > 0 ? (
                      <span className="rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                        Payout dest: {course.routeStatus?.startsWith("details_saved") ? "saved" : "not saved yet"}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[12.5px] text-muted-foreground">
                    {course.creatorName}
                    {course.creatorUsername ? ` · @${course.creatorUsername}` : ""} · {course.categoryName ?? "Uncategorised"}
                  </p>
                  <dl className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-muted-foreground">
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
                    <div className="flex gap-1">
                      <dt>Rating</dt>
                      <dd className="font-medium text-foreground tabular-nums">
                        {course.ratingsCount > 0 ? `${course.rating.toFixed(1)} (${course.ratingsCount})` : "—"}
                      </dd>
                    </div>
                    <div className="flex gap-1">
                      <dt>Submitted</dt>
                      <dd className="font-medium text-foreground">
                        {course.submittedAt ? new Date(course.submittedAt).toLocaleDateString("en-IN") : "—"}
                      </dd>
                    </div>
                  </dl>
                  {course.rejectionReason ? (
                    <p className="mt-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
                      Last note: {course.rejectionReason}
                    </p>
                  ) : null}
                </div>

                {course.status === "pending" ? (
                  <QuickApproveButton courseId={course.id} paid={course.pricePaise > 0} />
                ) : (
                  <Link
                    href={`/admin/courses/${course.id}`}
                    className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-[13px] font-medium transition-colors hover:bg-muted/50"
                  >
                    Review
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function countsByStatus(courses: Array<{ status: string }>): Record<string, number> {
  const counts: Record<string, number> = { all: courses.length };
  for (const course of courses) counts[course.status] = (counts[course.status] ?? 0) + 1;
  return counts;
}