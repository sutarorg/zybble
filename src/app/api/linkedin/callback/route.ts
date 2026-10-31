import { NextResponse, type NextRequest } from "next/server";
import { LINKEDIN_STATE_COOKIE, completeConnect } from "@/features/linkedin/service";
import { inngest } from "@/inngest/client";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * GET /api/linkedin/callback — LinkedIn redirects here with ?code&state.
 *
 * Authentication here is the `state` value, not a session cookie: the browser
 * that started the flow carries the raw state in an httpOnly cookie while the
 * database only ever held its hash. Everything else (code exchange, profile
 * lookup, encrypted storage) happens server-side in `completeConnect`.
 *
 * The redirect target is read from the state row, never from the query string,
 * so a crafted callback cannot bounce the user to another origin.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirect(req: NextRequest, path: string, params: Record<string, string> = {}) {
  const url = new URL(path, env().APP_URL ?? env().NEXT_PUBLIC_SITE_URL);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const response = NextResponse.redirect(url);
  response.cookies.delete(LINKEDIN_STATE_COOKIE);
  return response;
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");
  const cookieState = req.cookies.get(LINKEDIN_STATE_COOKIE)?.value ?? null;

  if (error) {
    return redirect(req, "/settings/linkedin", {
      linkedin_error: error === "access_denied" ? "denied" : "provider",
    });
  }

  if (!code || !state) {
    return redirect(req, "/settings/linkedin", { linkedin_error: "invalid_callback" });
  }

  try {
    const result = await completeConnect({ code, state, cookieState });

    if (result.created) {
      try {
        await inngest.send({
          name: "email/send",
          data: {
            template: "linkedin_connected",
            workspaceId: result.workspaceId,
            payload: { accountId: result.accountId },
          },
        });
      } catch (eventError) {
        // A missed email must not turn a successful connection into an error.
        logger.error("linkedin.connected_email_failed", {
          error: eventError instanceof Error ? eventError.message : "unknown",
        });
      }
    }

    return redirect(req, result.redirectTo, {
      linkedin: result.created ? "connected" : "reconnected",
    });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Could not finish connecting LinkedIn.";
    logger.warn("linkedin.callback_failed", { message });

    return redirect(req, "/settings/linkedin", { linkedin_error: "connect_failed" });
  }
}
