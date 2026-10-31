import { z } from "zod";
import { defineRoute } from "@/lib/api/http";
import { deleteAccount } from "@/features/auth/service";
import { passwordSchema } from "@/lib/validation/auth";

/**
 * DELETE /api/auth/account — erase the account (right to erasure).
 *
 * Requires the current password as a confirmation step, and rate-limited hard
 * because it is irreversible. Cancels live billing, purges every workspace the
 * user owns (secrets, media rows, posts, analytics, audit logs) and finally
 * deletes the auth user.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const deleteAccountSchema = z.object({ password: passwordSchema });

export const DELETE = defineRoute(
  {
    auth: "required",
    body: deleteAccountSchema,
    rateLimit: { limit: 3, windowMs: 60 * 60_000 },
    scope: "auth:account-delete",
  },
  async ({ body }) => {
    return deleteAccount({ password: body!.password });
  },
);
