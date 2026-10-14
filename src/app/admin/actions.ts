"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin, AuthorizationError } from "@/lib/server/session";
import { MIN_COMMISSION_BPS, MAX_COMMISSION_BPS, formatCommissionPercent } from "@/lib/money";
import { refundOrder } from "@/lib/server/checkout";
import { enqueueEmail } from "@/lib/server/email";

export interface AdminActionResult {
  ok: boolean;
  error?: string;
  message?: string;
}

function fail(error: unknown, fallback: string): AdminActionResult {
  if (error instanceof AuthorizationError) return { ok: false, error: error.message };
  console.error("[admin-action] failed", {
    reason: error instanceof Error ? error.message.slice(0, 200) : "unknown",
  });
  return { ok: false, error: fallback };
}

const UUID = z.string().uuid();

async function audit(actorId: string, action: string, targetType: string, targetId: string, detail: Record<string, unknown> = {}) {
  const service = createServiceClient();
  await service?.from("admin_audit_log").insert({
    actor_id: actorId,
    action,
    target_type: targetType,
    target_id: targetId,
    detail,
  });
}

/* -------------------------------------------------------------------------- */
/* Moderation                                                                  */
/* -------------------------------------------------------------------------- */

const decisionSchema = z.object({
  courseId: UUID,
  reason: z.string().trim().max(2000).optional(),
});

/**
 * Approves a course and publishes it.
 *
 * Server-side only: the transition is performed with the service client after
 * the caller's admin role has been verified, so a client cannot self-publish by
 * posting a status change.
 */
export async function approveCourse(input: unknown): Promise<AdminActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = decisionSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid request" };

    const service = createServiceClient();
    if (!service) return { ok: false, error: "Service is unavailable" };

    const { data: course } = await service
      .from("courses")
      .select("title, slug, status, price_paise, creator_id")
      .eq("id", parsed.data.courseId)
      .maybeSingle();
    if (!course) return { ok: false, error: "Course not found" };
    if (course.status === "published") return { ok: false, error: "This course is already published" };

    // A paid course must have an active Route account before it can be sold.
    if (Number(course.price_paise ?? 0) > 0) {
      const { data: creator } = await service
        .from("creator_profiles")
        .select("route_account_status")
        .eq("user_id", course.creator_id)
        .maybeSingle();
      if (creator?.route_account_status !== "active") {
        return {
          ok: false,
          error:
            "This course is paid, but Razorpay does not report the creator's Route account as active. It cannot be published until settlement is verified.",
        };
      }
    }

    await service
      .from("courses")
      .update({ status: "published", published_at: new Date().toISOString(), rejection_reason: null })
      .eq("id", parsed.data.courseId);
    await service.from("course_review_events").insert({
      course_id: parsed.data.courseId,
      actor_id: admin.id,
      actor_role: admin.role,
      from_status: course.status as never,
      to_status: "published",
      note: parsed.data.reason || "Approved",
    });

    const { data: creatorProfile } = await service
      .from("profiles")
      .select("email, full_name")
      .eq("id", course.creator_id)
      .maybeSingle();
    if (creatorProfile) {
      await enqueueEmail({
        to: creatorProfile.email,
        template: "course_approved",
        payload: {
          creatorName: creatorProfile.full_name ?? "Creator",
          courseTitle: String(course.title),
          courseSlug: String(course.slug),
        },
        idempotencyKey: `course_approved:${parsed.data.courseId}`,
      });
    }

    await audit(admin.id, "course.approve", "course", parsed.data.courseId, { reason: parsed.data.reason ?? "" });
    revalidatePath("/admin/courses");
    revalidatePath(`/admin/courses/${parsed.data.courseId}`);
    revalidatePath("/admin");
    return { ok: true, message: "Course approved and published." };
  } catch (error) {
    return fail(error, "Could not approve this course");
  }
}

