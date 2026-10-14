import { configurationReport } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Health / readiness probe.
 *
 * Distinguishes three failure classes so an operator (and the deploy platform)
 * can tell them apart without any secret ever appearing in the response:
 *   - `not_configured` — an environment variable is missing. Retrying will not help.
 *   - `unavailable`     — a dependency is temporarily unreachable. Retrying may help.
 *   - `ok`              — everything required to serve traffic is present and the
 *                         database answered.
 *
 * Only variable *names* are reported. Values, partial values, stack traces and
 * driver messages are never returned.
 */
export async function GET() {
  const report = configurationReport();
  const services = report.services.map((service) => ({
    id: service.id,
    label: service.label,
    configured: service.configured,
    missing: service.missing,
    impact: service.impact,
  }));

  if (!report.ok) {
    return Response.json(
      {
        ok: false,
        status: "not_configured",
        missingServices: report.missingServices,
        services,
      },
      { status: 503 }
    );
  }

  // A missing service-role key is a degraded mode, not a hard failure: reads
  // still work through RLS, but writes and webhooks do not.
  const client = createServiceClient();
  if (!client) {
    return Response.json(
      {
        ok: false,
        status: "degraded",
        reason: "server_credentials_unavailable",
        services,
      },
      { status: 503 }
    );
  }

  const startedAt = Date.now();
  try {
    const { error } = await client.rpc("assert_inr");
    if (error) throw new Error("database probe failed");

    return Response.json(
      {
        ok: true,
        status: "ok",
        latencyMs: Date.now() - startedAt,
        services,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return Response.json(
      {
        ok: false,
        status: "unavailable",
        reason: "database_unreachable",
        services,
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
