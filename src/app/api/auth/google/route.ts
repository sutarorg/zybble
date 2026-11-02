import { defineRoute } from "@/lib/api/http";
import { startGoogleSignIn } from "@/features/auth/service";
import { googleSignInSchema } from "@/lib/validation/auth";

/**
 * POST /api/auth/google — begin a Google sign-in.
 *
 * Returns `{ url }` and lets the browser navigate there. Doing the redirect
 * client-side rather than from this handler keeps the flow inside the same
 * React tree, so a failure renders as a message on the form instead of
 * replacing the page.
 *
 * Rate limited: each call round-trips to Supabase and creates a PKCE verifier
 * cookie, so it is not free.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = defineRoute(
  {
    auth: "none",
    body: googleSignInSchema,
    rateLimit: { limit: 20, windowMs: 15 * 60_000 },
    scope: "auth:google",
  },
  async ({ body }) => {
    return startGoogleSignIn({ redirectTo: body?.redirectTo });
  },
);
