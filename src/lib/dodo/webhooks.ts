import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Dodo Payments webhook signature verification.
 *
 * Dodo follows the Standard Webhooks specification:
 *
 *   signed payload = `${webhook-id}.${webhook-timestamp}.${rawBody}`
 *   signature      = base64(HMAC-SHA256(secret, signed payload))
 *   header         = `webhook-signature: v1,<sig>[ v1,<rotated-sig>]`
 *
 * The secret is the base64 part *after* the `whsec_` prefix. Timestamps older
 * than five minutes are rejected, which bounds replay exposure.
 *
 * Notes that matter in production:
 *  * the **raw** body must be verified — re-serialising parsed JSON breaks the
 *    signature, which is why the route reads `await req.text()`;
 *  * comparison is constant-time;
 *  * the same verification runs in tests with a locally generated signature.
 */

export const WEBHOOK_TOLERANCE_SECONDS = 300;

export type WebhookHeaders = {
  id: string;
  timestamp: string;
  signature: string;
};

export class WebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookVerificationError";
  }
}

export function extractHeaders(headers: Headers): WebhookHeaders | null {
  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signature = headers.get("webhook-signature");

  if (!id || !timestamp || !signature) return null;

  return { id, timestamp, signature };
}

function secretBytes(webhookKey: string): Buffer {
  const raw = webhookKey.startsWith("whsec_") ? webhookKey.slice("whsec_".length) : webhookKey;
  return Buffer.from(raw, "base64");
}

/** Build the signature Dodo would send. Exported for tests and fixtures. */
export function signWebhook(input: {
  id: string;
  timestamp: string | number;
  body: string;
  secret: string;
}): string {
  const payload = `${input.id}.${input.timestamp}.${input.body}`;
  const digest = createHmac("sha256", secretBytes(input.secret)).update(payload).digest("base64");
  return `v1,${digest}`;
}

export function verifyWebhookSignature(input: {
  body: string;
  headers: WebhookHeaders;
  secret: string;
  now?: Date;
}): boolean {
  const timestampSeconds = Number(input.headers.timestamp);

  if (!Number.isFinite(timestampSeconds)) return false;

  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);

  if (Math.abs(nowSeconds - timestampSeconds) > WEBHOOK_TOLERANCE_SECONDS) {
    return false;
  }

  const expected = signWebhook({
    id: input.headers.id,
    timestamp: input.headers.timestamp,
    body: input.body,
    secret: input.secret,
  });

  const candidates = input.headers.signature
    .split(" ")
    .map((entry) => entry.trim())
    .filter((entry) => entry.startsWith("v1,"));

  if (candidates.length === 0) return false;

  const expectedBuffer = Buffer.from(expected, "utf8");

  return candidates.some((candidate) => {
    const candidateBuffer = Buffer.from(candidate, "utf8");
    if (candidateBuffer.length !== expectedBuffer.length) return false;
    return timingSafeEqual(candidateBuffer, expectedBuffer);
  });
}

/** Verify using the configured webhook key. Throws when it does not match. */
export function assertVerifiedWebhook(input: {
  body: string;
  headers: Headers;
  now?: Date;
}): { headers: WebhookHeaders; event: unknown } {
  const configuration = env();

  if (!configuration.DODO_PAYMENTS_WEBHOOK_KEY) {
    throw new WebhookVerificationError(
      "DODO_PAYMENTS_WEBHOOK_KEY is not configured; refusing to process an unverifiable webhook.",
    );
  }

  const headers = extractHeaders(input.headers);

  if (!headers) {
    throw new WebhookVerificationError("Missing webhook-id, webhook-timestamp or webhook-signature.");
  }

  const valid = verifyWebhookSignature({
    body: input.body,
    headers,
    secret: configuration.DODO_PAYMENTS_WEBHOOK_KEY,
    now: input.now,
  });

  if (!valid) {
    throw new WebhookVerificationError("Webhook signature verification failed.");
  }

  let event: unknown;
  try {
    event = JSON.parse(input.body);
  } catch {
    throw new WebhookVerificationError("Webhook body is not valid JSON.");
  }

  return { headers, event };
}
