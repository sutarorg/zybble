import { z } from "zod";
import { defineRoute } from "@/lib/api/http";
import { updateProfile } from "@/features/auth/service";
import { timezoneSchema } from "@/lib/validation/posts";
import { writeAudit } from "@/features/workspaces/access";

/**
 * PATCH /api/auth/profile — the caller's own name and timezone.
 *
 * The email is deliberately not editable here: changing it in Supabase Auth
 * requires re-verification, and doing it silently would desynchronise
 * `auth.users` from `public.profiles`.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const profileUpdateSchema = z
  .object({
    fullName: z.string().trim().max(80).nullable().optional(),
    timezone: timezoneSchema.optional(),
  })
  .refine((value) => value.fullName !== undefined || value.timezone !== undefined, {
    message: "Nothing to update.",
  });

export const PATCH = defineRoute(
  {
    auth: "required",
    body: profileUpdateSchema,
    rateLimit: { limit: 30, windowMs: 60_000 },
    scope: "auth:profile-update",
  },
  async ({ supabase, body, user, requestId }) => {
    const result = await updateProfile({
      fullName: body!.fullName,
      timezone: body!.timezone,
    });

    await writeAudit(supabase!, {
      actorUserId: user!.id,
      action: "auth.profile_updated",
      entityType: "profile",
      entityId: user!.id,
      metadata: { fields: Object.keys(body!) },
      requestId,
    });

    return result;
  },
);
