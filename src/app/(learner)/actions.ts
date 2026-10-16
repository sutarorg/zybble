"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { requireSession, AuthorizationError } from "@/lib/server/session";
import { issueCertificateIfComplete } from "@/lib/server/learner";
import { confirmAvatarUpload } from "@/lib/server/account";
import { alertCreator } from "@/lib/server/creator-alerts";
import { sendVerificationEmail } from "@/lib/server/verification";
import { rateLimit } from "@/lib/rate-limit";
import { signOutAction } from "@/app/(auth)/actions";

export interface ActionResult {
  ok: boolean;
  error?: string;
  /** Confirmation the UI shows as a toast — the learner is told what changed. */
  message?: string;
  certificateCode?: string;
}

export { signOutAction };

function fail(error: unknown, fallback: string): ActionResult {
  if (error instanceof AuthorizationError) return { ok: false, error: error.message };
  console.error("[learner-action] failed", {
    reason: error instanceof Error ? error.message.slice(0, 200) : "unknown",
  });
  return { ok: false, error: fallback };
}

/* -------------------------------------------------------------------------- */
/* Lesson progress                                                             */
/* -------------------------------------------------------------------------- */

const progressSchema = z.object({
  courseId: z.string().uuid(),
  lessonId: z.string().uuid(),
  completed: z.boolean(),
});

/**
 * Marks a lesson complete or incomplete.
 *
 * The lesson must belong to the course, and the caller must hold an active
 * entitlement (or the lesson must be a public preview). Both are checked against
 * the database rather than trusted from the request.
 */
export async function setLessonProgress(input: unknown): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const parsed = progressSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid request" };
    const { courseId, lessonId, completed } = parsed.data;

    const service = createServiceClient();
    if (!service) return { ok: false, error: "Service is unavailable" };

    const [{ data: lesson }, { data: entitlement }, { data: course }] = await Promise.all([
      service.from("lessons").select("id, course_id, is_preview").eq("id", lessonId).maybeSingle(),
      service
        .from("entitlements")
        .select("id")
        .eq("user_id", session.id)
        .eq("course_id", courseId)
        .is("revoked_at", null)
        .maybeSingle(),
      service.from("courses").select("status").eq("id", courseId).maybeSingle(),
    ]);

    if (!lesson || lesson.course_id !== courseId) return { ok: false, error: "Lesson not found" };

    const allowed = Boolean(entitlement) || (Boolean(lesson.is_preview) && course?.status === "published");
    if (!allowed) return { ok: false, error: "You have not enrolled in this course" };

    await service
      .from("lesson_progress")
      .upsert(
        {
          user_id: session.id,
          lesson_id: lessonId,
          course_id: courseId,
          completed,
          completed_at: completed ? new Date().toISOString() : null,
        },
        { onConflict: "user_id,lesson_id" }
      );

    await service
      .from("course_resume")
      .upsert(
        { user_id: session.id, course_id: courseId, lesson_id: lessonId, last_visited_at: new Date().toISOString() },
        { onConflict: "user_id,course_id" }
      );

    let certificateCode: string | undefined;
    if (completed && entitlement) {
      certificateCode = (await issueCertificateIfComplete(courseId)) ?? undefined;
    }

    revalidatePath("/my-learning");
    revalidatePath(`/learn/${courseId}`);
    return { ok: true, certificateCode };
  } catch (error) {
    return fail(error, "Could not save your progress");
  }
}

const noteSchema = z.object({
  courseId: z.string().uuid(),
  lessonId: z.string().uuid(),
  body: z.string().max(10_000),
});

export async function saveLessonNote(input: unknown): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const parsed = noteSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid request" };
    const { courseId, lessonId, body } = parsed.data;

    const supabase = await createServerClient();
    // RLS already scopes notes to the caller's own rows and their courses.
    if (body.trim().length === 0) {
      await supabase.from("lesson_notes").delete().eq("user_id", session.id).eq("lesson_id", lessonId);
    } else {
      const { error } = await supabase
        .from("lesson_notes")
        .upsert({ user_id: session.id, lesson_id: lessonId, course_id: courseId, body }, { onConflict: "user_id,lesson_id" });
      if (error) return { ok: false, error: "Could not save this note" };
    }

    revalidatePath(`/learn/${courseId}`);
    return { ok: true };
  } catch (error) {
    return fail(error, "Could not save this note");
  }
}

/* -------------------------------------------------------------------------- */
/* Wishlist                                                                    */
/* -------------------------------------------------------------------------- */

export async function toggleWishlist(courseId: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!z.string().uuid().safeParse(courseId).success) return { ok: false, error: "Invalid course" };

    const supabase = await createServerClient();
    const { data: existing } = await supabase
      .from("wishlist")
      .select("course_id")
      .eq("user_id", session.id)
      .eq("course_id", courseId)
      .maybeSingle();

    if (existing) {
      await supabase.from("wishlist").delete().eq("user_id", session.id).eq("course_id", courseId);
    } else {
      // Only published courses can be wishlisted.
      const { data: course } = await supabase.from("courses").select("status").eq("id", courseId).maybeSingle();
      if (course?.status !== "published") return { ok: false, error: "Course not found" };
      await supabase.from("wishlist").insert({ user_id: session.id, course_id: courseId });
    }

    revalidatePath("/wishlist");
    return { ok: true };
  } catch (error) {
    return fail(error, "Could not update your wishlist");
  }
}