export async function requestCourseChanges(input: unknown): Promise<AdminActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = decisionSchema.extend({ reason: z.string().trim().min(10, "Explain what needs to change").max(2000) }).safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "A reason is required" };

    const service = createServiceClient();
    if (!service) return { ok: false, error: "Service is unavailable" };

    const { data: course } = await service
      .from("courses")
      .select("title, status, creator_id")
      .eq("id", parsed.data.courseId)
      .maybeSingle();
    if (!course) return { ok: false, error: "Course not found" };

    await service
      .from("courses")
      .update({ status: "changes_requested", rejection_reason: parsed.data.reason })
      .eq("id", parsed.data.courseId);
    await service.from("course_review_events").insert({
      course_id: parsed.data.courseId,
      actor_id: admin.id,
      actor_role: admin.role,
      from_status: course.status as never,
      to_status: "changes_requested",
      note: parsed.data.reason,
    });

    const { data: creatorProfile } = await service
      .from("profiles")
      .select("email, full_name")
      .eq("id", course.creator_id)
      .maybeSingle();
    if (creatorProfile) {
      await enqueueEmail({
        to: creatorProfile.email,
        template: "course_changes_requested",
        payload: {
          creatorName: creatorProfile.full_name ?? "Creator",
          courseTitle: String(course.title),
          reason: parsed.data.reason,
        },
        idempotencyKey: `course_changes_requested:${parsed.data.courseId}:${Date.now()}`,
      });
    }

    await audit(admin.id, "course.request_changes", "course", parsed.data.courseId, { reason: parsed.data.reason });
    revalidatePath("/admin/courses");
    revalidatePath(`/admin/courses/${parsed.data.courseId}`);
    return { ok: true, message: "The creator has been asked to make changes." };
  } catch (error) {
    return fail(error, "Could not request changes");
  }
}

export async function rejectCourse(input: unknown): Promise<AdminActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = decisionSchema.extend({ reason: z.string().trim().min(10, "Explain why this was rejected").max(2000) }).safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "A reason is required" };

    const service = createServiceClient();
    if (!service) return { ok: false, error: "Service is unavailable" };

    const { data: course } = await service
      .from("courses")
      .select("title, status, creator_id")
      .eq("id", parsed.data.courseId)
      .maybeSingle();
    if (!course) return { ok: false, error: "Course not found" };

    await service
      .from("courses")
      .update({ status: "rejected", rejection_reason: parsed.data.reason })
      .eq("id", parsed.data.courseId);
    await service.from("course_review_events").insert({
      course_id: parsed.data.courseId,
      actor_id: admin.id,
      actor_role: admin.role,
      from_status: course.status as never,
      to_status: "rejected",
      note: parsed.data.reason,
    });

    const { data: creatorProfile } = await service
      .from("profiles")
      .select("email, full_name")
      .eq("id", course.creator_id)
      .maybeSingle();
    if (creatorProfile) {
      await enqueueEmail({
        to: creatorProfile.email,
        template: "course_rejected",
        payload: {
          creatorName: creatorProfile.full_name ?? "Creator",
          courseTitle: String(course.title),
          reason: parsed.data.reason,
        },
        idempotencyKey: `course_rejected:${parsed.data.courseId}:${Date.now()}`,
      });
    }

    await audit(admin.id, "course.reject", "course", parsed.data.courseId, { reason: parsed.data.reason });
    revalidatePath("/admin/courses");
    revalidatePath(`/admin/courses/${parsed.data.courseId}`);
    return { ok: true, message: "Course rejected." };
  } catch (error) {
    return fail(error, "Could not reject this course");
  }
}

export async function unpublishCourse(courseId: string): Promise<AdminActionResult> {
  try {
    const admin = await requireAdmin();
    if (!UUID.safeParse(courseId).success) return { ok: false, error: "Invalid course" };
    const service = createServiceClient();
    if (!service) return { ok: false, error: "Service is unavailable" };

    await service.from("courses").update({ status: "unpublished", published_at: null }).eq("id", courseId);
    await service.from("course_review_events").insert({
      course_id: courseId,
      actor_id: admin.id,
      actor_role: admin.role,
      to_status: "unpublished",
      note: "Unpublished by an administrator",
    });

    await audit(admin.id, "course.unpublish", "course", courseId);
    revalidatePath("/admin/courses");
    revalidatePath(`/admin/courses/${courseId}`);
    return { ok: true, message: "Course removed from the public catalog." };
  } catch (error) {
    return fail(error, "Could not unpublish this course");
  }
}

export async function addModerationNote(courseId: string, text: string): Promise<AdminActionResult> {
  try {
    const admin = await requireAdmin();
    const trimmed = text.trim().slice(0, 2000);
    if (!UUID.safeParse(courseId).success || !trimmed) return { ok: false, error: "Write a note first" };
    const service = createServiceClient();
    await service?.from("moderation_notes").insert({ course_id: courseId, author_id: admin.id, text: trimmed });
    await audit(admin.id, "course.note", "course", courseId);
    revalidatePath(`/admin/courses/${courseId}`);
    return { ok: true };
  } catch (error) {
    return fail(error, "Could not save the note");
  }
}

