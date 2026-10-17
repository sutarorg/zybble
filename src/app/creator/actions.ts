"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceClient, createServerClient } from "@/lib/supabase/server";
import { requireCreator, requireSession, AuthorizationError } from "@/lib/server/session";
import { inrPriceInputSchema, formatInr } from "@/lib/money";
import { sendEmail } from "@/lib/server/email";
import {
  encryptPayoutDestination,
  PayoutCryptoError,
  preparePayoutDestination,
} from "@/lib/server/payout-crypto";
import {
  assertValidPayoutTransition,
  generatePublicPayoutId,
  PayoutWorkflowError,
  validatePayoutRequestCreation,
} from "@/lib/server/payouts";
import { getCreatorFinance } from "@/lib/server/creator";
import { announceNewLesson } from "@/lib/server/course-updates";
import { isReservedUsername } from "@/lib/creator";
import { TEACHING_LANGUAGES } from "@/lib/config/catalog";
import { rateLimit } from "@/lib/rate-limit";
import {
  computeCourseReadiness,
  courseSchema,
  lessonSchema,
  sectionSchema,
  serializeLessonQuiz,
  serializeLessonResources,
} from "@/lib/course-wizard";

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
    // Becoming a creator is the one studio action that must work *before* a
    // creator profile exists, so the guard is the session, not the studio role.
    const session = await requireSession();
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

const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Pick a username with at least 3 characters")
  .max(30)
  .regex(/^[a-z0-9][a-z0-9-]*$/, "Use lowercase letters, numbers and hyphens only")
  .refine((value) => !isReservedUsername(value), "That username is reserved");

const creatorProfileSchema = z.object({
  username: usernameSchema,
  displayName: z.string().trim().min(2, "Enter your display name").max(80),
  headline: z.string().trim().max(140).optional(),
  bio: z.string().trim().max(2000).optional(),
  languages: z.array(z.string().max(40)).max(10).default(["English"]),
  topics: z.array(z.string().max(40)).max(10).default([]),
  website: z.string().trim().url("Enter a valid URL").max(200).optional().or(z.literal("")),
});

export interface UsernameAvailability {
  available: boolean;
  /**
   * Why it is not available, in words the form can render. `own` means the
   * caller already holds it, which counts as available.
   */
  reason?: "invalid" | "reserved" | "taken" | "own" | "unavailable" | "rate_limited";
  /** The server's own wording, so the form shows the rule that was applied. */
  message?: string;
  /**
   * The normalised value that was actually checked. The caller must compare it
   * against the field before painting a result, or a slow response for
   * "adas" would tick a box that now says "adash".
   */
  checked: string;
}

/**
 * Live username availability for the profile and signup forms.
 *
 * Reads through the service role because one creator cannot see another's
 * `creator_profiles` row under RLS, and an availability check that could only
 * ever see its own row would report every username as free. The answer is not a
 * secret: `/instructors/<username>` is a public page, so this discloses nothing
 * that browsing the catalog does not. It is rate limited anyway, because a
 * per-keystroke endpoint is otherwise a free enumeration service.
 *
 * The verdict is advisory — `saveCreatorProfile` re-checks and is the only thing
 * that can actually claim the name.
 */
export async function checkUsernameAvailability(username: unknown): Promise<UsernameAvailability> {
  const checked = typeof username === "string" ? username.trim().toLowerCase() : "";

  try {
    const session = await requireSession();

    const limit = rateLimit(`username:${session.id}`, 40, 60_000);
    if (!limit.allowed) {
      return { available: false, reason: "rate_limited", message: "Too many checks — pause a moment", checked };
    }

    const parsed = usernameSchema.safeParse(username);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "That username is not allowed";
      return {
        available: false,
        reason: /reserved/i.test(message) ? "reserved" : "invalid",
        message,
        checked,
      };
    }

    const service = createServiceClient();
    if (!service) {
      return { available: false, reason: "unavailable", message: "Availability cannot be checked right now", checked };
    }

    const { data, error } = await service
      .from("creator_profiles")
      .select("user_id")
      .eq("username", parsed.data)
      .maybeSingle();
    if (error) {
      return { available: false, reason: "unavailable", message: "Availability cannot be checked right now", checked };
    }

    if (!data) return { available: true, message: "Available", checked };
    if (String(data.user_id) === session.id) {
      return { available: true, reason: "own", message: "This is your current username", checked };
    }
    return { available: false, reason: "taken", message: "That username is already taken", checked };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { available: false, reason: "unavailable", message: error.message, checked };
    }
    console.error("[creator-action] username check failed", {
      reason: error instanceof Error ? error.message.slice(0, 200) : "unknown",
    });
    return { available: false, reason: "unavailable", message: "Availability cannot be checked right now", checked };
  }
}

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

