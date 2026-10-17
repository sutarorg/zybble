import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Send,
  Sparkles,
  Wallet,
} from "lucide-react";
import {
  getCreatorCourse,
  getCreatorCurriculum,
  getCreatorResources,
  getRouteOnboardingState,
} from "@/lib/server/creator";
import { getSession } from "@/lib/server/session";
import {
  computeCourseReadiness,
  type CourseReadinessCheck,
  type CourseReadinessLesson,
  type CourseWizardStepId,
} from "@/lib/course-wizard";
import { StatusBadge } from "@/components/creator/status-badge";
import { ReviewTimeline } from "@/components/creator/review-timeline";
import { Badge } from "@/components/ui/badge";
import {
  PublicCoursePreview,
  type PreviewLesson,
  type PreviewResource,
  type PreviewSection,
} from "./public-course-preview";
import { SubmitForReviewButton } from "./submit-for-review-button";

export const metadata = { title: "Review & submit" };
export const dynamic = "force-dynamic";

const STEP_HREFS: Record<CourseWizardStepId, string> = {
  details: "edit",
  curriculum: "curriculum",
  resources: "content",
  review: "publish",
};

const STEP_LABELS: Record<CourseWizardStepId, string> = {
  details: "Fix in Details",
  curriculum: "Fix in Curriculum",
  resources: "Fix in Pricing",
  review: "Review",
};

