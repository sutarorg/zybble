/**
 * Centralised, validated configuration for every external service Zybble uses.
 *
 * Rules enforced here:
 *  - Secrets are read without the `NEXT_PUBLIC_` prefix and are never returned
 *    to the browser. `serverEnv()` is the only accessor for secret values and it
 *    must only ever be called from server code (route handlers, server actions,
 *    server components).
 *  - Nothing here throws during module evaluation, because `next build` imports
 *    server modules while collecting page data in an environment that has no
 *    credentials at all. Validation is lazy and produces a structured report
 *    instead of a secret value, so `/api/health` can explain *which* service is
 *    unconfigured without leaking *what* the credential is.
 */

export type ServiceId =
  | "supabase"
  | "razorpay"
  | "payoutEncryption"
  | "bunny"
  | "r2"
  | "resend"
  | "openrouter"
  | "analytics"
  | "sentry";

export interface ServiceStatus {
  id: ServiceId;
  label: string;
  /** Every variable this service needs, by name only. */
  variables: string[];
  missing: string[];
  configured: boolean;
  /** Which capability is blocked when `configured` is false. */
  impact: string;
}

export const SERVICE_LABELS: Record<ServiceId, string> = {
  supabase: "Supabase (auth + Postgres)",
  razorpay: "Razorpay (Checkout)",
  payoutEncryption: "Creator Payout Destination Encryption (AES-256-GCM)",
  bunny: "Bunny Stream (video)",
  r2: "Cloudflare R2 (resources)",
  resend: "Resend (email)",
  openrouter: "OpenRouter (Zybble 2.0)",
  analytics: "Analytics (GA4 / PostHog)",
  sentry: "Sentry (error monitoring)",
};

/**
 * Every variable the application reads, grouped by the service that needs it.
 * `required` drives `/api/health` readiness reporting.
 */
const SERVICE_VARIABLES: Record<
  ServiceId,
  { variables: string[]; impact: string }
> = {
  supabase: {
    variables: [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
    ],
    impact: "Authentication and all persistent data are unavailable.",
  },
  razorpay: {
    variables: [
      "RAZORPAY_KEY_ID",
      "RAZORPAY_KEY_SECRET",
      "RAZORPAY_WEBHOOK_SECRET",
    ],
    impact: "Paid course checkout is disabled.",
  },
  payoutEncryption: {
    variables: ["PAYOUT_DETAILS_ENCRYPTION_KEY"],
    impact: "Saving or revealing creator bank/UPI payout destinations is disabled.",
  },
  bunny: {
    variables: ["BUNNY_STREAM_LIBRARY_ID", "BUNNY_STREAM_API_KEY", "BUNNY_STREAM_TOKEN_AUTH_KEY"],
    impact: "Course video upload and protected playback are disabled.",
  },
  r2: {
    variables: [
      "R2_ACCOUNT_ID",
      "R2_BUCKET_NAME",
      "R2_ACCESS_KEY_ID",
      "R2_SECRET_ACCESS_KEY",
    ],
    impact: "Downloadable resources and image uploads are disabled.",
  },
  resend: {
    variables: ["RESEND_API_KEY", "RESEND_FROM_EMAIL"],
    impact: "Transactional email is not delivered; business state still commits.",
  },
  openrouter: {
    variables: ["OPENROUTER_API_KEY"],
    impact: "Zybble 2.0 is unavailable and says so — it never guesses.",
  },
  analytics: {
    variables: ["NEXT_PUBLIC_GA_MEASUREMENT_ID", "NEXT_PUBLIC_POSTHOG_KEY"],
    impact: "Product analytics events are not collected.",
  },
  sentry: {
    variables: ["NEXT_PUBLIC_SENTRY_DSN"],
    impact: "Errors are logged to the server console instead of Sentry.",
  },
};

