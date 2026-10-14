import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, siteOrigin } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * OAuth / email-confirmation landing route.
 *
 * Supabase hands back a `code` query parameter for the PKCE flow. Exchanging it
 * here — in a route handler, where cookies are writable — is what completes
 * email verification and OAuth account linkage.
 *
 * The `next` parameter is restricted to same-origin relative paths, so this
 * endpoint cannot be used as an open redirect.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");

  if (!isSupabaseConfigured()) {
    return noticePage("Authentication is not configured yet.");
  }

  if (!code) {
    return noticePage("This link is invalid or has expired. Request a new one.");
  }

  const supabase = await createServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return noticePage("This link is invalid or has expired. Request a new one.");
  }

  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  redirect(new URL(safeNext, siteOrigin()).toString());
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
