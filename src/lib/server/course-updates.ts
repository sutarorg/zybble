/**
 * Telling enrolled learners that a course they own a seat in has grown.
 *
 * A creator publishing a new lesson is the one catalog change a learner has
 * already paid to care about, so it earns both an in-app notification and an
 * email. The email is gated by the `email_course_updates` preference — see
 * `EMAIL_CONSENT` in `src/lib/server/email.ts` — while the notification is not:
 * it sits inside the learner's own account and costs them nothing.
 *
 * Nothing here is sent for a course that is not published. A draft's curriculum
 * is the creator's business, and announcing it would leak unreleased material to
 * anybody who once held an entitlement.
 */

import "server-only";
import { siteOrigin } from "@/lib/env";
import { enqueueEmailBatch } from "@/lib/server/email";
import type { ServiceClient } from "@/lib/supabase/server";

/** Learners notified per announcement. Beyond this the caller is told it was cut. */
const MAX_LEARNERS_PER_ANNOUNCEMENT = 5_000;
const INSERT_CHUNK = 500;

export interface AnnouncementResult {
  notified: number;
  emailed: number;
  /** Learners who turned course-update email off. */
  skippedConsent: number;
  /** True when the audience exceeded the per-announcement bound. */
  truncated: boolean;
}

const NOTHING: AnnouncementResult = { notified: 0, emailed: 0, skippedConsent: 0, truncated: false };

export async function announceNewLesson(
  service: ServiceClient,
  params: { courseId: string; lessonId: string; lessonTitle: string }
): Promise<AnnouncementResult> {
  const { data: course } = await service
    .from("courses")
    .select("id, title, status")
    .eq("id", params.courseId)
    .maybeSingle();

  if (!course || course.status !== "published") return NOTHING;

  const { data: entitlements } = await service
    .from("entitlements")
    .select("user_id, profiles ( email, full_name )")
    .eq("course_id", params.courseId)
    .is("revoked_at", null)
    .limit(MAX_LEARNERS_PER_ANNOUNCEMENT + 1);

  const rows = (entitlements ?? []) as unknown as Array<{
    user_id: string;
    profiles: { email: string; full_name: string | null } | null;
  }>;
  if (rows.length === 0) return NOTHING;

  const truncated = rows.length > MAX_LEARNERS_PER_ANNOUNCEMENT;
  const learners = rows.slice(0, MAX_LEARNERS_PER_ANNOUNCEMENT);

  const courseTitle = String(course.title ?? "your course");
  const lessonTitle = params.lessonTitle || "a new lesson";
  const courseUrl = `${siteOrigin()}/learn/${params.courseId}`;

  // In-app first: it cannot be blocked by an email provider being down, and it
  // is the record the learner sees when they next open the dashboard.
  let notified = 0;
  for (let i = 0; i < learners.length; i += INSERT_CHUNK) {
    const { error, count } = await service
      .from("notifications")
      .insert(
        learners.slice(i, i + INSERT_CHUNK).map((learner) => ({
          user_id: learner.user_id,
          kind: "course",
          title: `New lesson in ${courseTitle}`,
          body: lessonTitle,
          href: `/learn/${params.courseId}`,
        })),
        { count: "exact" }
      );
    if (error) {
      console.error("[course-update] could not notify learners", {
        course: params.courseId,
        reason: error.message.slice(0, 200),
      });
      break;
    }
    notified += count ?? 0;
  }

  // The idempotency key is the lesson, not the announcement: saving the same
  // lesson twice notifies a learner once.
  const email = await enqueueEmailBatch(
    learners
      .filter((learner) => learner.profiles?.email)
      .map((learner) => ({
        to: String(learner.profiles?.email ?? ""),
        userId: learner.user_id,
        template: "course_update" as const,
        payload: {
          learnerName: String(learner.profiles?.full_name ?? "there"),
          courseTitle,
          lessonTitle,
          courseUrl,
        },
        idempotencyKey: `course-update:${params.lessonId}:${learner.user_id}`,
      }))
  );

  if (email.error) {
    console.error("[course-update] could not queue the announcement email", {
      course: params.courseId,
      reason: email.error.slice(0, 200),
    });
  }

  return {
    notified,
    emailed: email.queued,
    skippedConsent: email.skippedConsent,
    truncated,
  };
}
