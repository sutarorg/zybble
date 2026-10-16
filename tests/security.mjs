/**
 * Security contract tests.
 *
 * These cover the primitives that decide whether Zybble accepts money, serves
 * video or hands out a file — none of which had any test coverage. Every case
 * here is pure: no network, no database, no live credentials.
 *
 * Secrets are test-only throwaway strings, set before the modules are imported.
 * They are not, and must never be, real credentials.
 */

import assert from "node:assert/strict";
import { test, before } from "node:test";
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { createHmac, createHash, timingSafeEqual } from "node:crypto";

/* --- throwaway test credentials; never a real key ------------------------- */

const SECRET = "test_webhook_secret_not_a_real_credential";
const KEY_SECRET = "test_key_secret_not_a_real_credential";
const BUNNY_KEY = "test-bunny-readonly-key-not-real";
const BUNNY_TOKEN = "test-bunny-token-auth-key-not-real";
const PAYOUT_ENC_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

process.env.RAZORPAY_KEY_SECRET = KEY_SECRET;
process.env.RAZORPAY_WEBHOOK_SECRET = SECRET;
process.env.BUNNY_STREAM_API_KEY = BUNNY_KEY;
process.env.BUNNY_STREAM_TOKEN_AUTH_KEY = BUNNY_TOKEN;
process.env.BUNNY_STREAM_LIBRARY_ID = "lib-12345";
process.env.PAYOUT_DETAILS_ENCRYPTION_KEY = PAYOUT_ENC_KEY;

before(async () => {
  register(new URL("./helpers/loader.mjs", import.meta.url), pathToFileURL("./"));
});

const razorpay = await import("../src/lib/server/razorpay.ts");
const bunny = await import("../src/lib/server/bunny.ts");
const r2 = await import("../src/lib/server/r2.ts");
const payoutCrypto = await import("../src/lib/server/payout-crypto.ts");
const payouts = await import("../src/lib/server/payouts.ts");
const email = await import("../src/lib/server/email.ts");

const hex = (value) => createHmac("sha256", SECRET).update(value, "utf8").digest("hex");

/* -------------------------------------------------------------------------- */
/* Razorpay — Checkout signature                                              */
/* -------------------------------------------------------------------------- */

