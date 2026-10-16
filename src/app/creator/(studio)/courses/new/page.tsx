import { getCreatorStudioPreferences, getRouteOnboardingState } from "@/lib/server/creator";
import { rupeesInputFromPaise } from "@/lib/creator";
import { buildCourseWizardSteps } from "@/lib/course-wizard";
import { CourseWizardFrame } from "@/components/creator/course-wizard-frame";
import { CourseDetailsForm } from "./course-details-form";
import { RouteBlockedNotice } from "../../route-blocked-notice";

export const metadata = { title: "New course" };
export const dynamic = "force-dynamic";

export default async function NewCoursePage() {
  const [route, preferences] = await Promise.all([getRouteOnboardingState(), getCreatorStudioPreferences()]);

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

  return (
    <CourseWizardFrame steps={steps}>
      <header>
        <h1 className="font-display text-[26px] leading-tight font-bold tracking-tight">Create a course</h1>
        <p className="mt-1.5 text-[14px] text-muted-foreground">Add the basics and a thumbnail — you can build the rest next.</p>
      </header>

      <RouteBlockedNotice route={route} />

      {/* The creator's studio defaults are the starting point; every field stays
          editable here, and nothing about an existing course is touched. */}
      <CourseDetailsForm
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
