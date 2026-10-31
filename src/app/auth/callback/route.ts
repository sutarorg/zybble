import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/**
 * GET /auth/callback — Supabase email link handler.
 *
 * Handles both flows Supabase supports for links:
 *  - `?code=…`  — PKCE exchange (email confirmation, magic link, recovery),
 *  - `?token_hash=…&type=…` — legacy template format.
 *
 * A recovery link is redirected to the password form; everything else lands on
 * the dashboard. Failures redirect to /login with a reason instead of rendering
 * a stack trace.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirect(req: NextRequest, path: string, params: Record<string, string> = {}) {
  const url = req.nextUrl.clone();
  url.pathname = path;
  url.search = "";
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const tokenHash = req.nextUrl.searchParams.get("token_hash");
  const type = req.nextUrl.searchParams.get("type");
  const next = req.nextUrl.searchParams.get("next");

  if (!code && !tokenHash) {
    return redirect(req, "/login", { error: "invalid_link" });
  }

  try {
    const supabase = await createSupabaseServerClient();

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        logger.warn("auth.callback_exchange_failed", { error: error.message });
        return redirect(req, "/login", { error: "link_expired" });
      }

      // Supabase does not tell us the flow type on the code path; the query
      // parameter it appends to `next` does.
      const isRecovery = (next ?? "").includes("type=recovery") || type === "recovery";

      return redirect(req, isRecovery ? "/reset-password" : "/dashboard");
    }

    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash as string,
      type: (type as "email" | "recovery" | "invite" | "magiclink" | "email_change") ?? "email",
    });

    if (error) {
      logger.warn("auth.callback_verify_failed", { error: error.message });
      return redirect(req, "/login", { error: "link_expired" });
    }

    return redirect(req, type === "recovery" ? "/reset-password" : "/dashboard");
  } catch (error) {
    logger.error("auth.callback_failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return redirect(req, "/login", { error: "auth_unavailable" });
  }
}
