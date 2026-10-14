import { notFound } from "next/navigation";
import { getCreatorCourse, getRouteOnboardingState } from "@/lib/server/creator";
import { paiseToRupees } from "@/lib/money";
import { CourseDetailsForm } from "../../new/course-details-form";
import { RouteBlockedNotice } from "../../../route-blocked-notice";
import { StatusBadge } from "@/components/creator/status-badge";

export const metadata = { title: "Edit course" };
export const dynamic = "force-dynamic";

export default async function EditCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [course, route] = await Promise.all([getCreatorCourse(id), getRouteOnboardingState()]);
  if (!course) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-display text-[26px] leading-tight font-bold tracking-tight">Edit course</h1>
          <p className="mt-1.5 text-[14px] text-muted-foreground">{course.title}</p>
        </div>
        <StatusBadge status={course.status} />
      </header>

      {course.status === "published" ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50/60 px-4 py-3.5 text-[13px] text-sky-900">
          This course is published, so its details are locked for buyers. Ask an administrator to unpublish it
          before you make changes — otherwise learners would see a course that silently changed under them.
        </div>
      ) : null}

      <RouteBlockedNotice route={route} />

      <CourseDetailsForm
        routeActive={route.settlementVerified}
        lockPrice={course.status === "published"}
        submitLabel="Save changes"
        initial={{
          id: course.id,
          title: course.title,
          subtitle: course.subtitle,
          description: course.description,
          categorySlug: course.categorySlug ?? "",
          level: (["beginner", "intermediate", "advanced"].includes(course.level)
            ? course.level
            : "beginner") as "beginner" | "intermediate" | "advanced",
          language: course.language,
          priceRupees: paiseToRupees(course.pricePaise),
          compareAtRupees: course.compareAtPaise > 0 ? paiseToRupees(course.compareAtPaise) : "",
          whatYouLearn: course.whatYouLearn.length > 0 ? course.whatYouLearn : [""],
          requirements: course.requirements.length > 0 ? course.requirements : [""],
          audience: course.audience.length > 0 ? course.audience : [""],
        }}
      />
    </div>
  );
}
