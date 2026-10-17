import { getCreatorStudioPreferences, getRouteOnboardingState } from "@/lib/server/creator";
import { getSession } from "@/lib/server/session";
import { rupeesInputFromPaise } from "@/lib/creator";
import { buildCourseWizardSteps } from "@/lib/course-wizard";
import { CourseWizardFrame } from "@/components/creator/course-wizard-frame";
import { CourseDetailsForm } from "./course-details-form";
import { RouteBlockedNotice } from "../../route-blocked-notice";

export const metadata = { title: "New course" };
export const dynamic = "force-dynamic";

export default async function NewCoursePage() {
  const [route, preferences, session] = await Promise.all([
    getRouteOnboardingState(),
    getCreatorStudioPreferences(),
    getSession(),
  ]);

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
          Add the course details and a 16:9 thumbnail — once saved, you&apos;ll unlock the curriculum builder for video lessons, interactive quizzes, and downloadable resources.
        </p>
      </header>

      <RouteBlockedNotice route={route} />

      <CourseDetailsForm
        instructor={instructor}
        initial={{
          title: "",
          subtitle: "",
          description: "",
          categorySlug: "",
          level: preferences.defaultCourseLevel,
          language: preferences.defaultCourseLanguage,
          priceRupees: rupeesInputFromPaise(preferences.defaultPricePaise),
          compareAtRupees: "",
          whatYouLearn: [""],
          requirements: [""],
          audience: [""],
        }}
      />
    </CourseWizardFrame>
  );
}
