import { afterEach, describe, expect, it } from "vitest";
import {
  assertVerifiedWebhook,
  extractHeaders,
  signWebhook,
  verifyWebhookSignature,
  WebhookVerificationError,
  WEBHOOK_TOLERANCE_SECONDS,
} from "@/lib/dodo/webhooks";
import { resetEnvCache } from "@/lib/env";

/**
 * Dodo Payments webhook signature verification.
 *
 * Standard Webhooks: HMAC-SHA256 over `${id}.${timestamp}.${rawBody}` with the
 * secret after its `whsec_` prefix, base64-encoded and compared in constant
 * time, with a tolerance window against replay.
 */

const SECRET = "whsec_" + Buffer.from("test-webhook-secret").toString("base64").replace(/=+$/, "");
const NOW = new Date("2026-05-01T12:00:00.000Z");
const BODY = JSON.stringify({ type: "subscription.active", data: { subscription_id: "sub_1" } });

function sign(id: string, timestampSeconds: number, body: string, secret = SECRET): string {
  return signWebhook({ id, timestamp: timestampSeconds, body, secret });
}

function headers(input: {
  id?: string;
  timestampSeconds?: number;
  signature?: string | null;
  body?: string;
}): Headers {
  const id = input.id ?? "evt_test_1";
  const timestampSeconds = input.timestampSeconds ?? Math.floor(NOW.getTime() / 1000);
  const body = input.body ?? BODY;
  const signature = input.signature === null ? null : (input.signature ?? sign(id, timestampSeconds, body));

  const map = new Headers();
  map.set("webhook-id", id);
  map.set("webhook-timestamp", String(timestampSeconds));
  if (signature !== null) map.set("webhook-signature", signature);
  return map;
}

function withSecret(secret: string | undefined) {
  if (secret === undefined) delete process.env.DODO_PAYMENTS_WEBHOOK_KEY;
  else process.env.DODO_PAYMENTS_WEBHOOK_KEY = secret;
  resetEnvCache();
}

afterEach(() => {
  delete process.env.DODO_PAYMENTS_WEBHOOK_KEY;
  resetEnvCache();
});

