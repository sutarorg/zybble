import { defineRoute } from "@/lib/api/http";
import { listSessions, revokeSession } from "@/features/auth/sessions";
import { ValidationError } from "@/lib/errors";
import { uuidSchema } from "@/lib/validation/posts";

/**
 * GET    /api/auth/sessions      — devices this account has signed in from.
 * DELETE /api/auth/sessions?id=… — forget one.
 *
 * Both are scoped to the caller's own user id, so one account can never
 * enumerate or remove another's devices. Revoking a row only removes it from
 * this list; it does not end the session behind it, which lives in an httpOnly
 * cookie the server owns. That limitation is stated in the UI rather than
 * implied away.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = defineRoute(
  {
    auth: "required",
    rateLimit: { limit: 60, windowMs: 60_000 },
    scope: "auth:sessions:list",
  },
  async ({ user }) => {
    return { sessions: await listSessions(user!.id) };
  },
);

export const DELETE = defineRoute(
  {
    auth: "required",
    rateLimit: { limit: 30, windowMs: 60_000 },
    scope: "auth:sessions:revoke",
  },
  async ({ user, req }) => {
    const id = req.nextUrl.searchParams.get("id");

    if (!id || !uuidSchema.safeParse(id).success) {
      throw new ValidationError("A valid session `id` is required.");
    }

    await revokeSession(user!.id, id);

    return { revoked: true };
  },
);
