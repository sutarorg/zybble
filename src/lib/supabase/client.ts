/**
 * Browser Supabase client.
 *
 * Only the *publishable* key is ever referenced here, so nothing secret can be
 * pulled into the client bundle even by accident.
 */

import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

export function createClient() {
  const url = publicEnv.supabaseUrl ?? "";
  const key = publicEnv.supabasePublishableKey ?? "";
  return createBrowserClient(url, key);
}