/* -------------------------------------------------------------------------- */
/* Profile, preferences and notifications                                       */
/* -------------------------------------------------------------------------- */

const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your name").max(120),
  headline: z.string().trim().max(140).optional(),
  countryCode: z.string().trim().length(2, "Select your country").optional(),
});

export async function updateProfile(input: unknown): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const parsed = profileSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your details" };

    const supabase = await createServerClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: parsed.data.fullName,
        headline: parsed.data.headline ?? null,
        country_code: parsed.data.countryCode || null,
      })
      .eq("id", session.id);
    if (error) return { ok: false, error: "Could not save your profile" };

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    return fail(error, "Could not save your profile");
  }
}

const preferencesSchema = z.object({
  goalMinutesPerDay: z.number().int().min(5).max(480),
  emailCourseUpdates: z.boolean(),
  emailPromos: z.boolean(),
  weeklyReport: z.boolean(),
  studyReminders: z.boolean(),
});

export async function updateLearnerPreferences(input: unknown): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const parsed = preferencesSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid preferences" };

    const supabase = await createServerClient();
    // The form speaks camelCase, the table speaks snake_case. Spreading the
    // parsed object here used to name columns that do not exist, so Postgres
    // rejected the write and every toggle looked like it saved and then reverted.
    const { error } = await supabase.from("learner_preferences").upsert(
      {
        user_id: session.id,
        goal_minutes_per_day: parsed.data.goalMinutesPerDay,
        email_course_updates: parsed.data.emailCourseUpdates,
        email_promos: parsed.data.emailPromos,
        weekly_report: parsed.data.weeklyReport,
        study_reminders: parsed.data.studyReminders,
      },
      { onConflict: "user_id" }
    );
    if (error) return { ok: false, error: "Could not save your preferences" };

    // The sidebar's goal and the settings form both read this row.
    revalidatePath("/settings");
    revalidatePath("/dashboard");
    revalidatePath("/", "layout");
    return { ok: true, message: "Preferences saved" };
  } catch (error) {
    return fail(error, "Could not save your preferences");
  }
}

/**
 * Attaches an uploaded image as the learner's avatar.
 *
 * The bytes went to R2 through a pre-signed PUT the browser obtained from
 * `/api/storage`; this action is what makes the image official. It re-checks that
 * the key is inside the caller's own avatar namespace and that the object really
 * exists, so a key copied from somebody else's upload cannot be attached here.
 */
export async function updateAvatar(key: unknown): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const result = await confirmAvatarUpload(session.id, key);
    if (!result.ok) return { ok: false, error: result.error };

    revalidatePath("/", "layout");
    revalidatePath("/settings");
    return { ok: true, message: "Profile photo updated" };
  } catch (error) {
    return fail(error, "Could not update your profile photo");
  }
}

/**
 * Sends a fresh email-verification link to the signed-in learner.
 *
 * Supabase's own confirmation email depends on the project's SMTP being
 * configured, so Zybble generates the link server-side and delivers it through
 * Resend — see `src/lib/server/verification.ts`. Resending is rate limited: the
 * token is real, and a button that mints one on every click is a mail bomb.
 */
export async function resendVerificationEmail(): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (session.emailVerified) {
      return { ok: true, message: "Your email address is already verified" };
    }

    const limit = rateLimit(`verify:user:${session.id}`, 3, 10 * 60_000);
    if (!limit.allowed) {
      return {
        ok: false,
        error: `Too many attempts — try again in ${Math.max(1, limit.retryAfterSeconds)} seconds`,
      };
    }

    const outcome = await sendVerificationEmail({
      email: session.email,
      name: session.fullName,
      userId: session.id,
    });

    switch (outcome.status) {
      case "sent":
        return { ok: true, message: `Verification email sent to ${session.email}` };
      case "queued":
        return {
          ok: true,
          message: "We could not send it just now — the email is queued and will arrive shortly",
        };
      case "already_verified":
        revalidatePath("/", "layout");
        return { ok: true, message: "Your email address is already verified" };
      default:
        return { ok: false, error: "We could not send the verification email. Please try again later." };
    }
  } catch (error) {
    return fail(error, "We could not send the verification email");
  }
}

export async function markNotificationsRead(ids: string[]): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!Array.isArray(ids) || ids.length === 0) return { ok: true };
    const supabase = await createServerClient();
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", session.id)
      .in("id", ids.slice(0, 100));
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    return fail(error, "Could not update notifications");
  }
}

/* -------------------------------------------------------------------------- */
/* Messaging                                                                   */
/* -------------------------------------------------------------------------- */

