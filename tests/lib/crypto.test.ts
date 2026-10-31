import { afterEach, describe, expect, it } from "vitest";
import { CryptoConfigurationError, decryptSecret, encryptSecret, randomToken, sha256Hex, timingSafeStringEqual } from "@/lib/crypto";
import { resetEnvCache } from "@/lib/env";

/**
 * OAuth token protection.
 *
 * LinkedIn tokens let anyone post as the member, so the threat model here is a
 * database leak: a lifted ciphertext must be useless both without the key and
 * when moved to a different workspace/account row.
 */

const KEY_32 = Buffer.alloc(32, 7).toString("base64");
const OTHER_KEY_32 = Buffer.alloc(32, 9).toString("base64");

function withKeys(current: string | undefined, previous?: string) {
  if (current === undefined) delete process.env.TOKEN_ENCRYPTION_KEY;
  else process.env.TOKEN_ENCRYPTION_KEY = current;

  if (previous === undefined) delete process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS;
  else process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS = previous;

  resetEnvCache();
}

afterEach(() => {
  delete process.env.TOKEN_ENCRYPTION_KEY;
  delete process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS;
  resetEnvCache();
});

describe("encryptSecret / decryptSecret", () => {
  it("round-trips a token", () => {
    withKeys(KEY_32);
    const cipher = encryptSecret("AQV-very-secret-token", "ws_1:acct_1");
    expect(decryptSecret(cipher, "ws_1:acct_1")).toBe("AQV-very-secret-token");
  });

  it("never returns the plaintext in the ciphertext", () => {
    withKeys(KEY_32);
    const cipher = encryptSecret("AQV-very-secret-token", "ws_1:acct_1");
    expect(cipher).not.toContain("very-secret-token");
  });

  it("produces different ciphertexts for the same plaintext (random IV)", () => {
    withKeys(KEY_32);
    const a = encryptSecret("same-token", "ws_1:acct_1");
    const b = encryptSecret("same-token", "ws_1:acct_1");
    expect(a).not.toBe(b);
  });

  it("binds the ciphertext to its workspace and account", () => {
    withKeys(KEY_32);
    const cipher = encryptSecret("AQV-token", "ws_1:acct_1");
    // Same key, wrong row: decryption must fail rather than return garbage.
    expect(() => decryptSecret(cipher, "ws_1:acct_2")).toThrow();
  });

  it("detects tampering with the ciphertext body", () => {
    withKeys(KEY_32);
    const cipher = encryptSecret("AQV-token", "ws_1:acct_1");
    const parts = cipher.split(".");
    const body = parts[4]!;
    const flipped = (body[0] === "A" ? "B" : "A") + body.slice(1);
    parts[4] = flipped;

    expect(() => decryptSecret(parts.join("."), "ws_1:acct_1")).toThrow();
  });

  it("supports key rotation through TOKEN_ENCRYPTION_KEY_PREVIOUS", () => {
    withKeys(KEY_32);
    const oldCipher = encryptSecret("AQV-token", "ws_1:acct_1");

    withKeys(OTHER_KEY_32, KEY_32);
    // Rows written with the previous key still decrypt during the rotation.
    expect(decryptSecret(oldCipher, "ws_1:acct_1")).toBe("AQV-token");
    // New rows use the current key and do not depend on the old one.
    const fresh = encryptSecret("AQV-token", "ws_1:acct_1");
    withKeys(OTHER_KEY_32);
    expect(decryptSecret(fresh, "ws_1:acct_1")).toBe("AQV-token");
  });

  it("refuses to run without a key", () => {
    withKeys(undefined);
    expect(() => encryptSecret("token", "ws_1:acct_1")).toThrow(CryptoConfigurationError);
  });

  it("rejects a key that is not 32 bytes", () => {
    withKeys(Buffer.alloc(16, 1).toString("base64"));
    expect(() => encryptSecret("token", "ws_1:acct_1")).toThrow(CryptoConfigurationError);
  });
});

describe("randomToken / sha256Hex / timingSafeStringEqual", () => {
  it("randomToken is URL-safe and unique", () => {
    const a = randomToken(32);
    const b = randomToken(32);
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("sha256Hex is stable", () => {
    expect(sha256Hex("zybble")).toBe(sha256Hex("zybble"));
    expect(sha256Hex("zybble")).not.toBe(sha256Hex("zybble "));
  });

  it("timingSafeStringEqual matches only identical strings", () => {
    expect(timingSafeStringEqual("abc", "abc")).toBe(true);
    expect(timingSafeStringEqual("abc", "abd")).toBe(false);
    expect(timingSafeStringEqual("abc", "abcd")).toBe(false);
  });
});