function read(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

/* -------------------------------------------------------------------------- */
/* Public (browser-safe) configuration                                          */
/* -------------------------------------------------------------------------- */

/** Values that are safe to embed in the client bundle. */
export const publicEnv = {
  supabaseUrl: read("NEXT_PUBLIC_SUPABASE_URL"),
  supabasePublishableKey: read("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  razorpayKeyId: read("RAZORPAY_KEY_ID"),
  gaMeasurementId: read("NEXT_PUBLIC_GA_MEASUREMENT_ID"),
  posthogKey: read("NEXT_PUBLIC_POSTHOG_KEY"),
  posthogHost: read("NEXT_PUBLIC_POSTHOG_HOST") ?? "https://eu.i.posthog.com",
  sentryDsn: read("NEXT_PUBLIC_SENTRY_DSN"),
  siteUrl: read("NEXT_PUBLIC_SITE_URL") ?? read("SITE_URL"),
};

/** Canonical application origin, without a trailing slash. */
export function siteOrigin(): string {
  const raw = publicEnv.siteUrl ?? `http://localhost:${process.env.PORT ?? "3000"}`;
  return raw.replace(/\/+$/, "");
}

/* -------------------------------------------------------------------------- */
/* Server-only configuration                                                   */
/* -------------------------------------------------------------------------- */

export const serverEnv = {
  supabaseUrl: publicEnv.supabaseUrl,
  supabasePublishableKey: publicEnv.supabasePublishableKey,
  supabaseServiceRoleKey: read("SUPABASE_SERVICE_ROLE_KEY"),
  razorpayKeyId: read("RAZORPAY_KEY_ID"),
  razorpayKeySecret: read("RAZORPAY_KEY_SECRET"),
  razorpayWebhookSecret: read("RAZORPAY_WEBHOOK_SECRET"),
  get payoutDetailsEncryptionKey() {
    return read("PAYOUT_DETAILS_ENCRYPTION_KEY");
  },
  bunnyLibraryId: read("BUNNY_STREAM_LIBRARY_ID"),
  bunnyApiKey: read("BUNNY_STREAM_API_KEY"),
  bunnyTokenAuthKey: read("BUNNY_STREAM_TOKEN_AUTH_KEY"),
  r2AccountId: read("R2_ACCOUNT_ID"),
  r2Bucket: read("R2_BUCKET_NAME"),
  r2AccessKeyId: read("R2_ACCESS_KEY_ID"),
  r2SecretAccessKey: read("R2_SECRET_ACCESS_KEY"),
  r2Endpoint: read("R2_S3_ENDPOINT") ?? accountEndpoint(),
  resendApiKey: read("RESEND_API_KEY"),
  resendFromEmail: read("RESEND_FROM_EMAIL"),
  openrouterApiKey: read("OPENROUTER_API_KEY"),
  // DeepSeek is Zybble 2.0's model. Override with `OPENROUTER_MODEL` for any
  // other OpenRouter slug (e.g. `deepseek/deepseek-chat-v3.1`).
  openrouterModel: read("OPENROUTER_MODEL") ?? "deepseek/deepseek-chat",
  openrouterSiteUrl: read("OPENROUTER_SITE_URL") ?? publicEnv.siteUrl,
  openrouterAppName: read("OPENROUTER_APP_NAME") ?? "Zybble",
};

function accountEndpoint(): string | undefined {
  const account = read("R2_ACCOUNT_ID");
  return account ? `https://${account}.r2.cloudflarestorage.com` : undefined;
}

/* -------------------------------------------------------------------------- */
/* Capability helpers                                                          */
/* -------------------------------------------------------------------------- */

export const isSupabaseConfigured = () =>
  Boolean(serverEnv.supabaseUrl && serverEnv.supabasePublishableKey);

/** True when the service-role key is present, which unlocks trusted server writes. */
export const isServiceRoleConfigured = () => Boolean(serverEnv.supabaseServiceRoleKey);

export const isRazorpayConfigured = () =>
  Boolean(serverEnv.razorpayKeyId && serverEnv.razorpayKeySecret);

export const isPayoutEncryptionConfigured = () =>
  Boolean(serverEnv.payoutDetailsEncryptionKey);

export const isBunnyConfigured = () =>
  Boolean(serverEnv.bunnyLibraryId && serverEnv.bunnyApiKey);

export const isR2Configured = () =>
  Boolean(
    serverEnv.r2Endpoint &&
      serverEnv.r2Bucket &&
      serverEnv.r2AccessKeyId &&
      serverEnv.r2SecretAccessKey
  );

export const isResendConfigured = () => Boolean(serverEnv.resendApiKey && serverEnv.resendFromEmail);

export const isOpenRouterConfigured = () => Boolean(serverEnv.openrouterApiKey);

/* -------------------------------------------------------------------------- */
/* Readiness report                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Returns a readiness report describing which services are configured.
 * Only variable *names* are surfaced — never values, never partial values.
 */
export function configurationReport(): {
  ok: boolean;
  services: ServiceStatus[];
  missingServices: ServiceId[];
} {
  const services = (Object.keys(SERVICE_VARIABLES) as ServiceId[]).map((id) => {
    const { variables, impact } = SERVICE_VARIABLES[id];
    const missing = variables.filter((name) => !read(name));
    return {
      id,
      label: SERVICE_LABELS[id],
      variables,
      missing,
      configured: missing.length === 0,
      impact,
    };
  });

  // Only Supabase is load-bearing for the app to serve at all. Everything else
  // degrades to an honest "unavailable" state and is reported as blocked.
  const missingServices = services
    .filter((s) => !s.configured && s.id !== "analytics" && s.id !== "sentry")
    .map((s) => s.id);

  return { ok: missingServices.length === 0, services, missingServices };
}
