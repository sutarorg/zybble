import { defineRoute } from "@/lib/api/http";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/features/workspaces/access";
import { notificationPreferencesSchema } from "@/lib/validation/posts";

/**
 * /api/notifications/preferences
 *
 * Per-user email opt-outs, read before every send
 * (`src/features/notifications/email.ts`). Stored per user, not per workspace:
 * the same person in two workspaces keeps one set of preferences.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULTS = {
  email_post_published: true,
  email_post_failed: true,
  email_post_reminder: false,
  email_token_expiring: true,
  email_billing: true,
  email_product_updates: false,
  quiet_hours_start: null,
  quiet_hours_end: null,
};

export const GET = defineRoute(
  {
    auth: "required",
    rateLimit: { limit: 60, windowMs: 60_000 },
    scope: "notifications:preferences",
  },
  async ({ supabase }) => {
    const user = await requireUser(supabase);

    const { data } = await supabase!
      .from("notification_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    return { preferences: { ...DEFAULTS, ...((data as object | null) ?? {}) } };
  },
);

export const PATCH = defineRoute(
  {
    auth: "required",
    body: notificationPreferencesSchema,
    rateLimit: { limit: 30, windowMs: 60_000 },
    scope: "notifications:preferences-update",
  },
  async ({ supabase, body }) => {
    const user = await requireUser(supabase);

    const { data, error } = await supabase!
      .from("notification_preferences")
      .upsert({ user_id: user.id, ...body }, { onConflict: "user_id" })
      .select("*")
      .maybeSingle();

    if (error) throw new Error("Could not save your notification preferences.");

    return { preferences: data };
  },
);

/** Exported for tests that need the shipped defaults. */
export const DEFAULT_PREFERENCES = DEFAULTS;
export { createSupabaseServerClient };
