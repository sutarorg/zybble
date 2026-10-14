/**
 * Session refresh for the Next.js 16 proxy (formerly `middleware.ts`).
 *
 * The proxy verifies the access token with `getClaims()`, refreshes it when it
 * is about to expire, and copies the refreshed cookies onto both the outgoing
 * request (so Server Components see a valid session) and the response (so the
 * browser replaces its own copy).
 *
 * It must never *redirect* on auth state. Route protection happens where the
 * data is read, in the server layer.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServerClientForRequest } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export async function updateSession(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.next({ request });

  // Cookies written during `setAll` are collected here and re-attached below,
  // because the client object itself does not expose its cookie jar.
  const refreshed: Array<{ name: string; value: string; options?: Record<string, unknown> }> = [];

  const supabase = createServerClientForRequest(request, refreshed);

  // getUser() validates the access token against the Auth server — the cookie
  // itself is attacker-controlled and is never trusted on its own.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let response: NextResponse;
  if (!user && isProtectedPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    response = NextResponse.redirect(url);
  } else {
    response = NextResponse.next({ request });
  }

  // Re-attach every refreshed cookie so the browser replaces its own copy and
  // Server Components can read a valid session.
  for (const cookie of refreshed) {
    response.cookies.set(cookie.name, cookie.value, (cookie.options ?? {}) as never);
  }

  return response;
}

function isProtectedPath(pathname: string): boolean {
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/my-learning") ||
    pathname.startsWith("/orders") ||
    pathname.startsWith("/wishlist") ||
    pathname.startsWith("/messages") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/certificates") ||
    pathname.startsWith("/learn") ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/creator") ||
    pathname.startsWith("/admin")
  );
}
