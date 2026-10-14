"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceClient, createServerClient } from "@/lib/supabase/server";
import { requireCreator, AuthorizationError } from "@/lib/server/session";
import { inrPriceInputSchema, formatInr } from "@/lib/money";
import {
  createLinkedAccount,
  fetchLinkedAccount,
  isRouteAccountEligible,
  type CreateLinkedAccountInput,
} from "@/lib/server/razorpay";
import { dispatchEmail } from "@/lib/server/email";

export interface CreatorActionResult {
  ok: boolean;
  error?: string;
  message?: string;
  id?: string;
}

function fail(error: unknown, fallback: string): CreatorActionResult {
  if (error instanceof AuthorizationError) return { ok: false, error: error.message };
  console.error("[creator-action] failed", {
    reason: error instanceof Error ? error.message.slice(0, 200) : "unknown",
  });
  return { ok: false, error: fallback };
}

const UUID = z.string().uuid();

/* -------------------------------------------------------------------------- */
/* Onboarding                                                                  */
/* -------------------------------------------------------------------------- */

/** Turns a learner account into a creator account without losing learner state. */
export async function becomeCreator(): Promise<CreatorActionResult> {
  try {
    const session = await requireCreator().catch(async () => {
      const { requireSession } = await import("@/lib/server/session");
      return requireSession();
    });
    const service = createServiceClient();
    if (!service) return { ok: false, error: "Service is unavailable" };

    const { error } = await service.from("creator_profiles").upsert(
      {
        user_id: session.id,
        display_name: session.fullName,
        country_code: "IN",
        onboarding_status: "profile_incomplete",
      },
      { onConflict: "user_id" }
    );
    if (error) return { ok: false, error: "Could not start creator onboarding" };

    // The learner profile, entitlements and orders are untouched.
    revalidatePath("/", "layout");
    revalidatePath("/creator");
    return { ok: true, id: session.id };
  } catch (error) {
    return fail(error, "Could not start creator onboarding");
  }
}

const creatorProfileSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Pick a username with at least 3 characters")
    .max(30)
    .regex(/^[a-z0-9][a-z0-9-]*$/, "Use lowercase letters, numbers and hyphens only"),
  displayName: z.string().trim().min(2, "Enter your display name").max(80),
  headline: z.string().trim().max(140).optional(),
  bio: z.string().trim().max(2000).optional(),
  languages: z.array(z.string().max(40)).max(10).default(["English"]),
  topics: z.array(z.string().max(40)).max(10).default([]),
  website: z.string().trim().url("Enter a valid URL").max(200).optional().or(z.literal("")),
});

export async function saveCreatorProfile(input: unknown): Promise<CreatorActionResult> {
  try {
    const session = await requireCreator();
    const parsed = creatorProfileSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your details" };

    const service = createServiceClient();
    if (!service) return { ok: false, error: "Service is unavailable" };

    const { data: existing } = await service
      .from("creator_profiles")
      .select("user_id")
      .eq("username", parsed.data.username)
      .neq("user_id", session.id)
      .maybeSingle();
    if (existing) return { ok: false, error: "That username is already taken" };

    const { error } = await service
      .from("creator_profiles")
      .update({
        username: parsed.data.username,
        display_name: parsed.data.displayName,
        headline: parsed.data.headline ?? null,
        bio: parsed.data.bio ?? null,
        languages: parsed.data.languages,
        topics: parsed.data.topics,
        website: parsed.data.website || null,
        onboarding_status: "route_pending",
      })
      .eq("user_id", session.id);
    if (error) return { ok: false, error: "Could not save your creator profile" };

    revalidatePath("/creator/profile");
    return { ok: true };
  } catch (error) {
    return fail(error, "Could not save your creator profile");
  }
}

const routeAccountSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a 10-digit Indian mobile number"),
  legalBusinessName: z.string().trim().min(4, "Enter your legal business or full name").max(200),
  businessType: z.string().trim().min(3).max(60),
  contactName: z.string().trim().min(2, "Enter a contact name").max(120),
  category: z.string().trim().min(2).max(60),
  subcategory: z.string().trim().min(2).max(60),
  street1: z.string().trim().min(3, "Enter your address").max(100),
  street2: z.string().trim().max(100).optional(),
  city: z.string().trim().min(2, "Enter your city").max(100),
  state: z.string().trim().length(2, "Select your Indian state").toUpperCase(),
  postalCode: z.string().trim().regex(/^\d{6}$/, "Enter a 6-digit PIN code"),
  pan: z.string().trim().max(10).optional(),
});