describe("verifyWebhookSignature", () => {
  it("accepts a correctly signed payload", () => {
    const result = verifyWebhookSignature({
      body: BODY,
      headers: {
        id: "evt_test_1",
        timestamp: String(Math.floor(NOW.getTime() / 1000)),
        signature: sign("evt_test_1", Math.floor(NOW.getTime() / 1000), BODY),
      },
      secret: SECRET,
      now: NOW,
    });

    expect(result).toBe(true);
  });

  it("accepts a timestamp inside the tolerance window", () => {
    const timestamp = Math.floor(NOW.getTime() / 1000) - 60;

    expect(
      verifyWebhookSignature({
        body: BODY,
        headers: { id: "evt", timestamp: String(timestamp), signature: sign("evt", timestamp, BODY) },
        secret: SECRET,
        now: NOW,
      }),
    ).toBe(true);
  });

  it("rejects a payload older than the tolerance window", () => {
    const timestamp = Math.floor(NOW.getTime() / 1000) - (WEBHOOK_TOLERANCE_SECONDS + 10);

    expect(
      verifyWebhookSignature({
        body: BODY,
        headers: { id: "evt", timestamp: String(timestamp), signature: sign("evt", timestamp, BODY) },
        secret: SECRET,
        now: NOW,
      }),
    ).toBe(false);
  });

  it("rejects a tampered body", () => {
    const timestamp = Math.floor(NOW.getTime() / 1000);

    expect(
      verifyWebhookSignature({
        body: BODY.replace("sub_1", "sub_2"),
        headers: { id: "evt", timestamp: String(timestamp), signature: sign("evt", timestamp, BODY) },
        secret: SECRET,
        now: NOW,
      }),
    ).toBe(false);
  });

  it("rejects a signature made with a different secret", () => {
    const timestamp = Math.floor(NOW.getTime() / 1000);
    const other = "whsec_" + Buffer.from("someone-elses-secret").toString("base64").replace(/=+$/, "");

    expect(
      verifyWebhookSignature({
        body: BODY,
        headers: { id: "evt", timestamp: String(timestamp), signature: sign("evt", timestamp, BODY, other) },
        secret: SECRET,
        now: NOW,
      }),
    ).toBe(false);
  });

  it("supports multiple candidates in the header (key rotation)", () => {
    const timestamp = Math.floor(NOW.getTime() / 1000);
    const stale = "whsec_" + Buffer.from("previous-secret").toString("base64").replace(/=+$/, "");

    expect(
      verifyWebhookSignature({
        body: BODY,
        headers: {
          id: "evt",
          timestamp: String(timestamp),
          signature: `${sign("evt", timestamp, BODY, stale)} ${sign("evt", timestamp, BODY)}`,
        },
        secret: SECRET,
        now: NOW,
      }),
    ).toBe(true);
  });

  it("rejects a truncated signature without comparing short", () => {
    const timestamp = Math.floor(NOW.getTime() / 1000);

    expect(
      verifyWebhookSignature({
        body: BODY,
        headers: {
          id: "evt",
          timestamp: String(timestamp),
          signature: sign("evt", timestamp, BODY).slice(0, 8),
        },
        secret: SECRET,
        now: NOW,
      }),
    ).toBe(false);
  });

  it("ignores non-v1 candidates", () => {
    const timestamp = Math.floor(NOW.getTime() / 1000);

    expect(
      verifyWebhookSignature({
        body: BODY,
        headers: {
          id: "evt",
          timestamp: String(timestamp),
          signature: "v2,not-a-thing",
        },
        secret: SECRET,
        now: NOW,
      }),
    ).toBe(false);
  });

  it("works when the secret is stored without the whsec_ prefix", () => {
    const timestamp = Math.floor(NOW.getTime() / 1000);
    const bare = SECRET.replace("whsec_", "");
    const signature = signWebhook({ id: "evt", timestamp, body: BODY, secret: SECRET });

    expect(
      verifyWebhookSignature({
        body: BODY,
        headers: { id: "evt", timestamp: String(timestamp), signature },
        secret: bare,
        now: NOW,
      }),
    ).toBe(true);
  });
});

describe("assertVerifiedWebhook", () => {
  it("throws when the webhook key is not configured", () => {
    withSecret(undefined);
    expect(() => assertVerifiedWebhook({ body: BODY, headers: headers({}), now: NOW })).toThrow(
      WebhookVerificationError,
    );
  });

  it("throws when a required header is missing", () => {
    withSecret(SECRET);

    const partial = new Headers();
    partial.set("webhook-id", "evt_test_1");
    partial.set("webhook-timestamp", String(Math.floor(NOW.getTime() / 1000)));

    expect(() => assertVerifiedWebhook({ body: BODY, headers: partial, now: NOW })).toThrow(
      WebhookVerificationError,
    );
  });

  it("throws when the body is not JSON", () => {
    withSecret(SECRET);
    const body = "<html>not json</html>";

    expect(() =>
      assertVerifiedWebhook({ body, headers: headers({ body }), now: NOW }),
    ).toThrow(WebhookVerificationError);
  });

  it("returns the parsed event and headers when everything checks out", () => {
    withSecret(SECRET);
    const result = assertVerifiedWebhook({ body: BODY, headers: headers({}), now: NOW });

    expect(result.headers.id).toBe("evt_test_1");
    expect((result.event as { type: string }).type).toBe("subscription.active");
  });
});

describe("extractHeaders", () => {
  it("returns null when any header is absent", () => {
    expect(extractHeaders(new Headers())).toBeNull();
  });

  it("returns the triple when all three are present", () => {
    const map = headers({});
    expect(extractHeaders(map)).toEqual({
      id: "evt_test_1",
      timestamp: String(Math.floor(NOW.getTime() / 1000)),
      signature: map.get("webhook-signature"),
    });
  });
});
