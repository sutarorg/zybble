import { getRouteOnboardingState } from "@/lib/server/creator";
import { CourseDetailsForm } from "./course-details-form";
import { RouteBlockedNotice } from "../../route-blocked-notice";

export const metadata = { title: "New course" };
export const dynamic = "force-dynamic";

export default async function NewCoursePage() {
  const route = await getRouteOnboardingState();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="font-display text-[26px] leading-tight font-bold tracking-tight">Create a course</h1>
        <p className="mt-1.5 text-[14px] text-muted-foreground">
          Start with the details. You can add curriculum, video and downloadable resources next. The course stays
          a private draft until you submit it for review.
        </p>
      </header>

      <RouteBlockedNotice route={route} />

      <CourseDetailsForm routeActive={route.settlementVerified} />
    </div>
  );
}