export default async function PublishCoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [course, curriculum, rawResources, session, route] = await Promise.all([
    getCreatorCourse(id),
    getCreatorCurriculum(id),
    getCreatorResources(id),
    getSession(),
    getRouteOnboardingState(),
  ]);
  if (!course) notFound();

  const sections: PreviewSection[] = (
    curriculum.sections as Array<Record<string, unknown>>
  ).map((section) => ({
    id: String(section.id),
    title: String(section.title ?? ""),
    lessons: ((section.lessons ?? []) as Array<Record<string, unknown>>).map(
      (l): PreviewLesson => ({
        id: String(l.id),
        title: String(l.title ?? ""),
        description: String(l.description ?? ""),
        kind: ((l.kind as string) ?? "video") as PreviewLesson["kind"],
        durationMinutes: Number(l.duration_minutes ?? 0),
        isPreview: Boolean(l.is_preview),
        hasVideo: Boolean(l.bunny_video_id),
        playbackReady: Boolean(l.bunny_playback_ready),
      })
    ),
  }));

  const resources: PreviewResource[] = (
    rawResources as Array<Record<string, unknown>>
  ).map((r) => ({
    id: String(r.id),
    lessonId: r.lesson_id ? String(r.lesson_id) : null,
    title: String(r.title ?? r.file_name ?? "Resource"),
    fileName: String(r.file_name ?? "file"),
    contentType: String(r.content_type ?? "application/octet-stream"),
    sizeBytes: Number(r.size_bytes ?? 0),
  }));

  const readinessLessons: CourseReadinessLesson[] = sections.flatMap((s) =>
    s.lessons.map((l) => ({
      id: l.id,
      title: l.title,
      kind: l.kind,
      hasVideo: l.hasVideo,
      playbackReady: l.playbackReady,
      description: l.description,
    }))
  );

  const readiness = computeCourseReadiness({
    courseId: course.id,
    title: course.title,
    description: course.description,
    categorySlug: course.categorySlug,
    thumbnailKey: course.thumbnailKey,
    pricePaise: course.pricePaise,
    lessons: readinessLessons,
  });

  const passedChecksCount = readiness.checks.filter((c) => c.done).length;
  const totalChecksCount = readiness.checks.length;

  const displayName =
    session?.creator?.displayName ?? session?.fullName ?? "Zybble Creator";
  const headline = session?.creator?.headline ?? "Course Instructor";
  const username = session?.creator?.username ?? "creator";
  const initials = session?.initials ?? "ZC";

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] leading-tight font-bold tracking-tight">
            Review &amp; submit
          </h1>
          <p className="mt-1.5 text-[14px] text-muted-foreground">
            {course.title}
            {course.categoryName ? <> · {course.categoryName}</> : null} · preview your public course page and verify all submission requirements.
          </p>
        </div>
        <StatusBadge status={course.status} />
      </header>

      {/* Moderation feedback banner when rejected or changes requested */}
      {course.status === "changes_requested" || course.status === "rejected" ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-[13px] text-amber-900"
        >
          <AlertCircle
            className="mt-0.5 size-5 shrink-0 text-amber-600"
            aria-hidden="true"
          />
          <div>
            <p className="font-semibold">
              {course.status === "changes_requested"
                ? "The reviewers asked for changes."
                : "This submission was rejected."}
            </p>
            {course.rejectionReason ? (
              <p className="mt-1 text-amber-800">{course.rejectionReason}</p>
            ) : null}
            <p className="mt-1 text-amber-800">
              Update the course and submit it again when you are ready.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_360px] xl:items-start">
        {/* Main Column: Full Public Course Preview + Review History */}
        <div className="space-y-6">
          <PublicCoursePreview
            course={{
              id: course.id,
              slug: course.slug,
              title: course.title,
              subtitle: course.subtitle,
              description: course.description,
              longDescription: course.description
                ? course.description.split(/\n{2,}/)
                : [],
              categorySlug: course.categorySlug,
              categoryName: course.categoryName,
              level: course.level,
              language: course.language,
              pricePaise: course.pricePaise,
              compareAtPaise: course.compareAtPaise,
              thumbnailKey: course.thumbnailKey,
              whatYouLearn: course.whatYouLearn,
              requirements: course.requirements,
              audience: course.audience,
              status: course.status,
            }}
            instructor={{
              id: session?.id ?? "creator",
              username,
              name: displayName,
              headline,
              bio: "",
              initials,
              avatarColor: "bg-violet-100 text-violet-700",
            }}
            sections={sections}
            resources={resources}
          />

          {/* Review history */}
          <section className="rounded-2xl border border-border bg-white p-5 shadow-card">
            <h2 className="flex items-center gap-2 font-display text-[15px] font-semibold tracking-tight">
              <Send className="size-4 text-primary" aria-hidden /> Review history
            </h2>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              Every moderation decision is recorded against your course.
            </p>
            <ReviewTimeline
              events={course.reviewHistory.map((event) => ({
                id: event.id,
                at: event.at,
                status: event.toStatus,
                actor: event.actorRole,
                note: event.note,
              }))}
            />
          </section>
        </div>

        {/* Right Sticky Column: Readiness Checklist & Submission Controls */}
        <aside className="space-y-5 xl:sticky xl:top-20">
          <div className="rounded-2xl border border-border bg-white p-5 shadow-card">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ClipboardCheck
                  className="size-4 text-primary"
                  aria-hidden="true"
                />
                <h2 className="font-display text-[15px] font-semibold text-foreground">
                  Readiness checklist
                </h2>
              </div>
              <Badge variant={readiness.ready ? "emerald" : "amber"}>
                {passedChecksCount}/{totalChecksCount} complete
              </Badge>
            </div>

            <p className="mt-1 text-[12px] text-muted-foreground">
              {readiness.ready
                ? "All checks pass! Your course is ready to submit for review."
                : "The submit button unlocks when every required item below is done."}
            </p>

            {/* Checklist Items */}
            <ul className="mt-4 space-y-2.5">
              {readiness.checks.map((check: CourseReadinessCheck) => (
                <li
                  key={check.id}
                  className={
                    check.done
                      ? "flex items-start gap-2.5 rounded-xl border border-border bg-zinc-50/70 px-3 py-2.5 text-[12.5px]"
                      : "flex items-start justify-between gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2.5 text-[12.5px]"
                  }
                >
                  <div className="flex items-start gap-2.5">
                    {check.done ? (
                      <CheckCircle2
                        className="mt-0.5 size-4 shrink-0 text-emerald-600"
                        aria-hidden="true"
                      />
                    ) : (
                      <AlertCircle
                        className="mt-0.5 size-4 shrink-0 text-amber-600"
                        aria-hidden="true"
                      />
                    )}
                    <div>
                      <p
                        className={
                          check.done
                            ? "font-medium text-foreground"
                            : "font-semibold text-amber-950"
                        }
                      >
                        {check.label}
                        <span className="sr-only">
                          {check.done ? " (done)" : " (missing)"}
                        </span>
                      </p>
                      <p
                        className={
                          check.done
                            ? "mt-0.5 text-[11px] text-muted-foreground"
                            : "mt-0.5 text-[11px] text-amber-800"
                        }
                      >
                        {check.detail}
                      </p>
                    </div>
                  </div>

                  {!check.done && check.fixStep ? (
                    <Link
                      href={`/creator/courses/${course.id}/${STEP_HREFS[check.fixStep]}`}
                      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-300 bg-white px-2 py-1 text-[11px] font-semibold text-amber-900 transition-colors hover:bg-amber-100"
                    >
                      {STEP_LABELS[check.fixStep]}
                      <ArrowRight className="size-3" aria-hidden="true" />
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>

            {/* Payouts note */}
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-border bg-zinc-50/70 px-3 py-2.5 text-[11.5px] text-muted-foreground">
              <Wallet
                className="mt-0.5 size-3.5 shrink-0 text-zinc-400"
                aria-hidden="true"
              />
              <span>
                {course.pricePaise === 0
                  ? "Free course — nothing to pay out."
                  : route.hasAccount
                    ? `Payout destination saved (${route.destination?.method.toUpperCase() ?? "saved"}).`
                    : "Optional now — save a UPI ID or bank account in Payouts before requesting a settlement."}
              </span>
            </div>

            {/* Submit / Keep as Draft Action Block */}
            <div className="mt-5 border-t border-border pt-4">
              <SubmitForReviewButton
                courseId={course.id}
                courseSlug={course.slug}
                status={course.status}
                ready={readiness.ready}
                blockersCount={readiness.missing.length}
              />
            </div>
          </div>

          {/* Quick Jump Links to Edit Steps */}
          <div className="rounded-2xl border border-border bg-white p-4 shadow-card">
            <h3 className="flex items-center gap-1.5 text-[12px] font-semibold text-foreground">
              <Sparkles
                className="size-3.5 text-primary"
                aria-hidden="true"
              />
              Need to make an edit?
            </h3>
            <div className="mt-2.5 grid grid-cols-3 gap-1.5 text-center text-[11.5px]">
              <Link
                href={`/creator/courses/${course.id}/edit`}
                className="rounded-lg border border-border bg-zinc-50 px-2 py-1.5 font-medium text-foreground hover:bg-muted/60"
              >
                1. Details
              </Link>
              <Link
                href={`/creator/courses/${course.id}/curriculum`}
                className="rounded-lg border border-border bg-zinc-50 px-2 py-1.5 font-medium text-foreground hover:bg-muted/60"
              >
                2. Curriculum
              </Link>
              <Link
                href={`/creator/courses/${course.id}/content`}
                className="rounded-lg border border-border bg-zinc-50 px-2 py-1.5 font-medium text-foreground hover:bg-muted/60"
              >
                3. Pricing
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
