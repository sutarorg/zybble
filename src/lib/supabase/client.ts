"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Browser client.
 *
 * Only the publishable/anon key is used here — the service-role key is never
 * imported into a client bundle (see src/lib/supabase/admin.ts, which is
 * server-only). All data access through this client is subject to RLS.
 */
let client: SupabaseClient<Database, "public"> | null = null;

export function createSupabaseBrowserClient(): SupabaseClient<Database, "public"> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase browser client requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  if (!client) {
    client = createBrowserClient<Database, "public">(url, key);
  }

  return client;
}