/* -------------------------------------------------------------------------- */
/* Manual Payout Destination & Payout Requests                                 */
/* -------------------------------------------------------------------------- */

const payoutDestinationFormSchema = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("upi"),
    accountHolderName: z.string().trim().min(1, "Enter the beneficiary name"),
    upiId: z.string().trim().min(3, "Enter a valid UPI ID (VPA)"),
  }),
  z.object({
    method: z.literal("bank"),
    accountHolderName: z.string().trim().min(1, "Enter the account holder name"),
    accountNumber: z.string().trim().min(6, "Enter the bank account number"),
    ifsc: z.string().trim().min(11, "Enter the 11-character IFSC code"),
    bankName: z.string().trim().max(100).optional(),
  }),
]);

/**
 * Saves or updates the creator's single active manual payout destination
 * (either UPI or Indian bank transfer).
 *
 * Sensitive fields (beneficiary name, full account number / UPI VPA) are
 * encrypted server-side using AES-256-GCM before storage. Only masked display
 * metadata is returned or exposed to client components.
 */
export async function savePayoutDestination(input: unknown): Promise<CreatorActionResult> {
  try {
    const session = await requireCreator();
    const parsed = payoutDestinationFormSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your payout destination details" };
    }

    let summary;
    try {
      summary = preparePayoutDestination(parsed.data);
    } catch (err) {
      if (err instanceof PayoutCryptoError) {
        return { ok: false, error: err.message };
      }
      throw err;
    }

    let encryptedPayload: string;
    try {
      encryptedPayload = encryptPayoutDestination(summary.secretPayload, {
        creatorId: session.id,
      });
    } catch (cryptoErr) {
      if (cryptoErr instanceof PayoutCryptoError) {
        return {
          ok: false,
          error:
            "Payout destination storage is not configured in this environment (PAYOUT_DETAILS_ENCRYPTION_KEY is missing or invalid).",
        };
      }
      throw cryptoErr;
    }

    const service = createServiceClient();
    if (!service) return { ok: false, error: "Service is unavailable" };

    const now = new Date().toISOString();
    const { error } = await service.from("creator_payout_destinations").upsert(
      {
        creator_id: session.id,
        method: summary.method,
        encrypted_payload: encryptedPayload,
        key_version: 1,
        masked_destination: summary.maskedDestination,
        masked_account_holder: summary.maskedAccountHolder,
        bank_label: summary.bankLabel,
        updated_at: now,
      },
      { onConflict: "creator_id" }
    );
    if (error) {
      return { ok: false, error: "Could not save your payout destination" };
    }

    await service.from("payout_audit_events").insert({
      creator_id: session.id,
      actor_id: session.id,
      action: "destination_saved",
      metadata: {
        method: summary.method,
        masked_destination: summary.maskedDestination,
        masked_account_holder: summary.maskedAccountHolder,
        bank_label: summary.bankLabel,
      },
    });

    revalidatePath("/creator/onboarding");
    revalidatePath("/creator/payouts");
    revalidatePath("/creator/earnings");
    revalidatePath("/creator");
    return {
      ok: true,
      message: `Payout destination saved (${summary.maskedDestination}) · Status: details saved, awaiting payout.`,
    };
  } catch (error) {
    return fail(error, "Could not save your payout destination");
  }
}

const payoutRequestSchema = z.object({
  amountRupees: z.union([z.string(), z.number()]),
  note: z.string().trim().max(500, "Keep your note under 500 characters").optional(),
});

