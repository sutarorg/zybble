/**
 * Server-side enforcement of platform-admin access.
 *
 * `src/lib/admin/access.ts` answers "is this id an admin?" from configuration
 * alone. This module answers the harder question — "is the caller that id?" —
 * and is the single place `/admin` pages and `/api/admin/*` routes verify it.
 *
 * Identity comes from `supabase.auth.getUser()`, which validates the session
 * JWT with Supabase. `getSession()` is never used: it returns whatever the
 * cookie contains without verifying it, so a forged cookie would be enough.
 *
 * The order matters:
 *   1. verify identity (401 if absent),
 *   2. compare the *verified* id against the allowlist (403 if not listed).
 *
 * Every `/api/admin/*` route calls `requirePlatformAdmin()` itself rather than
 * relying on the proxy, so a direct request that somehow reaches the handler
 * is still checked. This module is server-only and must never be imported from
 * a `"use client"` file.
 */

import type { User } from "@supabase/supabase-js";
import { isPlatformAdmin } from "@/lib/admin/access";
import { isSupabaseConfigured } from "@/lib/env";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * The verified user, or null.
 *
 * Returns null (never throws) so callers can distinguish "no session" from
 * "misconfigured deployment" without exception control flow.
 */
export async function currentVerifiedUser(): Promise<User | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) return null;
  return data.user;
}

/**
 * Authorise an API request. Throws `UnauthenticatedError` (401) or
 * `ForbiddenError` (403), which `defineRoute` turns into the standard error
 * envelope.
 */
export async function requirePlatformAdmin(): Promise<User> {
  const user = await currentVerifiedUser();

  if (!user) {
    throw new UnauthenticatedError("Sign in to continue.");
  }

  if (!isPlatformAdmin(user.id)) {
    // Deliberately identical to the message a missing allowlist produces.
    // A non-admin learning that an allowlist exists, and is empty, is a small
    // disclosure; there is no reason to hand it over.
    throw new ForbiddenError("Platform administrator access is required.");
  }

  return user;
}

export type AdminPageGate =
  | { ok: true; user: User }
  | { ok: false; kind: "unauthenticated" | "forbidden" };

/**
 * Authorise a page render.
 *
 * Returns a result rather than redirecting, because the redirect target
 * (`/login?next=…`) is the layout's decision, not the guard's.
 */
export async function gateAdminPage(): Promise<AdminPageGate> {
  const user = await currentVerifiedUser();

  if (!user) return { ok: false, kind: "unauthenticated" };
  if (!isPlatformAdmin(user.id)) return { ok: false, kind: "forbidden" };

  return { ok: true, user };
}