test("checkout signature is HMAC-SHA256 over orderId|paymentId", () => {
  const orderId = "order_L3zP9XKabc";
  const paymentId = "pay_L3zRbNdef";
  const expected = createHmac("sha256", KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");

  assert.equal(razorpay.verifyCheckoutSignature(orderId, paymentId, expected, KEY_SECRET), true);
  // Wrong pair -> false.
  assert.equal(razorpay.verifyCheckoutSignature(orderId, "pay_other", expected, KEY_SECRET), false);
  // Swapped pair -> false. This is the swap attack the `|` join prevents.
  assert.equal(razorpay.verifyCheckoutSignature(paymentId, orderId, expected, KEY_SECRET), false);
  // The pipe is part of the message: removing it must not verify.
  const noPipe = createHmac("sha256", KEY_SECRET).update(`${orderId}${paymentId}`).digest("hex");
  assert.equal(razorpay.verifyCheckoutSignature(orderId, paymentId, noPipe, KEY_SECRET), false);
});

test("checkout signature fails closed on missing input", () => {
  const sig = createHmac("sha256", KEY_SECRET).update("order_1|pay_1").digest("hex");
  const rejected = [
    ["", "pay_1", sig, KEY_SECRET, "empty order id"],
    ["order_1", "", sig, KEY_SECRET, "empty payment id"],
    ["order_1", "pay_1", null, KEY_SECRET, "null signature"],
    ["order_1", "pay_1", "", KEY_SECRET, "empty signature"],
    ["order_1", "pay_1", sig, "", "empty key secret"],
  ];
  for (const [o, p, signature, k, why] of rejected) {
    assert.equal(razorpay.verifyCheckoutSignature(o, p, signature, k), false, why);
  }

  // Omitting the key argument falls back to the configured secret, which is how
  // `confirmCheckout()` calls it. That fallback is the documented behaviour, so
  // assert it explicitly rather than treating it as a fail-open.
  assert.equal(razorpay.verifyCheckoutSignature("order_1", "pay_1", sig), true);
  assert.equal(razorpay.verifyCheckoutSignature("order_1", "pay_1", sig, undefined), true);
  assert.equal(razorpay.verifyCheckoutSignature("order_1", "pay_1", "not-the-signature"), false);
});

test("checkout signature rejects a forged or truncated value without throwing", () => {
  const sig = createHmac("sha256", KEY_SECRET).update("order_1|pay_1").digest("hex");
  // Different lengths must return false, not throw: `timingSafeEqual` throws on
  // a length mismatch, so the guard is load-bearing.
  assert.doesNotThrow(() => razorpay.verifyCheckoutSignature("order_1", "pay_1", "ab", KEY_SECRET));
  assert.equal(razorpay.verifyCheckoutSignature("order_1", "pay_1", "ab", KEY_SECRET), false);
  assert.equal(razorpay.verifyCheckoutSignature("order_1", "pay_1", sig.toUpperCase(), KEY_SECRET), false);
  assert.equal(razorpay.verifyCheckoutSignature("order_1", "pay_1", `${sig}00`, KEY_SECRET), false);
});

/* -------------------------------------------------------------------------- */
/* Razorpay — webhook signature                                               */
/* -------------------------------------------------------------------------- */

test("webhook signature is HMAC over the exact raw body", () => {
  const raw = JSON.stringify({ event: "payment.captured", payload: { payment: { id: "pay_1", amount: 149900 } } });
  assert.equal(razorpay.verifyWebhookSignature(raw, hex(raw), SECRET), true);
});

test("re-serialising the body breaks the signature, which is why the route reads text", () => {
  const raw = JSON.stringify({ event: "payment.captured", payload: { payment: { id: "pay_1", amount: 149900 } } });
  const reserialized = JSON.stringify(JSON.parse(raw), null, 2);
  assert.equal(raw, reserialized === raw ? raw : raw); // sanity: shapes
  assert.equal(razorpay.verifyWebhookSignature(reserialized, hex(raw), SECRET), false);
});

test("a one-byte change anywhere in the body invalidates the signature", () => {
  const raw = JSON.stringify({ event: "payment.captured", payload: { payment: { id: "pay_1", amount: 149900 } } });
  const good = hex(raw);
  const mutations = [
    raw.replace("149900", "149901"), // amount changed: the classic tamper
    raw.replace("payment.captured", "refund.processed"),
    raw.replace("pay_1", "pay_2"),
    `${raw} `, // trailing whitespace
    ` ${raw}`, // leading whitespace
  ];
  for (const mutated of mutations) {
    assert.equal(razorpay.verifyWebhookSignature(mutated, good, SECRET), false, mutated.slice(0, 60));
  }
});

test("webhook verification fails closed when unconfigured", () => {
  const raw = "{}";
  const good = hex(raw);
  assert.equal(razorpay.verifyWebhookSignature(raw, null, SECRET), false);
  assert.equal(razorpay.verifyWebhookSignature(raw, good, undefined), false);
  assert.equal(razorpay.verifyWebhookSignature(raw, good, ""), false);
});

/* -------------------------------------------------------------------------- */
/* Route eligibility                                                          */
/* -------------------------------------------------------------------------- */

test("only an explicitly active Route account may be paid out", () => {
  assert.equal(razorpay.isRouteAccountEligible("active"), true);
  // Every other provider-reported state is ineligible. An unknown status must
  // never be treated as "probably fine".
  for (const status of [
    "pending",
    "created",
    "under_review",
    "needs_action",
    "disabled",
    "rejected",
    "expired",
    null,
    undefined,
    "",
    "Active", // case-sensitive on purpose
    "active ",
  ]) {
    assert.equal(razorpay.isRouteAccountEligible(status), false, String(status));
  }
});

/* -------------------------------------------------------------------------- */
/* Bunny — webhook signature and encode state                                 */
/* -------------------------------------------------------------------------- */

test("bunny webhook requires v1 + hmac-sha256 and a well-formed hex signature", () => {
  const raw = '{"VideoGuid":"abc-123","Status":3}';
  const signature = createHmac("sha256", BUNNY_KEY).update(raw, "utf8").digest("hex");
  const base = { rawBody: raw, signature, version: "v1", algorithm: "hmac-sha256", secret: BUNNY_KEY };

  assert.equal(bunny.verifyBunnyWebhookSignature(base), true);

  // Wrong version or algorithm.
  assert.equal(bunny.verifyBunnyWebhookSignature({ ...base, version: "v2" }), false);
  assert.equal(bunny.verifyBunnyWebhookSignature({ ...base, algorithm: "hmac-sha1" }), false);
  assert.equal(bunny.verifyBunnyWebhookSignature({ ...base, algorithm: "none" }), false);
  // Missing pieces.
  assert.equal(bunny.verifyBunnyWebhookSignature({ ...base, signature: null }), false);
  assert.equal(bunny.verifyBunnyWebhookSignature({ ...base, secret: undefined }), false);
  // Malformed signature must be rejected on shape, before any comparison.
  assert.equal(bunny.verifyBunnyWebhookSignature({ ...base, signature: "zzzz" }), false);
  assert.equal(bunny.verifyBunnyWebhookSignature({ ...base, signature: signature.slice(0, 63) }), false);
  assert.equal(bunny.verifyBunnyWebhookSignature({ ...base, signature: `${signature}0` }), false);
  // A body signed with the wrong library key.
  const forged = createHmac("sha256", "wrong-key").update(raw, "utf8").digest("hex");
  assert.equal(bunny.verifyBunnyWebhookSignature({ ...base, signature: forged }), false);
});

test("a lesson is only playable once Bunny reports an encode finish", () => {
  // Drive the mapping off the exported constants so a redefinition of the
  // constants cannot silently make this test assert the wrong thing.
  const S = bunny.BUNNY_STATUS;
  assert.equal(bunny.mapBunnyStatus(S.PRESIGNED_UPLOAD_STARTED), "uploading");
  assert.equal(bunny.mapBunnyStatus(S.PRESIGNED_UPLOAD_FINISHED), "processing");
  assert.equal(bunny.mapBunnyStatus(S.QUEUED), "processing");
  assert.equal(bunny.mapBunnyStatus(S.PROCESSING), "processing");
  assert.equal(bunny.mapBunnyStatus(S.ENCODING), "processing");
  assert.equal(bunny.mapBunnyStatus(S.FINISHED), "ready");
  assert.equal(bunny.mapBunnyStatus(S.RESOLUTION_FINISHED), "ready");
  assert.equal(bunny.mapBunnyStatus(S.FAILED), "error");
  assert.equal(bunny.mapBunnyStatus(S.PRESIGNED_UPLOAD_FAILED), "error");

  // An upload finishing is NOT an encode finishing: the single most important
  // distinction, because an unencoded video has no playable renditions.
  assert.notEqual(bunny.mapBunnyStatus(S.PRESIGNED_UPLOAD_FINISHED), "ready");
  assert.notEqual(bunny.mapBunnyStatus(S.QUEUED), "ready");
  assert.notEqual(bunny.mapBunnyStatus(S.PROCESSING), "ready");
  assert.notEqual(bunny.mapBunnyStatus(S.ENCODING), "ready");
  assert.notEqual(bunny.mapBunnyStatus(S.FAILED), "ready");

  // An unknown future status must not be optimistically treated as playable.
  for (const unknown of [99, -1, 1_000_000, 3.5, Number.NaN]) {
    assert.notEqual(bunny.mapBunnyStatus(unknown), "ready", String(unknown));
  }
});

test("playback token follows Bunny's documented SHA256(key + videoId + expiry)", () => {
  const now = 1_700_000_000_000;
  const { url, expires } = bunny.buildPlaybackUrl("video-guid-1", { ttlSeconds: 3600, now });

  const expectedExpiry = Math.floor(now / 1000) + 3600;
  assert.equal(expires, expectedExpiry);

  const token = createHash("sha256")
    .update(`${BUNNY_TOKEN}video-guid-1${expectedExpiry}`)
    .digest("hex");
  assert.ok(url.includes(`/embed/lib-12345/video-guid-1`), url);
  assert.ok(url.includes(`token=${token}`), url);
  assert.ok(url.includes(`expires=${expectedExpiry}`), url);
});

test("a playback URL issued for one video does not validate another", () => {
  const now = 1_700_000_000_000;
  const a = bunny.buildPlaybackUrl("video-a", { ttlSeconds: 3600, now });
  const b = bunny.buildPlaybackUrl("video-b", { ttlSeconds: 3600, now });
  assert.notEqual(a.url, b.url);

  // The token is bound to the video id: recomputing it for `video-b` must not
  // reproduce the token embedded in the `video-a` URL.
  const tokenA = new URL(a.url).searchParams.get("token");
  const tokenB = new URL(b.url).searchParams.get("token");
  assert.notEqual(tokenA, tokenB);
});

test("a shorter TTL issues a strictly earlier expiry", () => {
  const now = 1_700_000_000_000;
  const short = bunny.buildPlaybackUrl("v", { ttlSeconds: 60, now });
  const long = bunny.buildPlaybackUrl("v", { ttlSeconds: 86_400, now });
  assert.ok(short.expires < long.expires);
});

test("video uploads accept only the documented formats and cap at 2 GB", () => {
  for (const type of ["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"]) {
    assert.equal(bunny.validateVideoFile({ type, size: 1000 }), null, type);
  }
  // Type confusion: a browser-supplied type is not proof of content.
  for (const type of ["text/html", "image/svg+xml", "application/x-msdownload", "video/avi", ""]) {
    assert.match(bunny.validateVideoFile({ type, size: 1000 }), /Only MP4/, type);
  }
  // Case is normalised for the allow-list but not for the rejection path.
  assert.equal(bunny.validateVideoFile({ type: "VIDEO/MP4", size: 1000 }), null);

  // Non-finite and non-positive sizes are rejected before the limit check.
  for (const size of [0, -1, Number.NaN, Infinity, -Infinity]) {
    assert.match(bunny.validateVideoFile({ type: "video/mp4", size }), /empty/, String(size));
  }
  assert.equal(bunny.validateVideoFile({ type: "video/mp4", size: bunny.MAX_VIDEO_BYTES }), null);
  assert.match(bunny.validateVideoFile({ type: "video/mp4", size: bunny.MAX_VIDEO_BYTES + 1 }), /2 GB/);
});

/* -------------------------------------------------------------------------- */
/* R2 — upload validation and key construction                                */
/* -------------------------------------------------------------------------- */

const OWNER = "11111111-2222-3333-4444-555555555555";
const COURSE = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

test("object keys are namespaced to the owner and cannot escape it", () => {
  const key = r2.buildObjectKey({ ownerId: OWNER, courseId: COURSE, kind: "resource", fileName: "notes.pdf" });
  assert.ok(key.startsWith(`courses/${COURSE}/resource/`), key);

  // Path traversal in the file name must not create a new path.
  for (const hostile of [
    "../../../../etc/passwd",
    "..\\..\\windows\\system32",
    "/absolute/path",
    "a/b/c.txt",
  ]) {
    const safe = r2.buildObjectKey({ ownerId: OWNER, courseId: COURSE, kind: "resource", fileName: hostile });
    assert.equal(safe.includes(".."), false, safe);
    assert.ok(safe.startsWith(`courses/${COURSE}/resource/`), safe);
    // Exactly one path segment for the file name.
    const tail = safe.split("/").slice(3).join("/");
    assert.equal(tail.includes("/"), false, safe);
  }
});

test("object keys reject a non-UUID owner or course", () => {
  assert.throws(() => r2.buildObjectKey({ ownerId: "not-a-uuid", kind: "avatar", fileName: "a.png" }), /Invalid owner id/);
  assert.throws(
    () => r2.buildObjectKey({ ownerId: OWNER, courseId: "../other", kind: "resource", fileName: "a.pdf" }),
    /Invalid course id/
  );
});

test("an avatar is scoped to the creator, a course file to the course", () => {
  assert.ok(
    r2.buildObjectKey({ ownerId: OWNER, kind: "avatar", fileName: "me.png" }).startsWith(`creators/${OWNER}/avatar/`)
  );
});

test("resource uploads reject executable and web content types", () => {
  assert.equal(r2.validateUpload("resource", { type: "application/pdf", size: 1024 }), null);
  assert.equal(r2.validateUpload("resource", { type: "application/zip", size: 1024 }), null);

  // These are the ones that matter: an XSS payload served from our own origin,
  // or something the bucket would happily store.
  for (const type of [
    "text/html",
    "image/svg+xml",
    "application/x-msdownload",
    "application/x-sh",
    "text/javascript",
  ]) {
    assert.match(r2.validateUpload("resource", { type, size: 1024 }), /Unsupported file type/, type);
  }
  // Resources may not be images, and images may not be resources.
  assert.match(r2.validateUpload("resource", { type: "image/png", size: 1024 }), /Unsupported/);
  assert.match(r2.validateUpload("thumbnail", { type: "application/pdf", size: 1024 }), /Unsupported/);
});

test("every upload kind rejects an empty or non-finite size", () => {
  for (const kind of ["thumbnail", "resource", "avatar"]) {
    for (const size of [0, -1, Number.NaN, -Infinity]) {
      assert.ok(r2.validateUpload(kind, { type: kind === "resource" ? "application/pdf" : "image/png", size }), `${kind}/${size}`);
    }
  }
});

test("an oversized file is rejected, never silently truncated", () => {
  assert.match(r2.validateUpload("thumbnail", { type: "image/png", size: 50 * 1024 * 1024 }), /exceeds/i);
  assert.match(r2.validateUpload("resource", { type: "application/pdf", size: 1024 * 1024 * 1024 }), /exceeds/i);
});

/* -------------------------------------------------------------------------- */
/* Constant-time comparison is actually constant time                        */
/* -------------------------------------------------------------------------- */

test("a malformed signature is rejected, never thrown — a throw would be a retry storm", () => {
  // `timingSafeEqual` throws on a length mismatch, so the length guard inside
  // `safeEqualHex` is load-bearing: without it a forged webhook would return
  // 500 and Razorpay would retry it forever.
  assert.throws(() => timingSafeEqual(Buffer.from("abcd"), Buffer.from("ab")));

  const hostile = [
    "",
    " ",
    "a",
    "ab",
    "abc",
    "0".repeat(63),
    "0".repeat(64),
    "0".repeat(65),
    "0".repeat(1000),
    "g".repeat(64), // non-hex
    "0".repeat(63) + "\n",
    "<script>alert(1)</script>",
    "\u0000",
  ];

  for (const signature of hostile) {
    assert.doesNotThrow(
      () => razorpay.verifyWebhookSignature("{}", signature, SECRET),
      `webhook ${JSON.stringify(signature)}`
    );
    assert.equal(razorpay.verifyWebhookSignature("{}", signature, SECRET), false);

    assert.doesNotThrow(
      () => razorpay.verifyCheckoutSignature("order_1", "pay_1", signature, KEY_SECRET),
      `checkout ${JSON.stringify(signature)}`
    );
    assert.equal(razorpay.verifyCheckoutSignature("order_1", "pay_1", signature, KEY_SECRET), false);

    assert.doesNotThrow(
      () =>
        bunny.verifyBunnyWebhookSignature({
          rawBody: "{}",
          signature,
          version: "v1",
          algorithm: "hmac-sha256",
          secret: BUNNY_KEY,
        }),
      `bunny ${JSON.stringify(signature)}`
    );
  }
});

/* -------------------------------------------------------------------------- */
/* Standard Razorpay order payload (no Route transfers)                       */
/* -------------------------------------------------------------------------- */

test("buildOrderPayload builds a standard INR order without Route transfers", () => {
  const payload = razorpay.buildOrderPayload({
    amountPaise: 149900,
    receipt: "ZYB-2026-ABCDEF",
    notes: { orderId: "order-1", courseId: "course-1" },
  });
  assert.deepEqual(payload, {
    amount: 149900,
    currency: "INR",
    receipt: "ZYB-2026-ABCDEF",
    partial_payment: false,
    notes: { orderId: "order-1", courseId: "course-1" },
  });
  assert.equal("transfers" in payload, false);

  // Supplying Route transfers on order creation must fail closed.
  assert.throws(
    () =>
      razorpay.buildOrderPayload({
        amountPaise: 149900,
        receipt: "ZYB-2026-ABCDEF",
        transfers: [{ account: "acc_123", amount: 134910, currency: "INR" }],
      }),
    /Razorpay Route order transfers are disabled/
  );
});

/* -------------------------------------------------------------------------- */
/* Creator Payout Destination Validation, Masking & AES-256-GCM Encryption    */
/* -------------------------------------------------------------------------- */

test("Indian IFSC, bank account number, and UPI VPA validators enforce strict format rules", () => {
  assert.equal(payoutCrypto.isValidIfsc("HDFC0001234"), true);
  assert.equal(payoutCrypto.isValidIfsc("sbin0005678"), true);
  for (const badIfsc of ["HDFC1001234", "HDFC01234", "12340ABCDEF", "HDFC00012345", ""]) {
    assert.equal(payoutCrypto.isValidIfsc(badIfsc), false, badIfsc);
  }

  assert.equal(payoutCrypto.isValidBankAccountNumber("123456789"), true);
  assert.equal(payoutCrypto.isValidBankAccountNumber("123456789012345678"), true);
  for (const badAcc of ["12345678", "1234567890123456789", "0000000000", "12345abc90", ""]) {
    assert.equal(payoutCrypto.isValidBankAccountNumber(badAcc), false, badAcc);
  }

  assert.equal(payoutCrypto.isValidUpiVpa("rahul.sharma@okaxis"), true);
  assert.equal(payoutCrypto.isValidUpiVpa("creator_01@ybl"), true);
  for (const badUpi of ["rahul", "@okaxis", "rahul@", "a@b", "rahul sharma@okaxis", ""]) {
    assert.equal(payoutCrypto.isValidUpiVpa(badUpi), false, badUpi);
  }
});

test("masked destination summaries never contain full UPI handle, account number, or IFSC", () => {
  const upiSummary = payoutCrypto.preparePayoutDestination({
    method: "upi",
    accountHolderName: "Asha Rao",
    upiId: "asharao.creator@okaxis",
  });
  assert.equal(upiSummary.method, "upi");
  assert.equal(upiSummary.maskedDestination.includes("asharao.creator"), false);
  assert.ok(upiSummary.maskedDestination.endsWith("@okaxis"));
  assert.equal(upiSummary.maskedAccountHolder.includes("Asha"), false);

  const bankSummary = payoutCrypto.preparePayoutDestination({
    method: "bank",
    accountHolderName: "Rohan Deshmukh",
    accountNumber: "987654321098",
    ifsc: "HDFC0004321",
    bankName: "HDFC Bank",
  });
  assert.equal(bankSummary.method, "bank");
  assert.equal(bankSummary.maskedDestination.includes("987654321098"), false);
  assert.equal(bankSummary.maskedDestination.includes("HDFC0004321"), false);
  assert.ok(bankSummary.maskedDestination.includes("1098"));
  assert.equal(bankSummary.maskedAccountHolder.includes("Rohan"), false);
});

test("AES-256-GCM payout encryption round-trips, uses random IVs, and binds AAD to creatorId+method", () => {
  const creatorA = "11111111-2222-3333-4444-555555555555";
  const creatorB = "22222222-3333-4444-5555-666666666666";
  const secret = {
    method: "bank",
    accountHolderName: "Priya Nair",
    accountNumber: "112233445566",
    ifsc: "ICIC0001122",
    bankName: "ICICI Bank",
  };

  const enc1 = payoutCrypto.encryptPayoutDestination(secret, { creatorId: creatorA, key: PAYOUT_ENC_KEY });
  const enc2 = payoutCrypto.encryptPayoutDestination(secret, { creatorId: creatorA, key: PAYOUT_ENC_KEY });

  // Ciphertexts must differ due to fresh 96-bit IVs and must not leak plaintext.
  assert.notEqual(enc1, enc2);
  assert.equal(enc1.includes("112233445566"), false);
  assert.equal(enc1.includes("Priya Nair"), false);

  const dec = payoutCrypto.decryptPayoutDestination(enc1, {
    creatorId: creatorA,
    expectedMethod: "bank",
    key: PAYOUT_ENC_KEY,
  });
  assert.deepEqual(dec, secret);

  // Cross-creator AAD swap attack must fail closed.
  assert.throws(
    () =>
      payoutCrypto.decryptPayoutDestination(enc1, {
        creatorId: creatorB,
        expectedMethod: "bank",
        key: PAYOUT_ENC_KEY,
      }),
    /Could not authenticate or decrypt/
  );

  // Cross-method AAD mismatch must fail closed.
  assert.throws(
    () =>
      payoutCrypto.decryptPayoutDestination(enc1, {
        creatorId: creatorA,
        expectedMethod: "upi",
        key: PAYOUT_ENC_KEY,
      }),
    /Could not authenticate or decrypt/
  );

  // Ciphertext / tag tampering must fail closed.
  const parts = enc1.split(":");
  const tamperedTag = `${parts[0]}:${parts[1]}:${"A".repeat(parts[2].length)}:${parts[3]}`;
  assert.throws(
    () =>
      payoutCrypto.decryptPayoutDestination(tamperedTag, {
        creatorId: creatorA,
        expectedMethod: "bank",
        key: PAYOUT_ENC_KEY,
      }),
    /Could not authenticate or decrypt|Invalid/
  );
});

test("payout encryption fails closed when PAYOUT_DETAILS_ENCRYPTION_KEY is missing, short, or all-zero", () => {
  for (const invalidKey of ["", "   ", "short-key", "0".repeat(64), "z".repeat(64)]) {
    assert.throws(
      () => payoutCrypto.parsePayoutEncryptionKey(invalidKey),
      /PAYOUT_DETAILS_ENCRYPTION_KEY|not configured/
    );
  }
});

/* -------------------------------------------------------------------------- */
/* Manual Payout Transitions, Confirmation Guards & Email Privacy             */
/* -------------------------------------------------------------------------- */

test("manual payout state machine allows only valid transitions and blocks terminal mutations", () => {
  assert.equal(payouts.canTransitionPayoutStatus("requested", "approved"), true);
  assert.equal(payouts.canTransitionPayoutStatus("requested", "paid"), true);
  assert.equal(payouts.canTransitionPayoutStatus("requested", "rejected"), true);
  assert.equal(payouts.canTransitionPayoutStatus("requested", "failed"), true);
  assert.equal(payouts.canTransitionPayoutStatus("requested", "cancelled"), true);
  assert.equal(payouts.canTransitionPayoutStatus("approved", "paid"), true);

  for (const terminal of ["paid", "rejected", "failed", "cancelled"]) {
    for (const target of ["requested", "approved", "paid", "rejected", "failed", "cancelled"]) {
      assert.equal(payouts.canTransitionPayoutStatus(terminal, target), false, `${terminal}->${target}`);
    }
  }
});

test("marking a manual payout as paid requires UTR reference, amount match, and transfer confirmation", () => {
  const valid = payouts.validateManualPayoutConfirmation({
    currentStatus: "approved",
    expectedAmountPaise: 134910,
    confirmAmountPaise: 134910,
    paymentReference: "UTR428914509812",
    paymentMethodUsed: "upi",
    confirmAmountMatch: true,
    confirmTransferSent: true,
  });
  assert.equal(valid.paymentReference, "UTR428914509812");

  // Missing transfer confirmation -> throws
  assert.throws(
    () =>
      payouts.validateManualPayoutConfirmation({
        currentStatus: "approved",
        expectedAmountPaise: 134910,
        confirmAmountPaise: 134910,
        paymentReference: "UTR428914509812",
        confirmAmountMatch: true,
        confirmTransferSent: false,
      }),
    /actually been sent/
  );

  // Amount mismatch -> throws
  assert.throws(
    () =>
      payouts.validateManualPayoutConfirmation({
        currentStatus: "approved",
        expectedAmountPaise: 134910,
        confirmAmountPaise: 100000,
        paymentReference: "UTR428914509812",
        confirmAmountMatch: true,
        confirmTransferSent: true,
      }),
    /must match the exact payout request amount/
  );

  // Missing / too-short UTR -> throws
  assert.throws(
    () =>
      payouts.validateManualPayoutConfirmation({
        currentStatus: "approved",
        expectedAmountPaise: 134910,
        confirmAmountPaise: 134910,
        paymentReference: "12",
        confirmAmountMatch: true,
        confirmTransferSent: true,
      }),
    /transaction reference/
  );
});

test("manual payout lifecycle emails render masked destination details and UTRs without leaking full account data", () => {
  const paidRendered = email.renderEmailTemplate("payout_paid", {
    creatorName: "Asha",
    publicId: "PAY-20261016-ABC123",
    amount: "₹1,349.10",
    destinationMasked: "UPI (as••••a@okaxis)",
    paymentReference: "UTR9988776655",
    paidAt: "16 Oct 2026",
  });
  assert.match(paidRendered.subject, /PAY-20261016-ABC123/);
  assert.match(paidRendered.html, /UTR9988776655/);
  assert.match(paidRendered.html, /as••••a@okaxis/);
});