/**
 * Submits a manual payout request for the authenticated creator's available INR
 * balance, atomically reserving the requested amount so concurrent submissions
 * cannot exceed the creator's available balance.
 */
export async function requestCreatorPayout(input: unknown): Promise<CreatorActionResult> {
  try {
    const session = await requireCreator();
    const parsed = payoutRequestSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your payout request details" };
    }

    const amountParsed = inrPriceInputSchema.safeParse(parsed.data.amountRupees);
    if (!amountParsed.success || amountParsed.data <= 0) {
      return { ok: false, error: "Enter a valid payout amount in INR greater than ₹0" };
    }
    const requestedPaise = amountParsed.data;

    const service = createServiceClient();
    if (!service) return { ok: false, error: "Service is unavailable" };

    const [{ data: destRow }, finance] = await Promise.all([
      service
        .from("creator_payout_destinations")
        .select(
          "method, encrypted_payload, key_version, masked_destination, masked_account_holder, bank_label"
        )
        .eq("creator_id", session.id)
        .maybeSingle(),
      getCreatorFinance(),
    ]);

    try {
      validatePayoutRequestCreation({
        hasDestination: Boolean(destRow),
        availablePaise: finance.availablePaise,
        requestedAmountPaise: requestedPaise,
      });
    } catch (validationErr) {
      if (validationErr instanceof PayoutWorkflowError) {
        return { ok: false, error: validationErr.message };
      }
      throw validationErr;
    }

    const dest = destRow as Record<string, unknown>;
    const publicId = generatePublicPayoutId();
    const note = parsed.data.note?.trim() || null;

    // Prefer the atomic database RPC which acquires a row lock on creator_profiles
    // and re-verifies available balance inside a single Postgres transaction.
    let createdRequestId: string | null = null;
    if (typeof (service as { rpc?: unknown }).rpc === "function") {
      const { data: rpcRow, error: rpcError } = await service.rpc("create_creator_payout_request", {
        p_creator_id: session.id,
        p_public_id: publicId,
        p_amount_paise: requestedPaise,
        p_creator_note: note,
      });
      if (rpcError) {
        const msg = String(rpcError.message ?? "");
        if (/exceeds available balance/i.test(msg)) {
          return { ok: false, error: "Requested amount exceeds your available balance." };
        }
        if (/destination is required/i.test(msg)) {
          return { ok: false, error: "Save a payout destination before requesting a payout." };
        }
        if (!/function .* does not exist/i.test(msg)) {
          return { ok: false, error: "Could not submit your payout request. Please try again." };
        }
      } else if (rpcRow) {
        createdRequestId = String((rpcRow as Record<string, unknown>).id ?? "");
      }
    }

    if (!createdRequestId) {
      const { data: inserted, error: insertError } = await service
        .from("payout_requests")
        .insert({
          public_id: publicId,
          creator_id: session.id,
          amount_paise: requestedPaise,
          currency: "INR",
          status: "requested",
          destination_method: String(dest.method),
          destination_encrypted_payload: String(dest.encrypted_payload),
          destination_key_version: Number(dest.key_version ?? 1),
          destination_masked: String(dest.masked_destination),
          destination_holder_masked: String(dest.masked_account_holder),
          destination_bank_label: (dest.bank_label as string) ?? null,
          creator_note: note,
        })
        .select("id")
        .single();
      if (insertError || !inserted) {
        return { ok: false, error: "Could not submit your payout request" };
      }
      createdRequestId = String((inserted as Record<string, unknown>).id);
      await service.from("payout_audit_events").insert({
        payout_request_id: createdRequestId,
        creator_id: session.id,
        actor_id: session.id,
        action: "payout_requested",
        metadata: {
          public_id: publicId,
          amount_paise: requestedPaise,
          destination_method: String(dest.method),
          destination_masked: String(dest.masked_destination),
        },
      });
    }

    const { data: profile } = await service
      .from("profiles")
      .select("email, full_name")
      .eq("id", session.id)
      .maybeSingle();
    if (profile?.email) {
      // Sent through `sendEmail`, not `dispatchEmail`: this is a payout update,
      // and the creator's studio settings decide whether payout updates reach
      // their inbox. The request itself is already committed either way.
      await sendEmail({
        to: String(profile.email),
        userId: session.id,
        template: "payout_requested",
        data: {
          creatorName: String(profile.full_name ?? "Creator"),
          publicId,
          amount: formatInr(requestedPaise),
          destinationMasked: `${String(dest.method).toUpperCase()} (${String(dest.masked_destination)})`,
        },
        idempotencyKey: `payout_requested:${publicId}`,
      });
    }

    revalidatePath("/creator/payouts");
    revalidatePath("/creator/earnings");
    revalidatePath("/creator");
    revalidatePath("/admin/payouts");
    return {
      ok: true,
      id: createdRequestId,
      message: `Payout request ${publicId} for ${formatInr(requestedPaise)} submitted. That amount is now reserved while Zybble reviews your request.`,
    };
  } catch (error) {
    return fail(error, "Could not submit your payout request");
  }
}

