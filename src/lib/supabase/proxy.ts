import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isPlatformAdmin } from "@/lib/admin/access";
import { forbiddenResponse } from "@/lib/admin/forbidden-page";
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "@/lib/env";

/**
 * Session refresh + coarse route protection for Next.js 16 (`proxy.ts`).
 *
 * Two jobs:
 *  1. Refresh the Supabase session on every request. Access tokens live one
 *     hour; without this the cookie silently goes stale and users appear to be
 *     logged out at random. `getUser()` is what triggers the refresh — it
 *     validates the JWT with Supabase rather than trusting the cookie.
 *  2. Redirect anonymous visitors away from `/app` routes before any render
 *     work happens. This is a UX guard only; every server component and API
 *     route re-checks identity itself.
 *
 * Inline comments follow the documented @supabase/ssr pattern: request cookies
 * must be copied onto the response, and `NextResponse.next({ request })` has to
 * be re-created *after* the cookies are updated so the downstream render sees
 * the refreshed session.
 */

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/posts",
  "/calendar",
  "/analytics",
  "/settings",
  "/onboarding",
];
const AUTH_ROUTES = ["/login", "/signup", "/forgot-password", "/reset-password"];

/**
 * The platform-admin surface. Kept out of `PROTECTED_PREFIXES` because it
 * needs a different outcome: an ordinary protected path redirects anonymous
 * visitors to /login, but `/admin` must additionally reject *signed-in*
 * non-admins with a real 403 rather than redirecting them somewhere they are
 * allowed to be.
 */
const ADMIN_PREFIX = "/admin";

function isAdminPath(pathname: string): boolean {
  return pathname === ADMIN_PREFIX || pathname.startsWith(`${ADMIN_PREFIX}/`);
}

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

/** Paths that must never be intercepted (assets, health, webhooks, jobs). */
function isExempt(pathname: string): boolean {
  return (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|txt|xml|webmanifest)$/.test(pathname)
  );
}

function safeRedirect(request: NextRequest, target: string, searchParams: Record<string, string> = {}): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = target;
  url.search = "";
  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url);
}

/**
 * Only same-origin, absolute-path redirects are ever emitted, so a crafted
 * `?next=` value cannot turn the login flow into an open redirect.
 */
function safeRelativePath(value: string): string {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  // When Supabase is not configured, fail open on public routes and closed on
  // protected ones with a clear redirect to /login instead of a 500 loop.
  if (!isSupabaseConfigured()) {
    if (isAdminPath(request.nextUrl.pathname)) {
      // No auth means no verified identity, so there is nobody who could be
      // an admin. Deny rather than redirect: a redirect here would send an
      // unauthenticated visitor to a login page that cannot work either.
      return forbiddenResponse();
    }

    if (isProtected(request.nextUrl.pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("error", "auth_unavailable");
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        supabaseResponse = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (isExempt(pathname)) {
    return supabaseResponse;
  }

  /**
   * Admin gate, checked before the generic protection below.
   *
   * This is the only place a page request can be answered with a true 403 —
   * a Server Component that renders a "denied" panel would still return 200.
   * `/admin`'s own layout re-checks independently, so the page tree is safe
   * even if this rule is ever removed, but the status code lives here.
   */
  if (isAdminPath(pathname)) {
    if (!user) {
      return safeRedirect(request, "/login", { next: safeRelativePath(pathname) });
    }

    if (!isPlatformAdmin(user.id)) {
      return forbiddenResponse();
    }

    return supabaseResponse;
  }

  if (!user && isProtected(pathname)) {
    return safeRedirect(request, "/login", { next: safeRelativePath(pathname) });
  }

  if (user && isAuthRoute(pathname)) {
    return safeRedirect(request, "/dashboard");
  }

  return supabaseResponse;
}