/* -------------------------------------------------------------------------- */
/* Users                                                                       */
/* -------------------------------------------------------------------------- */

export async function setUserStatus(userId: string, status: "active" | "suspended"): Promise<AdminActionResult> {
  try {
    const admin = await requireAdmin();
    if (!UUID.safeParse(userId).success) return { ok: false, error: "Invalid user" };
    if (userId === admin.id) return { ok: false, error: "You cannot change your own account status" };

    const service = createServiceClient();
    if (!service) return { ok: false, error: "Service is unavailable" };
    await service.from("profiles").update({ status }).eq("id", userId);

    if (status === "suspended") {
      // Suspension must also end active sessions on the provider side.
      const { data: user } = await service.auth.admin.getUserById(userId);
      if (user?.user) {
        await service.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
      }
    } else {
      await service.auth.admin.updateUserById(userId, { ban_duration: "none" });
    }

    await audit(admin.id, `user.${status}`, "profile", userId);
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (error) {
    return fail(error, "Could not update this account");
  }
}

/**
 * Grants or removes the admin role.
 *
 * The `profiles_guard_privileges` trigger rejects any role change that does not
 * come from the service role, and this action is only reachable by an existing
 * admin — so a learner can never self-promote, not even through the API.
 */
export async function setUserRole(userId: string, role: "learner" | "creator" | "moderator" | "admin"): Promise<AdminActionResult> {
  try {
    const admin = await requireAdmin();
    if (!UUID.safeParse(userId).success) return { ok: false, error: "Invalid user" };
    if (userId === admin.id) return { ok: false, error: "You cannot change your own role" };

    const service = createServiceClient();
    if (!service) return { ok: false, error: "Service is unavailable" };

    const { data: target } = await service.from("profiles").select("role, email").eq("id", userId).maybeSingle();
    if (!target) return { ok: false, error: "User not found" };

    await service.from("profiles").update({ role }).eq("id", userId);

    if (role === "admin" || role === "moderator") {
      await service.from("platform_admins").upsert({
        email: String(target.email).toLowerCase(),
        note: `Granted by ${admin.email}`,
        added_by: admin.id,
      });
      await service.from("creator_profiles").upsert(
        { user_id: userId, country_code: "IN" },
        { onConflict: "user_id" }
      );
    } else {
      await service.from("platform_admins").delete().eq("email", String(target.email).toLowerCase());
    }

    await audit(admin.id, "user.role_change", "profile", userId, { from: target.role, to: role });
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (error) {
    return fail(error, "Could not change this role");
  }
}

/* -------------------------------------------------------------------------- */
/* Settings                                                                    */
/* -------------------------------------------------------------------------- */

const settingsSchema = z.object({
  marketplaceName: z.string().trim().min(2).max(60),
  marketplaceDescription: z.string().trim().max(400),
  /** Commission in basis points; snapshotted onto each new order item. */
  commissionBps: z.number().int().min(MIN_COMMISSION_BPS).max(MAX_COMMISSION_BPS),
  autoApproveFreeCourses: z.boolean(),
  autoApproveReturningCreators: z.boolean(),
  emailReviewDecisions: z.boolean(),
  requirePayoutApproval: z.boolean(),
  supportEmail: z.string().trim().email("Enter a valid email address").max(200).or(z.literal("")),
});

export async function saveMarketplaceSettings(input: unknown): Promise<AdminActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = settingsSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the settings" };

    const service = createServiceClient();
    if (!service) return { ok: false, error: "Service is unavailable" };

    const { data: before } = await service.from("marketplace_settings").select("commission_bps").eq("id", true).maybeSingle();
    const previousBps = Number(before?.commission_bps ?? parsed.data.commissionBps);

    await service
      .from("marketplace_settings")
      .update({
        marketplace_name: parsed.data.marketplaceName,
        marketplace_description: parsed.data.marketplaceDescription || null,
        commission_bps: parsed.data.commissionBps,
        auto_approve_free_courses: parsed.data.autoApproveFreeCourses,
        auto_approve_returning_creators: parsed.data.autoApproveReturningCreators,
        email_review_decisions: parsed.data.emailReviewDecisions,
        require_payout_approval: parsed.data.requirePayoutApproval,
        support_email: parsed.data.supportEmail || null,
        updated_at: new Date().toISOString(),
        updated_by: admin.id,
      })
      .eq("id", true);

    await audit(admin.id, "settings.update", "marketplace_settings", "1", {
      previousCommissionBps: previousBps,
      commissionBps: parsed.data.commissionBps,
    });

    revalidatePath("/admin/settings");
    return {
      ok: true,
      message: `Saved. New orders will use ${formatCommissionPercent(parsed.data.commissionBps)}% commission; existing orders keep the rate they were placed with.`,
    };
  } catch (error) {
    return fail(error, "Could not save marketplace settings");
  }
}