/**
 * Cancels a creator's own `requested` payout request before admin processing,
 * immediately releasing the reserved amount back into available balance.
 */
export async function cancelCreatorPayoutRequest(requestId: string): Promise<CreatorActionResult> {
  try {
    const session = await requireCreator();
    if (!UUID.safeParse(requestId).success) {
      return { ok: false, error: "Invalid payout request" };
    }
    const service = createServiceClient();
    if (!service) return { ok: false, error: "Service is unavailable" };

    const { data: row } = await service
      .from("payout_requests")
      .select("id, public_id, creator_id, status, amount_paise")
      .eq("id", requestId)
      .maybeSingle();
    if (!row) return { ok: false, error: "Payout request not found" };
    if (String(row.creator_id) !== session.id) {
      return { ok: false, error: "You do not own this payout request" };
    }

    try {
      assertValidPayoutTransition(
        String(row.status) as Parameters<typeof assertValidPayoutTransition>[0],
        "cancelled"
      );
    } catch (transitionErr) {
      return {
        ok: false,
        error:
          transitionErr instanceof Error
            ? transitionErr.message
            : "Only pending requests can be cancelled",
      };
    }

    const now = new Date().toISOString();
    const { error } = await service
      .from("payout_requests")
      .update({
        status: "cancelled",
        cancelled_at: now,
        updated_at: now,
      })
      .eq("id", requestId)
      .eq("creator_id", session.id)
      .eq("status", "requested");
    if (error) return { ok: false, error: "Could not cancel the payout request" };

    await service.from("payout_audit_events").insert({
      payout_request_id: requestId,
      creator_id: session.id,
      actor_id: session.id,
      action: "payout_cancelled",
      metadata: {
        public_id: String(row.public_id),
        amount_paise: Number(row.amount_paise ?? 0),
      },
    });

    revalidatePath("/creator/payouts");
    revalidatePath("/creator/earnings");
    revalidatePath("/creator");
    revalidatePath("/admin/payouts");
    return {
      ok: true,
      message: `Cancelled payout request ${String(row.public_id)}. ${formatInr(Number(row.amount_paise ?? 0))} is available in your balance again.`,
    };
  } catch (error) {
    return fail(error, "Could not cancel the payout request");
  }
}

/** Deprecated compatibility alias for `savePayoutDestination`. */
export const createRouteAccount = savePayoutDestination;

/** Refreshes the creator's saved payout destination state. */
export async function refreshRouteStatus(): Promise<CreatorActionResult> {
  try {
    await requireCreator();
    revalidatePath("/creator/onboarding");
    revalidatePath("/creator/payouts");
    revalidatePath("/creator/earnings");
    return {
      ok: true,
      message: "Payout destination status refreshed.",
    };
  } catch (error) {
    return fail(error, "Could not refresh payout destination status");
  }
}

