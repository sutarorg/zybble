import { defineRoute } from "@/lib/api/http";
import { resendVerification } from "@/features/auth/service";
import { verifyResendSchema } from "@/lib/validation/auth";

/**
 * POST /api/auth/verify — resend the sign-up confirmation email.
 *
 * Like the reset endpoint it always reports success: whether an address is
 * registered is not information a stranger should be able to test.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = defineRoute(
  {
    auth: "none",
    body: verifyResendSchema,
    rateLimit: { limit: 5, windowMs: 15 * 60_000 },
    scope: "auth:verify",
  },
  async ({ body }) => {
    return resendVerification({ email: body!.email, redirectTo: body!.redirectTo });
  },
);