/* -------------------------------------------------------------------------- */
/* Categories, reviews and reports                                             */
/* -------------------------------------------------------------------------- */

const categorySchema = z.object({
  id: UUID,
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(400),
  visible: z.boolean(),
  sortOrder: z.number().int().min(0).max(999),
});

export async function saveCategory(input: unknown): Promise<AdminActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = categorySchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the category" };

    const service = createServiceClient();
    if (!service) return { ok: false, error: "Service is unavailable" };
    await service
      .from("categories")
      .update({
        name: parsed.data.name,
        description: parsed.data.description,
        visible: parsed.data.visible,
        sort_order: parsed.data.sortOrder,
      })
      .eq("id", parsed.data.id);

    await audit(admin.id, "category.update", "category", parsed.data.id);
    revalidatePath("/admin/categories");
    return { ok: true };
  } catch (error) {
    return fail(error, "Could not save the category");
  }
}

export async function moderateReview(reviewId: string, publish: boolean): Promise<AdminActionResult> {
  try {
    const admin = await requireAdmin();
    if (!UUID.safeParse(reviewId).success) return { ok: false, error: "Invalid review" };
    const service = createServiceClient();
    if (!service) return { ok: false, error: "Service is unavailable" };

    await service.from("reviews").update({ published: publish }).eq("id", reviewId);
    await audit(admin.id, publish ? "review.publish" : "review.hide", "review", reviewId);
    revalidatePath("/admin/reviews");
    return { ok: true };
  } catch (error) {
    return fail(error, "Could not moderate this review");
  }
}

export async function resolveReport(reportId: string, status: "open" | "under_review" | "resolved" | "dismissed", note: string): Promise<AdminActionResult> {
  try {
    const admin = await requireAdmin();
    if (!UUID.safeParse(reportId).success) return { ok: false, error: "Invalid report" };
    const service = createServiceClient();
    if (!service) return { ok: false, error: "Service is unavailable" };

    await service
      .from("reports")
      .update({
        status,
        admin_note: note.trim().slice(0, 2000),
        resolved_by: status === "resolved" || status === "dismissed" ? admin.id : null,
        resolved_at: status === "resolved" || status === "dismissed" ? new Date().toISOString() : null,
      })
      .eq("id", reportId);

    await audit(admin.id, `report.${status}`, "report", reportId);
    revalidatePath("/admin/reports");
    return { ok: true };
  } catch (error) {
    return fail(error, "Could not update this report");
  }
}

/* -------------------------------------------------------------------------- */
/* Refunds                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Corrects a genuine payment error.
 *
 * Zybble publishes no customer-facing refund policy; this administrative
 * correction always records the real Razorpay refund id and reverses the Route
 * transfer proportionally. There is no way to mark an order refunded locally.
 */
export async function refundOrderAction(input: unknown): Promise<AdminActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = z
      .object({
        publicOrderId: z.string().min(6).max(40),
        amountPaise: z.number().int().positive().optional(),
        reason: z.string().trim().min(5, "Record why this refund is needed").max(500),
        revokeEntitlement: z.boolean().default(true),
      })
      .safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the refund" };

    const result = await refundOrder({
      publicOrderId: parsed.data.publicOrderId,
      amountPaise: parsed.data.amountPaise,
      reason: parsed.data.reason,
      adminId: admin.id,
      revokeEntitlement: parsed.data.revokeEntitlement,
    });

    revalidatePath("/admin/orders");
    revalidatePath("/admin/payouts");
    return {
      ok: true,
      message: `Refund ${result.refundId} was created with Razorpay. Settlement to the learner's bank account follows Razorpay's normal refund timeline.`,
    };
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      const typed = error as { message: string; status?: number };
      return { ok: false, error: typed.message };
    }
    return fail(error, "Could not process this refund");
  }
}