/**
 * Creates the creator's Razorpay Route linked account.
 *
 * Zybble stores only the provider account id and the verified status. It never
 * stores bank account numbers or KYC documents: Razorpay collects and holds
 * those, and Zybble asks the provider for the resulting status.
 */
export async function createRouteAccount(input: unknown): Promise<CreatorActionResult> {
  try {
    const session = await requireCreator();
    const parsed = routeAccountSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your details" };

    const service = createServiceClient();
    if (!service) return { ok: false, error: "Service is unavailable" };

    const { data: profile } = await service
      .from("creator_profiles")
      .select("route_account_id")
      .eq("user_id", session.id)
      .maybeSingle();
    if (profile?.route_account_id) {
      return { ok: false, error: "A Route account already exists for this creator" };
    }

    const payload: CreateLinkedAccountInput = {
      email: parsed.data.email,
      phone: parsed.data.phone,
      legalBusinessName: parsed.data.legalBusinessName,
      businessType: parsed.data.businessType,
      contactName: parsed.data.contactName,
      customerFacingBusinessName: parsed.data.legalBusinessName,
      profile: {
        category: parsed.data.category,
        subcategory: parsed.data.subcategory,
        businessModel: "Independent AI course creator on the Zybble marketplace",
        addresses: {
          registered: {
            street1: parsed.data.street1,
            street2: parsed.data.street2 || undefined,
            city: parsed.data.city,
            state: parsed.data.state,
            postal_code: parsed.data.postalCode,
            country: "IN",
          },
        },
      },
      legalInfo: parsed.data.pan ? { pan: parsed.data.pan.toUpperCase() } : undefined,
    };

    const account = await createLinkedAccount(payload);

    await service
      .from("creator_profiles")
      .update({
        route_account_id: account.id,
        route_account_status: account.status,
        route_settlement_verified: isRouteAccountEligible(account.status),
        route_created_at: new Date().toISOString(),
        route_last_checked_at: new Date().toISOString(),
        route_error: null,
        onboarding_status: isRouteAccountEligible(account.status) ? "route_active" : "route_pending",
      })
      .eq("user_id", session.id);

    revalidatePath("/creator/onboarding");
    revalidatePath("/creator/payouts");
    return {
      ok: true,
      id: account.id,
      message: isRouteAccountEligible(account.status)
        ? "Your Route account is active. You can now publish paid courses."
        : "Your Route account was created. Razorpay now verifies your bank account (penny test) before transfers can be initiated. Paid courses stay hidden until it is active.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/not configured/i.test(message)) {
      return { ok: false, error: "Razorpay is not configured for this environment, so settlement onboarding is unavailable." };
    }
    return { ok: false, error: "Razorpay could not create your settlement account. Please try again shortly." };
  }
}

/** Re-reads the live Razorpay status. Never assumes approval. */
export async function refreshRouteStatus(): Promise<CreatorActionResult> {
  try {
    const session = await requireCreator();
    const service = createServiceClient();
    if (!service) return { ok: false, error: "Service is unavailable" };

    const { data: profile } = await service
      .from("creator_profiles")
      .select("route_account_id")
      .eq("user_id", session.id)
      .maybeSingle();
    if (!profile?.route_account_id) return { ok: false, error: "No settlement account yet" };

    const account = await fetchLinkedAccount(profile.route_account_id);
    const active = isRouteAccountEligible(account.status);

    await service
      .from("creator_profiles")
      .update({
        route_account_status: account.status,
        route_settlement_verified: active,
        route_last_checked_at: new Date().toISOString(),
        onboarding_status: active ? "route_active" : "route_pending",
      })
      .eq("user_id", session.id);

    revalidatePath("/creator/onboarding");
    revalidatePath("/creator/payouts");
    return {
      ok: true,
      message: `Razorpay reports this account as “${account.status}”.${
        active ? "" : " Paid courses remain hidden until Razorpay marks it active."
      }`,
    };
  } catch (error) {
    return fail(error, "Could not reach Razorpay to refresh your settlement status");
  }
}

