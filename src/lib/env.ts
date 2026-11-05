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

  // Cloudflare R2 (media storage) ------------------------------------------
  // R2 speaks the S3 protocol, so these are the only credentials needed — no
  // region picker, no Cloudflare-specific SDK.
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  /** Defaults to `zybble-post-media`; override to point at an existing bucket. */
  R2_BUCKET: z.string().min(1).max(63).default("zybble-post-media"),
  /**
   * Optional public base URL (an r2.dev subdomain, or a custom domain).
   *
   * When set, preview URLs are plain links under this origin instead of
   * presigned GETs. That is worth doing if you enable public read on the
   * bucket, since it lets the browser cache previews. Leave it unset to keep
   * the bucket private — previews then use short-lived signed URLs, exactly as
   * they did on Supabase Storage.
   */
  R2_PUBLIC_URL: optionalUrl,

  // Inngest -----------------------------------------------------------------
  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),
  /**
   * Force dev or cloud mode regardless of `NODE_ENV`.
   *
   * `.optional()` must come *after* `.transform()`. Written the other way
   * round, the transform still runs on an absent value and turns `undefined`
   * into `false`, which silently pins the SDK to cloud mode — where it refuses
   * every request unless a signing key is present. That is the difference
   * between a working dev server and an endpoint that answers 500.
   */
  INNGEST_DEV: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),

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
  EMAIL_FROM: z.string().default("Zybble <no-reply@zybble.com>"),
  EMAIL_REPLY_TO: z.string().optional(),
  // Destination inbox for the public contact form (delivered via Resend).
  CONTACT_FORM_TO: z.string().email().optional(),
  // Where transactional product links point (used by email templates).
  APP_URL: optionalUrl,

  // Security ----------------------------------------------------------------
  // 32-byte key, base64. Rotatable via TOKEN_ENCRYPTION_KEY_PREVIOUS.
  TOKEN_ENCRYPTION_KEY: z.string().optional(),
  TOKEN_ENCRYPTION_KEY_PREVIOUS: z.string().optional(),
  CRON_SECRET: z.string().optional(),

  // Platform administration -------------------------------------------------
  /**
   * Comma-separated Supabase Auth user UUIDs allowed to open `/admin`.
   *
   * This is the *only* thing that grants platform-admin access. Deliberately
   * not a database column, not `user_metadata` and not a workspace role:
   *
   *  - `user_metadata` is writable by the user it describes, so it can be
   *    edited by anyone holding their own access token;
   *  - a database column would let a compromised service-role key, or any
   *    future write path, promote an account;
   *  - a workspace role is a per-tenant concept and says nothing about who
   *    owns the platform.
   *
   * Left unset, it yields an empty allowlist and `/admin` denies everyone —
   * the fail-closed default. See `src/lib/admin/access.ts`.
   */
  ZYBBLE_ADMIN_USER_IDS: z.string().optional(),
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

/**
 * Media storage is Cloudflare R2, reached over its S3-compatible API.
 *
 * All four parts are required; a partial configuration is treated as
 * unconfigured rather than half-working, so a missing secret surfaces as a
 * clear "not configured" state instead of a signature error at upload time.
 */
export function isR2Configured(): boolean {
  const configuration = env();
  return Boolean(
    configuration.R2_ACCOUNT_ID &&
      configuration.R2_ACCESS_KEY_ID &&
      configuration.R2_SECRET_ACCESS_KEY,
  );
}

/** Human-readable reason R2 is unavailable, for admin-facing diagnostics. */
export function r2Blockers(): string[] {
  if (isR2Configured()) return [];

  const configuration = env();
  const missing = [
    !configuration.R2_ACCOUNT_ID ? "R2_ACCOUNT_ID" : null,
    !configuration.R2_ACCESS_KEY_ID ? "R2_ACCESS_KEY_ID" : null,
    !configuration.R2_SECRET_ACCESS_KEY ? "R2_SECRET_ACCESS_KEY" : null,
  ].filter((value): value is string => value !== null);

  return [`Media storage (Cloudflare R2) is not configured — missing ${missing.join(", ")}`];
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
