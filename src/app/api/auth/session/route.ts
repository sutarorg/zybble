import { defineRoute } from "@/lib/api/http";
import { getSessionState } from "@/features/auth/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { WORKSPACE_COOKIE } from "@/lib/api/workspace";
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
  async ({ supabase, user, req }) => {
    if (!supabase || !user) throw new NotFoundError("No session.");

    // Pass the switcher's cookie through so the client is told which workspace
    // it is actually looking at, instead of having to assume the first one.
    return getSessionState(
      supabase,
      user,
      req.cookies.get(WORKSPACE_COOKIE)?.value ?? null,
    );
  },
);
