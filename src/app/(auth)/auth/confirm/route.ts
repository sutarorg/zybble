import { redirect } from "next/navigation";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, siteOrigin } from "@/lib/env";
import type { EmailOtpType } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/** Verification types this route will redeem. Anything else is rejected. */
const TOKEN_TYPES: EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

/**
 * OAuth / email-confirmation landing route.
 *
 * Two shapes arrive here:
 *
 *   - `?code=`     — the PKCE flow (OAuth, and Supabase's own confirmation
 *                    email when the project SMTP is configured).
 *   - `?token_hash=&type=` — a link Zybble emailed itself, generated with the
 *                    service role because a fresh project has no SMTP to send
 *                    Supabase's own confirmation email.
 *
 * Both are redeemed in a route handler, where cookies are writable, which is
 * what actually completes verification and signs the learner in.
 *
 * The `next` parameter is restricted to same-origin relative paths, so this
 * endpoint cannot be used as an open redirect.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const rawType = url.searchParams.get("type");
  const next = url.searchParams.get("next");

  if (!isSupabaseConfigured()) {
    return noticePage("Authentication is not configured yet.");
  }

  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  if (tokenHash) {
    const type = TOKEN_TYPES.find((candidate) => candidate === rawType);
    if (!type) return noticePage("This link is invalid or has expired. Request a new one.");

    const supabase = await createServerClient();
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error || !data.user) {
      return noticePage("This link is invalid or has expired. Request a new one.");
    }

    await markEmailVerified(data.user.id);
    redirect(new URL(safeNext, siteOrigin()).toString());
  }

  if (!code) {
    return noticePage("This link is invalid or has expired. Request a new one.");
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return noticePage("This link is invalid or has expired. Request a new one.");
  }

  if (data.user) await markEmailVerified(data.user.id);
  redirect(new URL(safeNext, siteOrigin()).toString());
}

/**
 * Keeps `profiles.email_verified` in step with what Supabase now knows.
 *
 * Redeeming a token proves control of the address, so the flag is set here
 * rather than waiting on a trigger that may or may not fire for this flow. It is
 * idempotent, and a failure is logged rather than thrown: the learner is already
 * verified in the auth system, which is what gates their access.
 */
async function markEmailVerified(userId: string) {
  const service = createServiceClient();
  if (!service) return;

  const { data: authUser } = await service.auth.admin.getUserById(userId);
  if (authUser?.user && !authUser.user.email_confirmed_at) {
    // A magic-link token proves ownership of the address even where GoTrue does
    // not mark the signup confirmed on its own.
    await service.auth.admin.updateUserById(userId, { email_confirm: true });
  }

  const { error } = await service.from("profiles").update({ email_verified: true }).eq("id", userId);
  if (error) {
    console.error("[auth-confirm] could not record the verified email", {
      user: userId,
      reason: error.message.slice(0, 200),
    });
  }
}

function noticePage(message: string) {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Zybble</title>
     <meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"></head>
     <body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#fafafa;color:#18181b">
     <main style="max-width:420px;padding:32px;text-align:center">
       <h1 style="font-size:19px;margin:0 0 8px">We couldn't complete that</h1>
       <p style="color:#52525b;font-size:14px;margin:0 0 20px">${message}</p>
       <a href="/dashboard" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;padding:10px 16px;border-radius:9px;font-size:14px">Go to dashboard</a>
     </main></body></html>`,
    { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
