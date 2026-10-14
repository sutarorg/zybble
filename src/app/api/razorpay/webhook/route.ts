import { serverEnv } from "@/lib/env";
import { handleRazorpayWebhook, CheckoutError } from "@/lib/server/checkout";
import { verifyWebhookSignature, type RazorpayWebhookPayload } from "@/lib/server/razorpay";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Razorpay webhook receiver.
 *
 * Contract:
 *  - The signature is checked against the **exact raw body**. The body is read
 *    as text before any parsing, because parsing and re-serialising changes the
 *    bytes and breaks the HMAC.
 *  - `x-razorpay-event-id` gives us provider-side deduplication; the unique
 *    index on `webhook_events` is the real guarantee.
 *  - 2xx only when the event was durably recorded, so Razorpay retries
 *    retryable failures. Events we deliberately ignore still return 200.
 */
export async function POST(request: Request) {
  if (!serverEnv.razorpayWebhookSecret) {
    return Response.json({ error: "webhook secret not configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!verifyWebhookSignature(rawBody, signature, serverEnv.razorpayWebhookSecret)) {
    // No detail: a caller must not learn whether the secret exists.
    return Response.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: RazorpayWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as RazorpayWebhookPayload;
  } catch {
    return Response.json({ error: "invalid payload" }, { status: 400 });
  }

  if (!payload || typeof payload.event !== "string") {
    return Response.json({ error: "missing event" }, { status: 400 });
  }

  const eventId = request.headers.get("x-razorpay-event-id");

  try {
    const outcome = await handleRazorpayWebhook(payload, eventId, rawBody);
    return Response.json(outcome, { status: 200 });
  } catch (error) {
    const status = error instanceof CheckoutError ? error.status : 500;
    // Log the event type only — never the payload, which contains PII.
    console.error("[razorpay-webhook] failed", {
      event: payload.event,
      eventId,
      reason: error instanceof Error ? error.message.slice(0, 200) : "unknown",
    });
    return Response.json({ error: "processing failed" }, { status: status >= 500 ? 500 : status });
  }
}

/** Razorpay's webhook verification GET probe. */
export async function GET() {
  return Response.json({ ok: true, service: "razorpay-webhook" });
}