export async function sendMessage(conversationId: string, body: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const trimmed = body.trim().slice(0, 4000);
    if (!trimmed) return { ok: false, error: "Write a message first" };

    const supabase = await createServerClient();
    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: session.id,
      body: trimmed,
    });
    if (error) return { ok: false, error: "Could not send your message" };

    revalidatePath("/messages");
    return { ok: true };
  } catch (error) {
    return fail(error, "Could not send your message");
  }
}

export async function startConversation(subject: string, body: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const trimmedBody = body.trim().slice(0, 4000);
    if (!trimmedBody) return { ok: false, error: "Write a message first" };

    const service = createServiceClient();
    if (!service) return { ok: false, error: "Service is unavailable" };

    const { data: conversation, error } = await service
      .from("conversations")
      .insert({ subject: subject.trim().slice(0, 160) || "Support request", learner_id: session.id })
      .select("id")
      .single();
    if (error || !conversation) return { ok: false, error: "Could not start the conversation" };

    await service.from("messages").insert({
      conversation_id: conversation.id,
      sender_id: session.id,
      body: trimmedBody,
    });

    revalidatePath("/messages");
    return { ok: true };
  } catch (error) {
    return fail(error, "Could not start the conversation");
  }
}

/* -------------------------------------------------------------------------- */
/* Reviews                                                                     */
/* -------------------------------------------------------------------------- */

const reviewSchema = z.object({
  courseId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().max(4000).optional(),
});

export async function submitReview(input: unknown): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const parsed = reviewSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid review" };

    const supabase = await createServerClient();

    // An edited review is not a new one, and only a new review is worth
    // interrupting a creator for.
    const { data: previous } = await supabase
      .from("reviews")
      .select("id")
      .eq("course_id", parsed.data.courseId)
      .eq("user_id", session.id)
      .maybeSingle();

    // The `reviews_insert_entitled` RLS policy is the authority: a learner can
    // only review a course they hold an entitlement to.
    const { error } = await supabase.from("reviews").upsert(
      {
        course_id: parsed.data.courseId,
        user_id: session.id,
        rating: parsed.data.rating,
        title: parsed.data.title ?? null,
        body: parsed.data.body ?? null,
        published: true,
      },
      { onConflict: "course_id,user_id" }
    );
    if (error) {
      if (/row-level|policy/i.test(error.message)) {
        return { ok: false, error: "You can only review a course you have taken" };
      }
      return { ok: false, error: "Could not save your review" };
    }

    revalidatePath(`/courses`);

    if (!previous) {
      const { data: course } = await supabase
        .from("courses")
        .select("id, title, creator_id")
        .eq("id", parsed.data.courseId)
        .maybeSingle();
      const creatorId = (course?.creator_id as string | null) ?? null;
      if (creatorId) {
        const courseTitle = String(course?.title ?? "your course");
        // Best-effort and gated by the creator's studio settings; a review that
        // saved must never fail because its announcement did not.
        await alertCreator({
          creatorId,
          kind: "new_review",
          notification: {
            title: `New review on ${courseTitle}`,
            body: `${parsed.data.rating} out of 5 from a learner.`,
            href: "/creator/reviews",
          },
          payload: {
            courseTitle,
            rating: parsed.data.rating,
            reviewTitle: parsed.data.title ?? "",
            reviewBody: parsed.data.body ?? "",
          },
          idempotencyKey: `creator-review:${parsed.data.courseId}:${session.id}`,
        });
      }
    }

    return { ok: true, message: "Review published" };
  } catch (error) {
    return fail(error, "Could not save your review");
  }
}

/* -------------------------------------------------------------------------- */
/* Account deletion                                                            */
/* -------------------------------------------------------------------------- */

export async function requestAccountDeletion(): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const service = createServiceClient();
    if (!service) return { ok: false, error: "Service is unavailable" };

    // A purchased learner's financial records must be retained for accounting,
    // so the account is deactivated rather than hard-deleted.
    await service.from("profiles").update({ status: "deleted" }).eq("id", session.id);
    await service.from("entitlements").update({ revoked_at: new Date().toISOString() }).eq("user_id", session.id).is("revoked_at", null);
    await service.from("admin_audit_log").insert({
      actor_id: session.id,
      actor_email: session.email,
      action: "account.deletion_requested",
      target_type: "profile",
      target_id: session.id,
    });

    const supabase = await createServerClient();
    await supabase.auth.signOut();
    revalidatePath("/", "layout");
    redirect("/");
  } catch (error) {
    return fail(error, "Could not process your request");
  }
}

/** Certificate PNG generation is verified server-side; see `issueCertificateIfComplete`. */
export async function requestCertificate(courseId: string): Promise<ActionResult> {
  try {
    await requireSession();
    const code = await issueCertificateIfComplete(courseId);
    if (!code) return { ok: false, error: "Complete every lesson to unlock your certificate" };
    revalidatePath("/certificates");
    return { ok: true, certificateCode: code };
  } catch (error) {
    return fail(error, "Could not issue a certificate yet");
  }
}
