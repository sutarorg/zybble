import { notFound } from "next/navigation";
import { getCreatorCourse, getRouteOnboardingState } from "@/lib/server/creator";
import { getSession } from "@/lib/server/session";
import { paiseToRupees } from "@/lib/money";
import { CourseDetailsForm } from "../../new/course-details-form";
import { RouteBlockedNotice } from "../../../route-blocked-notice";
import { StatusBadge } from "@/components/creator/status-badge";

export const metadata = { title: "Edit course" };
export const dynamic = "force-dynamic";

export default async function EditCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [course, route, session] = await Promise.all([
    getCreatorCourse(id),
    getRouteOnboardingState(),
    getSession(),
  ]);
  if (!course) notFound();

  const locked = course.status === "published";
  // A course that has never been submitted keeps the wizard's "Save draft" action.
  const isFirstDraft = course.status === "draft" && !course.submittedAt;

  const instructor = session
    ? {
        name: session.creator?.displayName || session.fullName || "Creator",
        initials: session.initials || "CR",
        headline: session.creator?.headline ?? null,
        avatarKey: session.avatarKey ?? null,
      }
    : undefined;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] leading-tight font-bold tracking-tight">
            Details &amp; thumbnail
          </h1>
          <p className="mt-1.5 text-[14px] text-muted-foreground">{course.title}</p>
        </div>
        <StatusBadge status={course.status} />
      </header>

      {locked ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50/60 px-4 py-3.5 text-[13px] text-sky-900">
          This course is published, so its details are locked for buyers. Ask an administrator to unpublish it
          before you make changes — otherwise learners would see a course that silently changed under them.
        </div>
      ) : null}

      {course.status === "changes_requested" || course.status === "rejected" ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3.5 text-[13px] text-amber-900">
          <p className="font-medium">
            {course.status === "changes_requested"
              ? "The reviewers asked for changes."
              : "This submission was rejected."}
          </p>
          {course.rejectionReason ? <p className="mt-1">{course.rejectionReason}</p> : null}
          <p className="mt-1">
            Update the course, then resubmit it from the Review &amp; submit step.
          </p>
        </div>
      ) : null}

      <RouteBlockedNotice route={route} />

      <CourseDetailsForm
        locked={locked}
        instructor={instructor}
        submitLabel={isFirstDraft ? "Save draft" : "Save changes"}
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
          thumbnailKey: course.thumbnailKey,
          whatYouLearn: course.whatYouLearn.length > 0 ? course.whatYouLearn : [""],
          requirements: course.requirements.length > 0 ? course.requirements : [""],
          audience: course.audience.length > 0 ? course.audience : [""],
        }}
      />
    </div>
  );
}