/* -------------------------------------------------------------------------- */
/* Courses                                                                     */
/* -------------------------------------------------------------------------- */

const courseSchema = z.object({
  id: UUID.optional(),
  title: z.string().trim().min(3, "Add a course title").max(140),
  subtitle: z.string().trim().max(180).optional(),
  description: z.string().trim().max(6000).optional(),
  categorySlug: z.string().trim().min(2, "Choose a category").max(60),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  language: z.string().trim().min(2).max(40),
  /** Typed in rupees; converted to integer paise with exact decimal arithmetic. */
  priceRupees: z.union([z.string(), z.number()]).default("0"),
  compareAtRupees: z.union([z.string(), z.number()]).optional(),
  whatYouLearn: z.array(z.string().max(400)).max(20).default([]),
  requirements: z.array(z.string().max(400)).max(20).default([]),
  audience: z.array(z.string().max(400)).max(20).default([]),
});

export async function saveCourse(input: unknown): Promise<CreatorActionResult> {
  try {
    const session = await requireCreator();
    const parsed = courseSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your course details" };

    const pricePaise = inrPriceInputSchema.safeParse(parsed.data.priceRupees);
    if (!pricePaise.success) return { ok: false, error: "Enter a valid price in rupees" };
    const compare = parsed.data.compareAtRupees
      ? inrPriceInputSchema.safeParse(parsed.data.compareAtRupees)
      : { success: true as const, data: null as number | null };
    if (!compare.success) return { ok: false, error: "Enter a valid comparison price in rupees" };

    const service = createServiceClient();
    if (!service) return { ok: false, error: "Service is unavailable" };

    const { data: category } = await service
      .from("categories")
      .select("id")
      .eq("slug", parsed.data.categorySlug)
      .maybeSingle();
    if (!category) return { ok: false, error: "Choose a valid category" };

    const payload = {
      title: parsed.data.title,
      subtitle: parsed.data.subtitle || null,
      description: parsed.data.description || null,
      category_id: category.id as string,
      level: parsed.data.level,
      language: parsed.data.language,
      price_paise: pricePaise.data,
      compare_at_paise: compare.success ? compare.data : null,
      what_you_learn: parsed.data.whatYouLearn,
      requirements: parsed.data.requirements,
      audience: parsed.data.audience,
    };

    if (parsed.data.id) {
      const { data: existing } = await service
        .from("courses")
        .select("creator_id, status")
        .eq("id", parsed.data.id)
        .maybeSingle();
      if (!existing) return { ok: false, error: "Course not found" };
      if (existing.creator_id !== session.id) return { ok: false, error: "You do not own this course" };
      if (existing.status === "published") {
        return { ok: false, error: "Unpublish the course before editing its details" };
      }
      const { error } = await service.from("courses").update(payload).eq("id", parsed.data.id);
      if (error) return { ok: false, error: "Could not save the course" };
      revalidatePath("/creator/courses");
      revalidatePath(`/creator/courses/${parsed.data.id}/edit`);
      return { ok: true, id: parsed.data.id };
    }

    const slug = await uniqueSlug(service, parsed.data.title);
    const { data: created, error } = await service
      .from("courses")
      .insert({ ...payload, slug, creator_id: session.id, status: "draft" })
      .select("id")
      .single();
    if (error || !created) return { ok: false, error: "Could not create the course" };

    revalidatePath("/creator/courses");
    return { ok: true, id: created.id as string };
  } catch (error) {
    return fail(error, "Could not save the course");
  }
}

