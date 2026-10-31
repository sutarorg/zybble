import { z } from "zod";

/**
 * Environment access.
 *
 * Two rules keep this module honest:
 *  1. Nothing is read at module load time. `next build` must succeed on a
 *     machine with no secrets, so configuration is resolved lazily, per request.
 *  2. Every integration reports whether it is actually configured
 *     (`isConfigured`) instead of pretending to work. Capabilities in the UI are
 *     driven by that flag, never by optimistic assumptions.
 */

const optionalUrl = z.string().url().optional().or(z.literal("").transform(() => undefined));

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),

  // Supabase ----------------------------------------------------------------
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  // Legacy name still accepted: Supabase's older dashboards call it the anon key.
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_JWT_SECRET: z.string().optional(),
  // Direct Postgres connection, used by server jobs that need SQL (transactions).
  DATABASE_URL: z.string().optional(),

  // LinkedIn ----------------------------------------------------------------
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),
  LINKEDIN_REDIRECT_URI: optionalUrl,
  // Pinned LinkedIn API version (YYYYMM). See docs: Marketing versioning.
  LINKEDIN_API_VERSION: z.string().regex(/^\d{6}$/).default("202604"),
  /**
   * `r_member_postAnalytics` is only requestable once LinkedIn has approved the
   * Community Management API product. Requesting an unapproved scope aborts the
   * whole consent screen, so it stays opt-in until access is granted.
   */
  LINKEDIN_ANALYTICS_SCOPE_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),

  // Inngest -----------------------------------------------------------------
  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),
  INNGEST_DEV: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),

  // Dodo Payments -----------------------------------------------------------
  DODO_PAYMENTS_API_KEY: z.string().optional(),
  DODO_PAYMENTS_WEBHOOK_KEY: z.string().optional(),
  DODO_PAYMENTS_ENVIRONMENT: z.enum(["test_mode", "live_mode"]).default("test_mode"),
  DODO_PRO_PRODUCT_ID: z.string().optional(),
  DODO_PRO_SEAT_ADDON_ID: z.string().optional(),
  // Proration behaviour applied when the seat count changes.
  DODO_SEAT_PRORATION_MODE: z
    .enum([
      "prorated_immediately",
      "full_immediately",
      "difference_immediately",
      "do_not_bill",
      "prorated_immediately_keep_cycle",
    ])
    .default("difference_immediately"),

  // Resend ------------------------------------------------------------------
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Zybble <no-reply@zybble.app>"),
  EMAIL_REPLY_TO: z.string().optional(),
  // Where transactional product links point (used by email templates).
  APP_URL: optionalUrl,

  // Security ----------------------------------------------------------------
  // 32-byte key, base64. Rotatable via TOKEN_ENCRYPTION_KEY_PREVIOUS.
  TOKEN_ENCRYPTION_KEY: z.string().optional(),
  TOKEN_ENCRYPTION_KEY_PREVIOUS: z.string().optional(),
  CRON_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);

  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration — ${problems}`);
  }

  cached = parsed.data;
  return cached;
}

/** Test hook: drop the memoised configuration. */
export function resetEnvCache(): void {
  cached = null;
}

export function supabaseUrl(): string {
  const value = env().NEXT_PUBLIC_SUPABASE_URL;
  if (!value) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured");
  return value;
}

export function supabaseAnonKey(): string {
  const value =
    env().NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env().NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!value) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) is not configured",
    );
  }
  return value;
}

export function supabaseServiceRoleKey(): string {
  const value = env().SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  return value;
}

export function appUrl(): string {
  return env().APP_URL ?? env().NEXT_PUBLIC_SITE_URL;
}

/** True when the app can talk to Supabase at all. */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    env().NEXT_PUBLIC_SUPABASE_URL &&
      (env().NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env().NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
}

export function isSupabaseAdminConfigured(): boolean {
  return isSupabaseConfigured() && Boolean(env().SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * LinkedIn capability report.
 *
 * `publishing` needs a client id/secret plus the `w_member_social` scope, which
 * LinkedIn grants as soon as the "Share on LinkedIn" product is enabled.
 * `analytics` additionally needs the Community Management API product and the
 * `r_member_postAnalytics` scope — a separate approval we cannot assume.
 */
export function linkedinCapabilities() {
  const configuration = env();
  const configured = Boolean(
    configuration.LINKEDIN_CLIENT_ID &&
      configuration.LINKEDIN_CLIENT_SECRET &&
      configuration.LINKEDIN_REDIRECT_URI,
  );

  return {
    configured,
    publishing: configured,
    analytics: configured && configuration.LINKEDIN_ANALYTICS_SCOPE_ENABLED,
    apiVersion: configuration.LINKEDIN_API_VERSION,
    /** Scopes requested during the OAuth handshake. */
    scopes: [
      "openid",
      "profile",
      "email",
      "w_member_social",
      ...(configuration.LINKEDIN_ANALYTICS_SCOPE_ENABLED ? ["r_member_postAnalytics"] : []),
    ] as string[],
    /** Human-readable blocker shown when a capability is unavailable. */
    blockers: [
      ...(configured
        ? []
        : ["LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET and LINKEDIN_REDIRECT_URI are not set"]),
      ...(configured && !configuration.LINKEDIN_ANALYTICS_SCOPE_ENABLED
        ? [
            "r_member_postAnalytics is not enabled (LINKEDIN_ANALYTICS_SCOPE_ENABLED=false). " +
              "It requires LinkedIn Community Management API approval; requesting it without " +
              "approval breaks the consent screen for every scope.",
          ]
        : []),
    ] as string[],
  };
}

export function isDodoConfigured(): boolean {
  return Boolean(
    env().DODO_PAYMENTS_API_KEY &&
      env().DODO_PAYMENTS_WEBHOOK_KEY &&
      env().DODO_PRO_PRODUCT_ID,
  );
}

export function isResendConfigured(): boolean {
  return Boolean(env().RESEND_API_KEY);
}

/** Server-to-server endpoints (cron reconciliation) share this bearer secret. */
export function requireCronSecret(candidate: string | null | undefined): boolean {
  const expected = env().CRON_SECRET;
  if (!expected) return false;
  return typeof candidate === "string" && safeEqual(candidate, expected);
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return mismatch === 0;
}
