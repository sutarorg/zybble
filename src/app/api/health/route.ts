import { NextResponse } from "next/server";
import { env, isDodoConfigured, isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/env";
import { capabilities as linkedinCapabilities } from "@/lib/linkedin/config";
import { canSendInngestEvents, isInngestServeConfigured } from "@/inngest/client";

/**
 * GET /api/health — deployment probe.
 *
 * Deliberately dependency-free: it never throws, and the only secret-adjacent
 * information it exposes is *whether* an integration is configured, never a
 * value. A 200 with `ok: false` means the app is up but an integration is not —
 * which is the honest signal during a staged rollout.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const configuration = env();

  const checks = {
    supabase: isSupabaseConfigured(),
    supabaseAdmin: isSupabaseAdminConfigured(),
    linkedin: linkedinCapabilities().configured,
    dodoPayments: isDodoConfigured(),
    resend: Boolean(configuration.RESEND_API_KEY),
    /**
     * Two separate capabilities, because they use two separate credentials.
     * The event key authorises outbound events; the signing key authorises
     * inbound requests to `/api/inngest`. Reporting only the event key let a
     * deployment look healthy while its serve endpoint answered 503 and
     * Inngest reported the URL as unreachable.
     */
    inngestEvents: canSendInngestEvents(),
    inngestServe: isInngestServeConfigured(),
    databaseUrl: Boolean(configuration.DATABASE_URL),
    tokenEncryption: Boolean(configuration.TOKEN_ENCRYPTION_KEY),
  };

  // Core = auth + app data. Everything else is a capability gate the UI
  // surfaces instead of pretending to work.
  const ok = checks.supabase && checks.tokenEncryption;

  return NextResponse.json(
    {
      ok,
      service: "zybble",
      environment: configuration.NODE_ENV,
      analyticsScopeEnabled: configuration.LINKEDIN_ANALYTICS_SCOPE_ENABLED,
      checks,
    },
    { status: 200, headers: { "cache-control": "no-store" } },
  );
}
