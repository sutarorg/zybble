import { z } from "zod";
import { MEDIA_LIMITS } from "@/lib/linkedin/config";
import { isValidTimeZone } from "@/lib/time";

/** Shared request schemas. API routes and services validate with the same shapes. */

export const LINKEDIN_BODY_LIMIT = 3000;

/**
 * IANA time zone.
 *
 * Validated against the runtime's zone database rather than a regex, because a
 * syntactically valid but non-existent zone would otherwise reach the scheduling
 * maths and throw a 500 mid-write.
 */
export const timezoneSchema = z
  .string()
  .min(1)
  .max(64)
  .refine((value) => isValidTimeZone(value), "Must be a valid IANA time zone.");

export const uuidSchema = z.string().uuid();

export const isoInstantSchema = z
  .string()
  .datetime({ offset: true })
  .refine((value) => !Number.isNaN(Date.parse(value)), "Must be an ISO-8601 instant.");

export const mediaKindSchema = z.enum(["image", "video", "document"]);

export const postBodySchema = z
  .string()
  .max(LINKEDIN_BODY_LIMIT, `LinkedIn posts are limited to ${LINKEDIN_BODY_LIMIT} characters.`);

/** Shared post fields. Kept refinement-free so it can be `.omit()`ed. */
const postFields = z.object({
  authorAccountId: uuidSchema,
  body: postBodySchema.default(""),
  /** Save as draft, or schedule. */
  intent: z.enum(["draft", "schedule", "publish_now"]).default("draft"),
  /** Wall-clock date in the timezone below (`YYYY-MM-DD`). Required to schedule. */
  scheduleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /** Wall-clock time (`HH:mm`). Required to schedule. */
  scheduleTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  timezone: timezoneSchema.optional(),
  /** Client-generated key; a retried submit returns the original post. */
  idempotencyKey: z.string().min(8).max(128).optional(),
  mediaAssetIds: z.array(uuidSchema).max(MEDIA_LIMITS.image.maxCount).optional(),
});

/**
 * A schedule request without a slot would otherwise fail deep inside the
 * timezone conversion with a much worse message.
 */
function requireScheduleSlot(value: { intent?: string; scheduleDate?: string; scheduleTime?: string }, ctx: z.RefinementCtx) {
  if (value.intent === "schedule" && (!value.scheduleDate || !value.scheduleTime)) {
    ctx.addIssue({
      code: "custom",
      message: "Pick a date and time before scheduling this post.",
      path: ["scheduleDate"],
    });
  }
}

export const createPostSchema = postFields.superRefine(requireScheduleSlot);

export type CreatePostInput = z.infer<typeof createPostSchema>;

export const updatePostSchema = postFields
  .omit({ idempotencyKey: true })
  .partial()
  .extend({
    status: z.enum(["draft", "scheduled", "cancelled"]).optional(),
    /**
     * Changing the publishing account is allowed while the post is a draft or
     * scheduled; the service rejects it once publishing has started.
     */
    authorAccountId: uuidSchema.optional(),
  })
  .superRefine(requireScheduleSlot);

export type UpdatePostInput = z.infer<typeof updatePostSchema>;

export const listPostsQuerySchema = z.object({
  status: z.enum(["draft", "scheduled", "published", "failed", "cancelled"]).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  accountId: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type ListPostsQuery = z.infer<typeof listPostsQuerySchema>;

export const calendarQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timezone: timezoneSchema.default("UTC"),
});

export const analyticsQuerySchema = z.object({
  range: z.enum(["7d", "28d", "12m"]).default("28d"),
  accountId: uuidSchema.optional(),
});

export const workspaceCreateSchema = z.object({
  name: z.string().min(1).max(80),
  timezone: timezoneSchema.default("UTC"),
});

export const inviteMemberSchema = z.object({
  email: z.string().email().max(200),
  role: z.enum(["admin", "editor", "viewer"]).default("editor"),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(["admin", "editor", "viewer"]),
});

export const notificationPreferencesSchema = z.object({
  email_post_published: z.boolean().optional(),
  email_post_failed: z.boolean().optional(),
  email_post_reminder: z.boolean().optional(),
  email_token_expiring: z.boolean().optional(),
  email_billing: z.boolean().optional(),
  email_product_updates: z.boolean().optional(),
  quiet_hours_start: z.number().int().min(0).max(23).nullable().optional(),
  quiet_hours_end: z.number().int().min(0).max(23).nullable().optional(),
});

export const checkoutSchema = z.object({
  seats: z.number().int().min(1).max(200).default(1),
  returnPath: z.string().max(200).default("/settings/billing"),
});

export const seatUpdateSchema = z.object({
  seats: z.number().int().min(1).max(200),
});

export const profileUpdateSchema = z.object({
  full_name: z.string().min(1).max(80).optional(),
  timezone: timezoneSchema.optional(),
  avatar_url: z.string().url().max(500).nullable().optional(),
});

export const workspaceUpdateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  timezone: timezoneSchema.optional(),
  billing_email: z.string().email().max(200).nullable().optional(),
});
