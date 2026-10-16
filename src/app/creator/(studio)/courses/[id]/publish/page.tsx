import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, CircleAlert, ImageIcon, ListVideo, Send, Wallet } from "lucide-react";
import {
  getCreatorCourse,
  getCreatorCurriculum,
  getCreatorResources,
  getRouteOnboardingState,
} from "@/lib/server/creator";
import { money } from "@/lib/creator";
import { computeCourseReadiness, type CourseReadinessCheck, type CourseWizardStepId } from "@/lib/course-wizard";
import { SubmitForReviewButton } from "./submit-for-review-button";
import { StatusBadge } from "@/components/creator/status-badge";
import { ReviewTimeline } from "@/components/creator/review-timeline";

export const metadata = { title: "Review & submit" };
export const dynamic = "force-dynamic";

const STEP_HREFS: Record<CourseWizardStepId, string> = {
  details: "edit",
  curriculum: "curriculum",
  resources: "content",
  review: "publish",
};

export default async function PublishCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [course, curriculum, resources, route] = await Promise.all([
    getCreatorCourse(id),
    getCreatorCurriculum(id),
    getCreatorResources(id),
    getRouteOnboardingState(),
  ]);
  if (!course) notFound();

  const sections = curriculum.sections as Array<Record<string, unknown>>;
  const lessons = (curriculum.lessons as Array<Record<string, unknown>>).map((lesson) => ({
    kind: String(lesson.kind ?? "video"),
    playbackReady: Boolean(lesson.bunny_playback_ready),
    hasVideo: Boolean(lesson.bunny_video_id),
  }));

  // The checklist and the server's submission guard read the same rules.
  const readiness = computeCourseReadiness({
    courseId: course.id,
    title: course.title,
    description: course.description,
    categorySlug: course.categorySlug,
    thumbnailKey: course.thumbnailKey,
    pricePaise: course.pricePaise,
    lessons,
  });

  const videoLessons = lessons.filter((lesson) => lesson.kind === "video");
  const videosReady = videoLessons.filter((lesson) => lesson.playbackReady).length;
  const videosEncoding = videoLessons.filter((lesson) => lesson.hasVideo && !lesson.playbackReady).length;
  const videosMissing = videoLessons.filter((lesson) => !lesson.hasVideo).length;

  const submittable = ["draft", "changes_requested", "rejected"].includes(course.status);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] leading-tight font-bold tracking-tight">Review &amp; submit</h1>
          <p className="mt-1.5 text-[14px] text-muted-foreground">
            {course.title}
            {course.categoryName ? <> · {course.categoryName}</> : null}
          </p>
        </div>
        <StatusBadge status={course.status} />
      </header>

      {course.status === "changes_requested" || course.status === "rejected" ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3.5 text-[13px] text-amber-900">
          <p className="font-medium">
            {course.status === "changes_requested"
              ? "The reviewers asked for changes."
              : "This submission was rejected."}
          </p>
          {course.rejectionReason ? <p className="mt-1">{course.rejectionReason}</p> : null}
          <p className="mt-1">Update the course and submit it again when you are ready.</p>
        </div>
      ) : null}

      {/* ---------------------------------------------------------- summary */}
      <section className="rounded-2xl border border-border bg-white p-5 shadow-card">
        <h2 className="font-display text-[15px] font-semibold tracking-tight">Course summary</h2>
        <dl className="mt-4 grid gap-x-6 gap-y-3 text-[13px] sm:grid-cols-2">
          <SummaryItem label="Title">{course.title}</SummaryItem>
          <SummaryItem label="Category">{course.categoryName ?? "Not chosen"}</SummaryItem>
          <SummaryItem label="Thumbnail">
            <span className="inline-flex items-center gap-1.5">
              {course.thumbnailKey ? (
                <>
                  <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden /> Uploaded
                </>
              ) : (
                <>
                  <ImageIcon className="size-3.5 text-zinc-400" aria-hidden /> Not uploaded
                </>
              )}
            </span>
          </SummaryItem>
          <SummaryItem label="Curriculum">
            <span className="inline-flex items-center gap-1.5">
              <ListVideo className="size-3.5 text-zinc-400" aria-hidden />
              {sections.length} section{sections.length === 1 ? "" : "s"} · {lessons.length} lesson
              {lessons.length === 1 ? "" : "s"}
            </span>
          </SummaryItem>
          <SummaryItem label="Videos">
            {videoLessons.length === 0 ? (
              "No video lessons"
            ) : (
              <>
                {videosReady} of {videoLessons.length} ready
                {videosEncoding > 0 ? ` · ${videosEncoding} encoding` : ""}
                {videosMissing > 0 ? ` · ${videosMissing} without a video` : ""}
              </>
            )}
          </SummaryItem>
          <SummaryItem label="Resources">
            {resources.length} downloadable file{resources.length === 1 ? "" : "s"}
          </SummaryItem>
          <SummaryItem label="Pricing">
            <span className="font-medium text-foreground">
              {course.pricePaise === 0 ? "Free" : money(course.pricePaise)}
            </span>
            {course.compareAtPaise > 0 ? (
              <span className="ml-2 text-zinc-400 line-through">{money(course.compareAtPaise)}</span>
            ) : null}
          </SummaryItem>
          <SummaryItem label="Payouts">
            <span className="inline-flex items-center gap-1.5">
              <Wallet className="size-3.5 text-zinc-400" aria-hidden />
              {course.pricePaise === 0
                ? "Free course — nothing to pay out"
                : route.hasAccount
                  ? `Payout destination saved (${route.destination?.method.toUpperCase() ?? "saved"})`
                  : "Optional now — save a UPI ID or bank account before requesting a payout"}
            </span>
          </SummaryItem>
        </dl>
      </section>

      {/* --------------------------------------------------------- checklist */}
      <section className="rounded-2xl border border-border bg-white p-5 shadow-card">
        <h2 className="font-display text-[15px] font-semibold tracking-tight">Readiness checklist</h2>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          The submit button unlocks when every required item below is done. These are the same rules the
          server enforces.
        </p>
        <ul className="mt-4 space-y-3">
          {readiness.checks.map((check) => (
            <ChecklistItem key={check.id} check={check} courseId={course.id} />
          ))}
        </ul>

        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-4">
          {submittable ? (
            <SubmitForReviewButton courseId={course.id} disabled={!readiness.ready} />
          ) : (
            <p className="text-[13px] text-muted-foreground">
              {course.status === "pending"
                ? "This course is with a reviewer."
                : "This course is already published."}
            </p>
          )}
          {!readiness.ready && submittable ? (
            <p className="text-[12.5px] text-muted-foreground">
              Still needed: {readiness.missing.join(" · ")}
            </p>
          ) : null}
        </div>
      </section>

      {/* ----------------------------------------------------- review history */}
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

      <p className="text-[12px] text-zinc-400">
        Zybble publishes no course automatically. Submitting only requests a review — an administrator
        approves the course, asks for changes, or rejects it with a reason.
      </p>
    </div>
  );
}

function SummaryItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11.5px] font-medium tracking-wide text-zinc-400 uppercase">{label}</dt>
      <dd className="mt-0.5 text-foreground">{children}</dd>
    </div>
  );
}

function ChecklistItem({ check, courseId }: { check: CourseReadinessCheck; courseId: string }) {
  return (
    <li className="flex items-start gap-3">
      {check.done ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
      ) : (
        <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-medium">
          {check.label}
          <span className="sr-only">{check.done ? " (done)" : " (missing)"}</span>
        </p>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">{check.detail}</p>
      </div>
      {!check.done && check.fixStep ? (
        <Link
          href={`/creator/courses/${courseId}/${STEP_HREFS[check.fixStep]}`}
          className="mt-0.5 shrink-0 text-[12.5px] font-medium text-primary underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          Fix this
        </Link>
      ) : null}
    </li>
  );
}
