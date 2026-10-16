import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, CircleAlert, Send } from "lucide-react";
import { getCreatorCourse, getCreatorCurriculum, getRouteOnboardingState } from "@/lib/server/creator";
import { money } from "@/lib/creator";
import { SubmitForReviewButton } from "./submit-for-review-button";
import { StatusBadge } from "@/components/creator/status-badge";
import { ReviewTimeline } from "@/components/creator/review-timeline";

export const metadata = { title: "Submit for review" };
export const dynamic = "force-dynamic";

export default async function PublishCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [course, curriculum, route] = await Promise.all([
    getCreatorCourse(id),
    getCreatorCurriculum(id),
    getRouteOnboardingState(),
  ]);
  if (!course) notFound();

  const lessons = curriculum.lessons as Array<Record<string, unknown>>;
  const checks = [
    {
      label: "Title and description",
      done: course.title.trim().length >= 3 && course.description.trim().length > 0,
      detail: "A title of at least 3 characters and a description are required.",
    },
    {
      label: "Category selected",
      done: Boolean(course.categorySlug),
      detail: "Learners find courses through categories.",
    },
    {
      label: "At least one lesson",
      done: lessons.length > 0,
      detail: "A course with no lessons cannot be reviewed.",
    },
    {
      label: "Every lesson has content",
      done:
        lessons.length > 0 &&
        lessons.every((lesson) =>
          lesson.kind === "reading"
            ? true
            : lesson.bunny_playback_ready || String(lesson.kind) === "quiz"
        ),
      detail: "Video lessons must be encoded by Bunny Stream before learners can watch them.",
    },
    {
      label: "Thumbnail uploaded",
      done: Boolean(course.thumbnailKey),
      detail: "Courses without a thumbnail look unfinished in the catalog.",
    },
    {
      label: course.pricePaise > 0 ? "Paid course pricing (INR)" : "Pricing (Free)",
      done: true,
      detail:
        course.pricePaise > 0
          ? route.hasAccount
            ? `Priced at ${money(course.pricePaise)}. Payout destination saved (${route.accountId}).`
            : `Priced at ${money(course.pricePaise)}. You can publish and earn now; save a UPI ID or bank account in Payouts whenever you are ready to request a payout.`
          : "This course is free.",
    },
  ];

  const ready = checks.every((check) => check.done);
  const submittable = ["draft", "changes_requested", "rejected"].includes(course.status);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/creator/courses" className="text-[12.5px] text-muted-foreground underline">
            ← My courses
          </Link>
          <h1 className="font-display mt-1 text-[26px] leading-tight font-bold tracking-tight">Submit for review</h1>
          <p className="mt-1.5 text-[14px] text-muted-foreground">{course.title}</p>
        </div>
        <StatusBadge status={course.status} />
      </header>

      <section className="rounded-xl border border-border bg-white p-5 shadow-card">
        <h2 className="font-display text-[15px] font-semibold tracking-tight">Readiness checklist</h2>
        <ul className="mt-4 space-y-3">
          {checks.map((check) => (
            <li key={check.label} className="flex items-start gap-3">
              {check.done ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
              ) : (
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
              )}
              <div>
                <p className="text-[13.5px] font-medium">{check.label}</p>
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">{check.detail}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <p className="text-[13px] text-muted-foreground">
            Price:{" "}
            <span className="font-medium text-foreground">{course.pricePaise === 0 ? "Free" : money(course.pricePaise)}</span>
          </p>
          {submittable ? (
            <SubmitForReviewButton courseId={course.id} disabled={!ready} />
          ) : (
            <p className="text-[13px] text-muted-foreground">
              {course.status === "pending"
                ? "This course is with a reviewer."
                : "This course is already published."}
            </p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-white p-5 shadow-card">
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
        Zybble publishes no course automatically. An administrator reads the submission and either approves it,
        asks for changes, or rejects it with a reason.
      </p>
    </div>
  );
}
