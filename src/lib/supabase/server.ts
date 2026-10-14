/**
 * Server Supabase clients.
 *
 * `createServerClient()` carries the signed-in user's cookies and is subject to
 * Row Level Security. It is the client used for anything that acts *as* a user.
 *
 * `createServiceClient()` uses the service-role key and therefore **bypasses
 * RLS**. It is only for trusted server work that already performed its own
 * authorisation check — payment webhooks, cron reconciliation, admin mutations
 * that have just verified an admin role. It must never be imported by a client
 * component.
 */

import { createServerClient as createSSRServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { serverEnv } from "@/lib/env";

/** Request-scoped client that respects RLS for the current session. */
export async function createServerClient() {
  const cookieStore = await cookies();
  return createSSRServerClient(
    serverEnv.supabaseUrl ?? "",
    serverEnv.supabasePublishableKey ?? "",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component, which cannot mutate cookies. The
            // proxy refreshes the session and writes the new cookies there.
          }
        },
      },
    }
  );
}

/**
 * Request-scoped client that records refreshed cookies into `sink`.
 *
 * The proxy needs to read what the client wrote in order to copy it onto the
 * outgoing response, so the sink is a plain array rather than the response
 * object itself.
 */
export function createServerClientForRequest(
  request: NextRequest,
  sink: Array<{ name: string; value: string; options?: Record<string, unknown> }>
) {
  return createSSRServerClient(
    serverEnv.supabaseUrl ?? "",
    serverEnv.supabasePublishableKey ?? "",
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            request.cookies.set(name, value);
            sink.push({ name, value, options: options as unknown as Record<string, unknown> });
          }
        },
      },
    }
  );
}

/**
 * Service-role client. Bypasses RLS — the caller must have already authorised
 * the operation. Returns `null` when the key is not configured so callers can
 * fail loudly instead of silently degrading.
 */
export function createServiceClient() {
  if (!serverEnv.supabaseServiceRoleKey || !serverEnv.supabaseUrl) return null;
  return createSupabaseClient(serverEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export type ServiceClient = NonNullable<ReturnType<typeof createServiceClient>>;
