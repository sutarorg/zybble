import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseAdminConfigured, supabaseServiceRoleKey, supabaseUrl } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Service-role client. SERVER ONLY.
 *
 * This client bypasses Row Level Security, so it is used exclusively for:
 *  * verified webhook processing (Dodo),
 *  * Inngest background jobs,
 *  * reading OAuth credentials that no browser may ever see.
 *
 * Every call site is expected to perform its own authorisation and to write an
 * audit_logs row. Nothing in `src/app`, `src/components` or any file marked
 * "use client" may import this module.
 */
let cached: SupabaseClient<Database, "public"> | null = null;

export function createSupabaseAdminClient(): SupabaseClient<Database, "public"> {
  if (!isSupabaseAdminConfigured()) {
    throw new Error(
      "Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  if (!cached) {
    cached = createClient<Database, "public">(supabaseUrl(), supabaseServiceRoleKey(), {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          "x-application-name": "zybble-server",
        },
      },
    });
  }

  return cached;
}

export type AdminSupabase = SupabaseClient<Database, "public">;
