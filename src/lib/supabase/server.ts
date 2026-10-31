import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { IntegrationNotConfiguredError } from "@/lib/errors";
import { env, isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Server-side Supabase client bound to the caller's cookies.
 *
 * Every request gets a fresh client: sharing one across requests would leak
 * sessions between users. `getUser()` (not `getSession()`) is the only way this
 * codebase reads identity on the server — `getSession()` returns whatever is in
 * the cookie without verifying the signature.
 */
export async function createSupabaseServerClient(): Promise<
  SupabaseClient<Database, "public">
> {
  if (!isSupabaseConfigured()) {
    // A missing credential is a deployment fault, not a crash: answer 503 so
    // monitoring can separate "misconfigured" from "broken", and so clients
    // never receive a 500 that looks retryable.
    throw new IntegrationNotConfiguredError("Supabase");
  }

  const cookieStore = await cookies();

  return createServerClient<Database, "public">(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // src/proxy.ts refreshes the session on every request, so the write
          // is handled there and this can be safely ignored.
        }
      },
    },
    auth: {
      // Defensive: never persist a session in a shared server-side store.
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export type ServerSupabase = SupabaseClient<Database, "public">;

export async function serverUser() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

export function supabaseEnvStatus() {
  return {
    configured: isSupabaseConfigured(),
    url: isSupabaseConfigured() ? env().NEXT_PUBLIC_SUPABASE_URL : null,
  };
}
