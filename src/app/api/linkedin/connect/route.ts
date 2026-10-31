import { NextResponse } from "next/server";
import { defineRoute } from "@/lib/api/http";
import { LINKEDIN_STATE_COOKIE, assertLinkedInConfigured, startConnect } from "@/features/linkedin/service";
import { requestedWorkspaceId, workspaceContext } from "@/lib/api/workspace";
import { assertCanManage } from "@/features/workspaces/access";

/**
 * GET /api/linkedin/connect
 *
 * Not a JSON endpoint: it answers with a redirect to LinkedIn's consent screen.
 * The CSRF `state` is stored (hashed) in the database and returned to the
 * browser in a short-lived httpOnly cookie, so the callback can prove the same
 * browser started the flow.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = defineRoute(
  {
    auth: "required",
    rateLimit: { limit: 10, windowMs: 60_000 },
    scope: "linkedin:connect",
  },
  async ({ supabase, req }) => {
    assertLinkedInConfigured();

    const context = await workspaceContext({
      supabase,
      user: null,
      workspaceId: requestedWorkspaceId(req),
      minimumRole: "admin",
    });

    assertCanManage(context);

    const { authorizationUrl, state } = await startConnect(context);

    const response = NextResponse.redirect(authorizationUrl);

    response.cookies.set(LINKEDIN_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 10 * 60,
    });

    return response;
  },
);
