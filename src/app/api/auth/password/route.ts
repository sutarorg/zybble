import { defineRoute } from "@/lib/api/http";
import { requestPasswordReset, updatePassword } from "@/features/auth/service";
import { passwordResetRequestSchema, passwordUpdateSchema } from "@/lib/validation/auth";

/**
 * /api/auth/password
 *
 *  POST  — request a reset link (delivered by Supabase Auth; the response is
 *          always identical so the endpoint cannot be used to discover which
 *          addresses have accounts).
 *  PATCH — set a new password. Only valid inside a recovery session, which is
 *          established by `/auth/callback` when Supabase redirects back with a
 *          `type=recovery` flow.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = defineRoute(
  {
    auth: "none",
    body: passwordResetRequestSchema,
    rateLimit: { limit: 5, windowMs: 15 * 60_000 },
    scope: "auth:password-reset",
  },
  async ({ body }) => {
    return requestPasswordReset({ email: body!.email, redirectTo: body!.redirectTo });
  },
);

export const PATCH = defineRoute(
  {
    auth: "required",
    body: passwordUpdateSchema,
    rateLimit: { limit: 10, windowMs: 15 * 60_000 },
    scope: "auth:password-update",
  },
  async ({ body }) => {
    await updatePassword(body!.password);
    return { updated: true };
  },
);