/* -------------------------------------------------------------------------- */
/* Courses                                                                     */
/* -------------------------------------------------------------------------- */

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
      .select(
        "creator_id, status, title, slug, description, thumbnail_key, price_paise, lessons_count, categories ( slug )"
      )
      .eq("id", courseId)
      .maybeSingle();
    if (!course) return { ok: false, error: "Course not found" };
    if (course.creator_id !== session.id) return { ok: false, error: "You do not own this course" };
    if (!["draft", "changes_requested", "rejected"].includes(course.status)) {
      return { ok: false, error: "This course is not in a state that can be submitted" };
    }

    // The same readiness rules the review page shows in its checklist. The
    // server re-checks them here so the checklist can never promise a submit
    // the backend would refuse (or allow one the checklist calls incomplete).
    const { data: lessonRows } = await service
      .from("lessons")
      .select("kind, bunny_playback_ready, bunny_video_id")
      .eq("course_id", courseId);
    // The untyped client types a to-one join as an array; normalise both shapes.
    const categoryJoin = course.categories as { slug: string } | { slug: string }[] | null;
    const categorySlug = Array.isArray(categoryJoin)
      ? (categoryJoin[0]?.slug ?? null)
      : (categoryJoin?.slug ?? null);
    const readiness = computeCourseReadiness({
      courseId,
      title: String(course.title ?? ""),
      description: String(course.description ?? ""),
      categorySlug,
      thumbnailKey: (course.thumbnail_key as string) ?? null,
      pricePaise: Number(course.price_paise ?? 0),
      lessons: ((lessonRows ?? []) as Array<Record<string, unknown>>).map((row) => ({
        kind: String(row.kind ?? "video"),
        playbackReady: Boolean(row.bunny_playback_ready),
        hasVideo: Boolean(row.bunny_video_id),
      })),
    });
    if (!readiness.checks.find((check) => check.id === "lessons")!.done) {
      return { ok: false, error: "Add at least one lesson before submitting" };
    }
    if (!readiness.ready) {
      return { ok: false, error: `Finish these before submitting: ${readiness.missing.join(", ")}.` };
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
    if (profile?.email) {
      // A moderation notice: gated by the studio's moderation switch.
      await sendEmail({
        to: String(profile.email),
        userId: session.id,
        template: "course_submitted",
        data: { creatorName: String(profile.full_name ?? "Creator"), courseTitle: course.title },
        idempotencyKey: `course_submitted:${courseId}:${Date.now()}`,
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

    let serializedDescription = parsed.data.description || null;
    if (parsed.data.kind === "quiz" && parsed.data.quizConfig) {
      serializedDescription = serializeLessonQuiz({
        instructions: parsed.data.description ?? "",
        passingScorePercent: parsed.data.quizConfig.passingScorePercent,
        questions: parsed.data.quizConfig.questions,
      });
    } else if (parsed.data.kind === "reading" && parsed.data.resourceLinks) {
      serializedDescription = serializeLessonResources({
        notes: parsed.data.description ?? "",
        links: parsed.data.resourceLinks,
      });
    }

    const payload = {
      course_id: parsed.data.courseId,
      section_id: parsed.data.sectionId ?? null,
      title: parsed.data.title,
      description: serializedDescription,
      kind: parsed.data.kind,
      sort_order: parsed.data.sortOrder,
      duration_minutes: parsed.data.durationMinutes,
      is_preview: parsed.data.isPreview,
    };

    if (parsed.data.id) {
      await service.from("lessons").update(payload).eq("id", parsed.data.id).eq("course_id", parsed.data.courseId);
      await refreshCourseAggregates(service, parsed.data.courseId);
      revalidatePath(`/creator/courses/${parsed.data.courseId}/curriculum`);
      revalidatePath(`/creator/courses/${parsed.data.courseId}/publish`);
      return { ok: true, id: parsed.data.id };
    }

    const { data: created, error: insertError } = await service
      .from("lessons")
      .insert(payload)
      .select("id")
      .single();
    if (insertError || !created) {
      console.error("[creator-action] could not add the lesson", { reason: insertError?.message.slice(0, 200) });
      return { ok: false, error: "Could not save the lesson" };
    }

    await refreshCourseAggregates(service, parsed.data.courseId);

    // A new lesson on a published course is news to everybody holding a seat.
    // Announcing it must never fail the save: the lesson exists, so the creator
    // is told the truth about it either way.
    let announcement: Awaited<ReturnType<typeof announceNewLesson>> | null = null;
    try {
      announcement = await announceNewLesson(service, {
        courseId: parsed.data.courseId,
        lessonId: String(created.id),
        lessonTitle: parsed.data.title,
      });
    } catch (error) {
      console.error("[creator-action] lesson announcement failed", {
        course: parsed.data.courseId,
        reason: error instanceof Error ? error.message.slice(0, 200) : "unknown",
      });
    }

    revalidatePath(`/creator/courses/${parsed.data.courseId}/curriculum`);
    revalidatePath(`/creator/courses/${parsed.data.courseId}/publish`);

    const notifiedLearners = announcement?.notified ?? 0;
    return {
      ok: true,
      id: String(created.id),
      message:
        notifiedLearners > 0
          ? `Lesson added · ${notifiedLearners} enrolled ${
              notifiedLearners === 1 ? "learner" : "learners"
            } notified`
          : "Lesson added",
    };
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

const reorderSchema = z.object({
  courseId: z.string().uuid(),
  ids: z.array(z.string().uuid()).min(1).max(200),
});

/**
 * Persists a new section order. `ids` must be the course's complete set of
 * sections in their new order; `sort_order` becomes the array index.
 *
 * The submitted list is checked against the rows that actually exist, so a
 * stale reorder (someone deleted a section in another tab) can never scramble
 * the curriculum — it is rejected and the editor refreshes instead.
 */
export async function reorderSections(input: unknown): Promise<CreatorActionResult> {
  try {
    const session = await requireCreator();
    const parsed = reorderSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid section order" };
    await assertOwnsCourse(parsed.data.courseId, session.id);
    const service = createServiceClient()!;

    const { data: rows } = await service
      .from("course_sections")
      .select("id")
      .eq("course_id", parsed.data.courseId);
    const existing = ((rows ?? []) as Array<{ id: string }>).map((row) => String(row.id));
    if (!sameIdSet(existing, parsed.data.ids)) {
      return { ok: false, error: "The curriculum changed while you were editing. Refresh and try again." };
    }

    for (const [index, id] of parsed.data.ids.entries()) {
      await service.from("course_sections").update({ sort_order: index }).eq("id", id).eq("course_id", parsed.data.courseId);
    }
    revalidatePath(`/creator/courses/${parsed.data.courseId}/curriculum`);
    return { ok: true };
  } catch (error) {
    return fail(error, "Could not reorder the sections");
  }
}

const reorderLessonsSchema = reorderSchema.extend({
  sectionId: z.string().uuid(),
});

/**
 * Persists a new lesson order inside one section. Same completeness check as
 * `reorderSections`: `ids` is the section's full lesson list in the new order.
 */
export async function reorderLessons(input: unknown): Promise<CreatorActionResult> {
  try {
    const session = await requireCreator();
    const parsed = reorderLessonsSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid lesson order" };
    await assertOwnsCourse(parsed.data.courseId, session.id);
    const service = createServiceClient()!;

    const { data: rows } = await service
      .from("lessons")
      .select("id")
      .eq("course_id", parsed.data.courseId)
      .eq("section_id", parsed.data.sectionId);
    const existing = ((rows ?? []) as Array<{ id: string }>).map((row) => String(row.id));
    if (!sameIdSet(existing, parsed.data.ids)) {
      return { ok: false, error: "The curriculum changed while you were editing. Refresh and try again." };
    }

    for (const [index, id] of parsed.data.ids.entries()) {
      await service.from("lessons").update({ sort_order: index }).eq("id", id).eq("course_id", parsed.data.courseId);
    }
    revalidatePath(`/creator/courses/${parsed.data.courseId}/curriculum`);
    return { ok: true };
  } catch (error) {
    return fail(error, "Could not reorder the lessons");
  }
}

function sameIdSet(existing: string[], submitted: string[]): boolean {
  if (existing.length !== submitted.length) return false;
  const set = new Set(existing);
  return submitted.every((id) => set.has(id)) && new Set(submitted).size === submitted.length;
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

const updateResourceSchema = z.object({
  resourceId: z.string().uuid(),
  courseId: z.string().uuid(),
  title: z.string().trim().min(1, "Enter a resource title").max(200, "Resource title must be 200 characters or fewer"),
});

export async function updateResource(input: unknown): Promise<CreatorActionResult> {
  try {
    const session = await requireCreator();
    const parsed = updateResourceSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid resource title" };
    }
    await assertOwnsCourse(parsed.data.courseId, session.id);
    const service = createServiceClient()!;

    const { error } = await service
      .from("course_resources")
      .update({ title: parsed.data.title })
      .eq("id", parsed.data.resourceId)
      .eq("course_id", parsed.data.courseId);
    if (error) {
      return { ok: false, error: "Could not update the resource title" };
    }

    revalidatePath(`/creator/courses/${parsed.data.courseId}/curriculum`);
    revalidatePath(`/creator/courses/${parsed.data.courseId}/content`);
    revalidatePath(`/creator/courses/${parsed.data.courseId}/publish`);
    return { ok: true, message: "Resource updated" };
  } catch (error) {
    return fail(error, "Could not update the resource");
  }
}

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
    revalidatePath(`/creator/courses/${courseId}/curriculum`);
    revalidatePath(`/creator/courses/${courseId}/content`);
    revalidatePath(`/creator/courses/${courseId}/publish`);
    return { ok: true };
  } catch (error) {
    return fail(error, "Could not delete the resource");
  }
}

const studioPrefsSchema = z.object({
  emailNewEnrollment: z.boolean(),
  emailNewReview: z.boolean(),
  emailModeration: z.boolean(),
  emailPayoutUpdates: z.boolean(),
  notifyInApp: z.boolean(),
  defaultCourseLanguage: z.string().trim().min(1, "Choose a teaching language").max(40),
  defaultCourseLevel: z.enum(["beginner", "intermediate", "advanced"]),
  /** Typed in rupees like every other price field; stored as integer paise. */
  defaultPriceRupees: inrPriceInputSchema,
});

/**
 * Studio settings.
 *
 * These write to `creator_studio_preferences` and nowhere else. This action used
 * to save the learner's daily goal and study reminders from the studio, with
 * camelCase keys against a snake_case table — so it configured the wrong table
 * and the write was rejected besides.
 *
 * What is deliberately not here: payout destinations and requests live on the
 * Payouts page, the commission rate is a marketplace setting, and learner
 * preferences belong to `/settings`.
 */
export async function saveCreatorPreferences(input: unknown): Promise<CreatorActionResult> {
  try {
    const session = await requireCreator();
    const parsed = studioPrefsSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your studio settings" };
    }

    if (!(TEACHING_LANGUAGES as readonly string[]).includes(parsed.data.defaultCourseLanguage)) {
      return { ok: false, error: "Choose a teaching language Zybble supports" };
    }

    const supabase = await createServerClient();
    const { error } = await supabase.from("creator_studio_preferences").upsert(
      {
        user_id: session.id,
        email_new_enrollment: parsed.data.emailNewEnrollment,
        email_new_review: parsed.data.emailNewReview,
        email_moderation: parsed.data.emailModeration,
        email_payout_updates: parsed.data.emailPayoutUpdates,
        notify_in_app: parsed.data.notifyInApp,
        default_course_language: parsed.data.defaultCourseLanguage,
        default_course_level: parsed.data.defaultCourseLevel,
        default_price_paise: parsed.data.defaultPriceRupees,
      },
      { onConflict: "user_id" }
    );
    if (error) {
      console.error("[creator-action] could not save studio settings", { reason: error.message.slice(0, 200) });
      return { ok: false, error: "Could not save your studio settings" };
    }

    // The new-course form reads these defaults, so it must re-read them too.
    revalidatePath("/creator/settings");
    revalidatePath("/creator/courses/new");
    return { ok: true, message: "Studio settings saved" };
  } catch (error) {
    return fail(error, "Could not save your studio settings");
  }
}

