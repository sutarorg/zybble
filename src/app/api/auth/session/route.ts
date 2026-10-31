import { defineRoute } from "@/lib/api/http";
import { getSessionState } from "@/features/auth/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NotFoundError } from "@/lib/errors";

/**
 * GET /api/auth/session — the client's source of truth after a page load.
 *
 * Returns the profile, the caller's workspaces and whether onboarding is still
 * required. Used instead of trusting cookies in the browser.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = defineRoute(
  {
    auth: "required",
    rateLimit: { limit: 120, windowMs: 60_000 },
    scope: "auth:session",
  },
  async ({ supabase, user }) => {
    if (!supabase || !user) throw new NotFoundError("No session.");
    return getSessionState(supabase, user);
  },
);
