/**
 * Integration health for the admin dashboard.
 *
 * This reports *configuration state only*. Not one field here is derived from
 * a secret, and none of them contains a value: `detail` is a human sentence
 * naming which variables are missing, never the variables' contents.
 *
 * It deliberately reuses the same predicates that gate the features at
 * runtime (`linkedinCapabilities()`, `isR2Configured()`, …) rather than
 * re-deriving them, so the dashboard cannot disagree with the app about
 * whether something works.
 */

import { canSendInngestEvents, isInngestServeConfigured } from "@/inngest/client";
import {
  env,
  isDodoConfigured,
  isR2Configured,
  isResendConfigured,
  isSupabaseAdminConfigured,
  isSupabaseConfigured,
  linkedinCapabilities,
  r2Blockers,
} from "@/lib/env";
import type { IntegrationHealth } from "./types";

export function integrationHealth(): IntegrationHealth[] {
  const configuration = env();
  const linkedin = linkedinCapabilities();

  const ready = (label: string, detail: string): IntegrationHealth => ({
    label,
    state: "ready",
    detail,
  });
  const off = (label: string, detail: string): IntegrationHealth => ({
    label,
    state: "not_configured",
    detail,
  });

  return [
    isSupabaseConfigured()
      ? ready(
          "Supabase",
          isSupabaseAdminConfigured()
            ? "Auth and database configured, service-role key present."
            : "Auth and database configured; service-role key missing, so background jobs cannot run.",
        )
      : off("Supabase", "NEXT_PUBLIC_SUPABASE_URL and the publishable key are not set."),

    configuration.DATABASE_URL
      ? ready("Postgres (direct)", "DATABASE_URL is set, so transactional paths are available.")
      : off(
          "Postgres (direct)",
          "DATABASE_URL is not set. Webhook claiming and publish claiming cannot run atomically.",
        ),

    linkedin.configured
      ? ready(
          "LinkedIn",
          linkedin.analytics
            ? `Publishing and analytics scopes enabled (API ${linkedin.apiVersion}).`
            : `Publishing enabled (API ${linkedin.apiVersion}); analytics scope not requested.`,
        )
      : off(
          "LinkedIn",
          "LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET or LINKEDIN_REDIRECT_URI is missing.",
        ),

    isR2Configured()
      ? ready("Cloudflare R2", "Media storage configured.")
      : off("Cloudflare R2", r2Blockers()[0] ?? "Media storage is not configured."),

    canSendInngestEvents() && isInngestServeConfigured()
      ? ready("Inngest", "Events can be sent and the serve endpoint can verify requests.")
      : off(
          "Inngest",
          !canSendInngestEvents()
            ? "INNGEST_EVENT_KEY is missing, so no scheduled jobs can be dispatched."
            : "INNGEST_SIGNING_KEY is missing, so /api/inngest cannot accept requests.",
        ),

    isDodoConfigured()
      ? ready(
          "Dodo Payments",
          `Checkout and webhooks configured (${configuration.DODO_PAYMENTS_ENVIRONMENT}).`,
        )
      : off(
          "Dodo Payments",
          "DODO_PAYMENTS_API_KEY, DODO_PAYMENTS_WEBHOOK_KEY or DODO_PRO_PRODUCT_ID is missing.",
        ),

    isResendConfigured()
      ? ready("Resend", "Transactional email configured.")
      : off("Resend", "RESEND_API_KEY is not set, so no email is delivered."),
  ];
}

/**
 * LinkedIn capability split, which the overview surfaces separately because
 * publishing and analytics are approved by LinkedIn as different products.
 */
export function linkedinCapabilityHealth(): IntegrationHealth[] {
  const linkedin = linkedinCapabilities();

  return [
    {
      label: "LinkedIn publishing",
      state: linkedin.publishing ? "ready" : "not_configured",
      detail: linkedin.publishing
        ? `w_member_social is requested (API ${linkedin.apiVersion}).`
        : "Publishing requires LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET and LINKEDIN_REDIRECT_URI.",
    },
    {
      label: "LinkedIn analytics",
      state: linkedin.analytics ? "ready" : "not_configured",
      detail: linkedin.analytics
        ? "r_member_postAnalytics is requested."
        : (linkedin.blockers[0] ??
          "r_member_postAnalytics is not enabled; it needs LinkedIn Community Management API approval."),
    },
  ];
}
