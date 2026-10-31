import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { env } from "@/lib/env";

/**
 * Application-layer encryption for third-party OAuth credentials.
 *
 * LinkedIn access tokens are long-lived (60 days) and grant the ability to post
 * as the member, so they are encrypted before they ever reach the database with
 * AES-256-GCM:
 *
 *   v1.<keyId>.<iv>.<authTag>.<ciphertext>        (base64url segments)
 *
 * The workspace and account ids are bound in as additional authenticated data,
 * which makes a ciphertext lifted from one row useless in another.
 * `TOKEN_ENCRYPTION_KEY_PREVIOUS` allows a rotation window where old rows still
 * decrypt while new rows are written with the current key.
 */

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const PREFIX = "v1";

export class CryptoConfigurationError extends Error {}

type KeyMaterial = { id: string; key: Buffer };

function parseKey(raw: string, label: string): KeyMaterial {
  let key: Buffer;

  try {
    key = Buffer.from(raw, "base64");
  } catch {
    throw new CryptoConfigurationError(`${label} must be base64 encoded`);
  }

  if (key.length !== 32) {
    throw new CryptoConfigurationError(
      `${label} must decode to 32 bytes (received ${key.length})`,
    );
  }

  return { id: createHash("sha256").update(key).digest("hex").slice(0, 8), key };
}

function currentKey(): KeyMaterial {
  const raw = env().TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new CryptoConfigurationError(
      "TOKEN_ENCRYPTION_KEY is not configured — OAuth tokens cannot be stored",
    );
  }
  return parseKey(raw, "TOKEN_ENCRYPTION_KEY");
}

function previousKey(): KeyMaterial | null {
  const raw = env().TOKEN_ENCRYPTION_KEY_PREVIOUS;
  if (!raw) return null;
  return parseKey(raw, "TOKEN_ENCRYPTION_KEY_PREVIOUS");
}

export function activeKeyId(): string {
  return currentKey().id;
}

/**
 * Encrypt a secret for a specific row. `aad` must be reconstructed identically
 * on read (see `decryptSecret`).
 */
export function encryptSecret(plaintext: string, aad: string): string {
  const { id, key } = currentKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(Buffer.from(aad, "utf8"));

  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    PREFIX,
    id,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptSecret(encoded: string, aad: string): string {
  const segments = encoded.split(".");
  if (segments.length !== 5 || segments[0] !== PREFIX) {
    throw new Error("Malformed encrypted value");
  }

  const [, keyId, ivPart, tagPart, payloadPart] = segments;
  const current = currentKey();
  const previous = previousKey();

  let material: KeyMaterial | null = null;
  if (keyId === current.id) material = current;
  else if (previous && keyId === previous.id) material = previous;

  if (!material) {
    throw new Error(`No usable decryption key for key id ${keyId}`);
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    material.key,
    Buffer.from(ivPart, "base64url"),
    { authTagLength: TAG_BYTES },
  );
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payloadPart, "base64url")),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}

/** URL-safe random token, used for OAuth state and workspace invitations. */
export function randomToken(byteLength = 32): string {
  return randomBytes(byteLength).toString("base64url");
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function timingSafeStringEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Constant-time HMAC comparison used by inbound webhook verification.
 * (Standard Webhooks signatures are compared by the verifier itself; this is
 * for the simple bearer secrets on internal endpoints.)
 */
export function safeEquals(a: string, b: string): boolean {
  return timingSafeStringEqual(a, b);
}
