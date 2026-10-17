import { getSession } from "@/lib/server/session";
import { buildCourseWizardSteps } from "@/lib/course-wizard";
import { CourseWizardFrame } from "@/components/creator/course-wizard-frame";
import { CourseDetailsForm } from "./course-details-form";

export const metadata = { title: "New course" };
export const dynamic = "force-dynamic";

export default async function NewCoursePage() {
  // The studio layout already resolves the session (React `cache` dedupes
  // it per request), so this page adds no extra database round-trips.
  const session = await getSession();

  // Before the first save there is no course record, so steps 2-4 stay locked.
  const steps = buildCourseWizardSteps({
    courseId: null,
    title: "",
    description: "",
    categorySlug: null,
    thumbnailKey: null,
    lessonsCount: 0,
    status: "draft",
  });

  const instructor = session
    ? {
        name: session.creator?.displayName || session.fullName || "Creator",
        initials: session.initials || "CR",
        headline: session.creator?.headline ?? null,
        avatarKey: session.avatarKey ?? null,
      }
    : undefined;

  return (
    <CourseWizardFrame steps={steps} activeStepId="details">
      <header>
        <h1 className="font-display text-[26px] leading-tight font-bold tracking-tight">
          Create a course
        </h1>
        <p className="mt-1.5 text-[14px] text-muted-foreground">
          Add the basics and a cover image, then continue to the curriculum builder.
        </p>
      </header>

      <CourseDetailsForm
        instructor={instructor}
        submitLabel="Continue to Curriculum"
      />
    </CourseWizardFrame>
  );
}
