import { NextResponse } from "next/server";
import { processDodoWebhook } from "@/features/billing/webhooks";
import { logger } from "@/lib/logger";
import { WebhookVerificationError } from "@/lib/dodo/webhooks";

/**
 * POST /api/webhooks/dodo
 *
 * The only path that grants paid access. Requirements, in order:
 *  1. the Standard Webhooks signature is verified against the **raw** body
 *     before anything is parsed;
 *  2. the event id is claimed in `webhook_events` (primary key), so a replay is
 *     answered 200 without touching entitlements;
 *  3. the workspace is resolved from our own records (session metadata, then
 *     subscription/customer lookup) — never from a browser-supplied id.
 *
 * Responses are always 2xx for anything we intend to keep (duplicate/ignored) and
 * 5xx for transient failures, so Dodo retries those. A 401 for a bad signature
 * is intentional: it tells the provider the endpoint is misconfigured.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The signature is computed over the exact bytes sent.
export const fetchCache = "force-no-store";

export async function POST(request: Request): Promise<NextResponse> {
  // MUST be the raw text: re-serialising JSON would break verification.
  const body = await request.text();

  try {
    const result = await processDodoWebhook({ body, headers: request.headers });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      logger.error("billing.webhook_signature_invalid", { error: error.message });
      return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
    }

    logger.error("billing.webhook_error", {
      error: error instanceof Error ? error.message : "unknown",
    });

    // 500 so the provider retries; the claim row was rolled back in the handler.
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }
}