async function uniqueSlug(service: NonNullable<ReturnType<typeof createServiceClient>>, title: string): Promise<string> {
  const base =
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 60) || "course";
  let candidate = base;
  for (let i = 0; i < 20; i += 1) {
    const { data } = await service.from("courses").select("id").eq("slug", candidate).maybeSingle();
    if (!data) return candidate;
    candidate = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function deleteCourse(courseId: string): Promise<CreatorActionResult> {
  try {
    const session = await requireCreator();
    if (!UUID.safeParse(courseId).success) return { ok: false, error: "Invalid course" };
    const service = createServiceClient();
    if (!service) return { ok: false, error: "Service is unavailable" };

    const { data: course } = await service
      .from("courses")
      .select("creator_id, status")
      .eq("id", courseId)
      .maybeSingle();
    if (!course) return { ok: false, error: "Course not found" };
    if (course.creator_id !== session.id) return { ok: false, error: "You do not own this course" };
    if (course.status === "published") {
      return { ok: false, error: "Unpublish the course before deleting it" };
    }

    const { data: sales } = await service
      .from("order_items")
      .select("id")
      .eq("course_id", courseId)
      .limit(1);
    if ((sales ?? []).length > 0) {
      return { ok: false, error: "This course has sales history and cannot be deleted. Archive it instead." };
    }

    await service.from("courses").delete().eq("id", courseId);
    revalidatePath("/creator/courses");
    return { ok: true };
  } catch (error) {
    return fail(error, "Could not delete the course");
  }
}

export async function archiveCourse(courseId: string): Promise<CreatorActionResult> {
  try {
    const session = await requireCreator();
    const service = createServiceClient();
    if (!service) return { ok: false, error: "Service is unavailable" };
    const { data: course } = await service.from("courses").select("creator_id").eq("id", courseId).maybeSingle();
    if (!course || course.creator_id !== session.id) return { ok: false, error: "You do not own this course" };

    await service
      .from("courses")
      .update({ status: "archived", published_at: null })
      .eq("id", courseId);
    await service
      .from("course_review_events")
      .insert({
        course_id: courseId,
        actor_id: session.id,
        actor_role: "creator",
        to_status: "archived",
        note: "Archived by the creator",
      });

    revalidatePath("/creator/courses");
    return { ok: true };
  } catch (error) {
    return fail(error, "Could not archive the course");
  }
}

/** Submits a draft for moderation. Only the owner can do this. */
export async function submitCourseForReview(courseId: string): Promise<CreatorActionResult> {
  try {
    const session = await requireCreator();
    const service = createServiceClient();
    if (!service) return { ok: false, error: "Service is unavailable" };

    const { data: course } = await service
      .from("courses")
      .select("creator_id, status, title, slug, lessons_count")
      .eq("id", courseId)
      .maybeSingle();
    if (!course) return { ok: false, error: "Course not found" };
    if (course.creator_id !== session.id) return { ok: false, error: "You do not own this course" };
    if (!["draft", "changes_requested", "rejected"].includes(course.status)) {
      return { ok: false, error: "This course is not in a state that can be submitted" };
    }
    if (Number(course.lessons_count ?? 0) === 0) {
      return { ok: false, error: "Add at least one lesson before submitting" };
    }

    if (Number(course.lessons_count ?? 0) > 0) {
      const { data: creator } = await service
        .from("creator_profiles")
        .select("route_account_status")
        .eq("user_id", session.id)
        .maybeSingle();
      const { data: priceRow } = await service.from("courses").select("price_paise").eq("id", courseId).maybeSingle();
      if (Number(priceRow?.price_paise ?? 0) > 0 && creator?.route_account_status !== "active") {
        return {
          ok: false,
          error:
            "A paid course can only go live once Razorpay reports your Route settlement account as active. Complete settlement onboarding first.",
        };
      }
    }

    await service
      .from("courses")
      .update({ status: "pending", submitted_at: new Date().toISOString(), rejection_reason: null })
      .eq("id", courseId);
    await service.from("course_review_events").insert({
      course_id: courseId,
      actor_id: session.id,
      actor_role: "creator",
      to_status: "pending",
      note: "Submitted for review",
    });

    const { data: profile } = await service.from("profiles").select("email, full_name").eq("id", session.id).maybeSingle();
    if (profile) {
      await dispatchEmail({
        to_email: profile.email,
        template: "course_submitted",
        payload: { creatorName: profile.full_name ?? "Creator", courseTitle: course.title },
      });
    }

    revalidatePath("/creator/courses");
    revalidatePath(`/creator/courses/${courseId}/publish`);
    return { ok: true };
  } catch (error) {
    return fail(error, "Could not submit the course for review");
  }
}

/* -------------------------------------------------------------------------- */
/* Curriculum                                                                  */
/* -------------------------------------------------------------------------- */

const sectionSchema = z.object({
  courseId: UUID,
  id: UUID.optional(),
  title: z.string().trim().min(1, "Section title is required").max(120),
  sortOrder: z.number().int().min(0).max(999),
});

const lessonSchema = z.object({
  courseId: UUID,
  id: UUID.optional(),
  sectionId: UUID.optional().nullable(),
  title: z.string().trim().min(1, "Lesson title is required").max(160),
  description: z.string().trim().max(2000).optional(),
  kind: z.enum(["video", "reading", "quiz"]).default("video"),
  sortOrder: z.number().int().min(0).max(9999),
  durationMinutes: z.number().int().min(0).max(600).default(0),
  isPreview: z.boolean().default(false),
});

async function assertOwnsCourse(courseId: string, userId: string): Promise<void> {
  const service = createServiceClient();
  if (!service) throw new AuthorizationError("Service is unavailable", 503);
  const { data } = await service.from("courses").select("creator_id").eq("id", courseId).maybeSingle();
  if (!data) throw new AuthorizationError("Course not found", 404);
  if (data.creator_id !== userId) throw new AuthorizationError("You do not own this course", 403);
}

export async function saveSection(input: unknown): Promise<CreatorActionResult> {
  try {
    const session = await requireCreator();
    const parsed = sectionSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid section" };
    await assertOwnsCourse(parsed.data.courseId, session.id);
    const service = createServiceClient()!;

    if (parsed.data.id) {
      await service
        .from("course_sections")
        .update({ title: parsed.data.title, sort_order: parsed.data.sortOrder })
        .eq("id", parsed.data.id)
        .eq("course_id", parsed.data.courseId);
    } else {
      await service
        .from("course_sections")
        .insert({ course_id: parsed.data.courseId, title: parsed.data.title, sort_order: parsed.data.sortOrder });
    }
    await refreshCourseAggregates(service, parsed.data.courseId);
    revalidatePath(`/creator/courses/${parsed.data.courseId}/curriculum`);
    return { ok: true };
  } catch (error) {
    return fail(error, "Could not save the section");
  }
}

export async function deleteSection(sectionId: string, courseId: string): Promise<CreatorActionResult> {
  try {
    const session = await requireCreator();
    if (!UUID.safeParse(sectionId).success || !UUID.safeParse(courseId).success) {
      return { ok: false, error: "Invalid section" };
    }
    await assertOwnsCourse(courseId, session.id);
    const service = createServiceClient()!;
    await service.from("course_sections").delete().eq("id", sectionId).eq("course_id", courseId);
    await refreshCourseAggregates(service, courseId);
    revalidatePath(`/creator/courses/${courseId}/curriculum`);
    return { ok: true };
  } catch (error) {
    return fail(error, "Could not delete the section");
  }
}

export async function saveLesson(input: unknown): Promise<CreatorActionResult> {
  try {
    const session = await requireCreator();
    const parsed = lessonSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid lesson" };
    await assertOwnsCourse(parsed.data.courseId, session.id);
    const service = createServiceClient()!;

    const payload = {
      course_id: parsed.data.courseId,
      section_id: parsed.data.sectionId ?? null,
      title: parsed.data.title,
      description: parsed.data.description || null,
      kind: parsed.data.kind,
      sort_order: parsed.data.sortOrder,
      duration_minutes: parsed.data.durationMinutes,
      is_preview: parsed.data.isPreview,
    };

    if (parsed.data.id) {
      await service.from("lessons").update(payload).eq("id", parsed.data.id).eq("course_id", parsed.data.courseId);
    } else {
      await service.from("lessons").insert(payload);
    }
    await refreshCourseAggregates(service, parsed.data.courseId);
    revalidatePath(`/creator/courses/${parsed.data.courseId}/curriculum`);
    return { ok: true, id: parsed.data.id };
  } catch (error) {
    return fail(error, "Could not save the lesson");
  }
}

/** Detaches (and, where possible, deletes) the provider video before removing a lesson. */
export async function deleteLesson(lessonId: string, courseId: string): Promise<CreatorActionResult> {
  try {
    const session = await requireCreator();
    if (!UUID.safeParse(lessonId).success || !UUID.safeParse(courseId).success) {
      return { ok: false, error: "Invalid lesson" };
    }
    await assertOwnsCourse(courseId, session.id);
    const service = createServiceClient()!;

    const { data: lesson } = await service
      .from("lessons")
      .select("bunny_video_id")
      .eq("id", lessonId)
      .maybeSingle();

    await service.from("lessons").delete().eq("id", lessonId).eq("course_id", courseId);

    if (lesson?.bunny_video_id) {
      const { deleteVideo } = await import("@/lib/server/bunny");
      try {
        await deleteVideo(lesson.bunny_video_id);
      } catch {
        // The orphan is reported by the provider, not silently ignored.
        await service
          .from("notifications")
          .insert({
            user_id: session.id,
            kind: "system",
            title: "Video cleanup pending",
            body: "A deleted lesson's video could not be removed from Bunny Stream. Our team will clear it.",
            href: "/creator/courses",
          });
      }
    }

    await refreshCourseAggregates(service, courseId);
    revalidatePath(`/creator/courses/${courseId}/curriculum`);
    return { ok: true };
  } catch (error) {
    return fail(error, "Could not delete the lesson");
  }
}

async function refreshCourseAggregates(service: NonNullable<ReturnType<typeof createServiceClient>>, courseId: string) {
  const [{ count: lessonCount }, { data: lessons }, { count: resourceCount }] = await Promise.all([
    service.from("lessons").select("id", { count: "exact", head: true }).eq("course_id", courseId),
    service.from("lessons").select("duration_minutes").eq("course_id", courseId),
    service.from("course_resources").select("id", { count: "exact", head: true }).eq("course_id", courseId),
  ]);
  const minutes = ((lessons ?? []) as Array<{ duration_minutes: number }>).reduce(
    (sum, row) => sum + Number(row.duration_minutes ?? 0),
    0
  );
  await service
    .from("courses")
    .update({
      lessons_count: lessonCount ?? 0,
      duration_minutes: minutes,
      downloadable_resources: resourceCount ?? 0,
    })
    .eq("id", courseId);
}

/* -------------------------------------------------------------------------- */
/* Resources and settings                                                      */
/* -------------------------------------------------------------------------- */

export async function deleteResource(resourceId: string, courseId: string): Promise<CreatorActionResult> {
  try {
    const session = await requireCreator();
    if (!UUID.safeParse(resourceId).success || !UUID.safeParse(courseId).success) {
      return { ok: false, error: "Invalid resource" };
    }
    await assertOwnsCourse(courseId, session.id);
    const service = createServiceClient()!;

    const { data: resource } = await service
      .from("course_resources")
      .select("object_key")
      .eq("id", resourceId)
      .maybeSingle();
    await service.from("course_resources").delete().eq("id", resourceId).eq("course_id", courseId);

    if (resource?.object_key) {
      const { deleteObject } = await import("@/lib/server/r2");
      try {
        await deleteObject(resource.object_key);
      } catch {
        /* orphan noted by the bucket, not by the user */
      }
    }

    await refreshCourseAggregates(service, courseId);
    revalidatePath(`/creator/courses/${courseId}/content`);
    return { ok: true };
  } catch (error) {
    return fail(error, "Could not delete the resource");
  }
}

const prefsSchema = z.object({
  goalMinutesPerDay: z.number().int().min(5).max(480),
  emailCourseUpdates: z.boolean(),
  emailPromos: z.boolean(),
  weeklyReport: z.boolean(),
  studyReminders: z.boolean(),
});

/**
 * Creator preferences.
 *
 * There is no payout threshold, payout method or currency control here:
 * settlement runs through Razorpay Route into an Indian bank account and is
 * configured in the Razorpay Dashboard, not in Zybble.
 */
export async function saveCreatorPreferences(input: unknown): Promise<CreatorActionResult> {
  try {
    const session = await requireCreator();
    const parsed = prefsSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid preferences" };
    const supabase = await createServerClient();
    await supabase.from("learner_preferences").upsert({ user_id: session.id, ...parsed.data }, { onConflict: "user_id" });
    revalidatePath("/creator/settings");
    return { ok: true, message: `Saved. Your next earnings summary will show amounts in INR.` };
  } catch (error) {
    return fail(error, "Could not save your preferences");
  }
}

