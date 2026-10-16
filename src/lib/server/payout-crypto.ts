/**
 * Server-only validation, masking, and AES-256-GCM authenticated encryption
 * for creator payout destinations (Indian UPI VPAs and bank accounts).
 *
 * Security invariants:
 *   1. Full beneficiary names, UPI VPAs, bank account numbers, and IFSC codes
 *      are encrypted at the application layer with AES-256-GCM before being
 *      stored in Postgres.
 *   2. Encryption requires a 32-byte server-only key in
 *      `PAYOUT_DETAILS_ENCRYPTION_KEY` (64 hex characters or 32-byte base64).
 *      Missing, malformed, or all-zero keys fail closed immediately.
 *   3. Each ciphertext envelope (`v1:<iv>:<tag>:<ciphertext>`) uses a fresh
 *      96-bit random IV, a 128-bit authentication tag, and Additional
 *      Authenticated Data (AAD) binding the ciphertext to the creator ID and
 *      payout method so ciphertexts cannot be swapped across creators.
 *   4. Masked display summaries (`ra••••@okaxis`, `•••• 4321 · HDFC••••234`)
 *      never contain the full UPI handle, full bank account number, or full
 *      unmasked IFSC.
 */

import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { z } from "zod";
import { serverEnv } from "@/lib/env";

export type PayoutDestinationMethod = "upi" | "bank";

export class PayoutCryptoError extends Error {
  readonly code:
    | "encryption_unconfigured"
    | "encryption_key_invalid"
    | "invalid_destination"
    | "decryption_failed";

  constructor(
    code: PayoutCryptoError["code"],
    message: string
  ) {
    super(message);
    this.name = "PayoutCryptoError";
    this.code = code;
  }
}

/* -------------------------------------------------------------------------- */
/* Format validators (Indian UPI VPA, Bank Account Number, IFSC)               */
/* -------------------------------------------------------------------------- */

/**
 * Indian IFSC code: 4 uppercase letters (bank code) + literal `0` + 6 uppercase
 * alphanumeric characters (branch code). Total length: 11.
 */
export const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

/**
 * Indian bank account number: 9 to 18 digits.
 */
export const BANK_ACCOUNT_REGEX = /^[0-9]{9,18}$/;

/**
 * UPI Virtual Payment Address (VPA): `handle@psp`, where handle is 2..64
 * alphanumeric/`.`/`_`/`-` characters and PSP suffix is 2..64 letters/digits/`.`/`-`.
 */
export const UPI_VPA_REGEX = /^[a-z0-9]+(?:[._-][a-z0-9]+)*@[a-z0-9]+(?:[.-][a-z0-9]+)*$/;

export function normalizeIfsc(raw: string): string {
  return String(raw ?? "").trim().toUpperCase();
}

export function isValidIfsc(raw: string): boolean {
  const normalized = normalizeIfsc(raw);
  return IFSC_REGEX.test(normalized);
}

export function normalizeBankAccountNumber(raw: string): string {
  return String(raw ?? "").trim();
}

export function isValidBankAccountNumber(raw: string): boolean {
  const normalized = normalizeBankAccountNumber(raw);
  if (!BANK_ACCOUNT_REGEX.test(normalized)) return false;
  // Reject all-zero account numbers.
  if (/^0+$/.test(normalized)) return false;
  return true;
}

export function normalizeUpiVpa(raw: string): string {
  return String(raw ?? "").trim().toLowerCase();
}

export function isValidUpiVpa(raw: string): boolean {
  const normalized = normalizeUpiVpa(raw);
  if (normalized.length < 5 || normalized.length > 100) return false;
  if (!UPI_VPA_REGEX.test(normalized)) return false;
  const [handle, provider] = normalized.split("@");
  if (!handle || !provider) return false;
  if (handle.length < 2 || handle.length > 64) return false;
  if (provider.length < 2 || provider.length > 64) return false;
  return true;
}

/* -------------------------------------------------------------------------- */
/* Schemas                                                                     */
/* -------------------------------------------------------------------------- */

const holderNameSchema = z
  .string()
  .trim()
  .min(2, "Enter the beneficiary or account holder name")
  .max(120, "Beneficiary name must be 120 characters or fewer")
  .regex(/^[\p{L}\p{M} .'-]+$/u, "Beneficiary name contains unsupported characters");

const upiInputSchema = z.object({
  method: z.literal("upi"),
  accountHolderName: holderNameSchema,
  upiId: z
    .string()
    .trim()
    .transform((v) => v.toLowerCase())
    .refine(isValidUpiVpa, "Enter a valid Indian UPI ID (for example, name@okaxis)"),
});

const bankInputSchema = z
  .object({
    method: z.literal("bank"),
    accountHolderName: holderNameSchema,
    accountNumber: z
      .string()
      .trim()
      .refine(isValidBankAccountNumber, "Enter a valid 9 to 18 digit Indian bank account number"),
    confirmAccountNumber: z.string().trim().optional(),
    ifsc: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase())
      .refine(isValidIfsc, "Enter a valid 11-character Indian IFSC code (5th character must be 0)"),
    bankName: z
      .string()
      .trim()
      .max(120, "Bank or branch label must be 120 characters or fewer")
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined)),
  })
  .refine(
    (data) =>
      data.confirmAccountNumber === undefined ||
      data.confirmAccountNumber === "" ||
      data.confirmAccountNumber === data.accountNumber,
    {
      path: ["confirmAccountNumber"],
      message: "Bank account numbers do not match",
    }
  );

export const payoutDestinationInputSchema = z.discriminatedUnion("method", [
  upiInputSchema,
  bankInputSchema,
]);

export type PayoutDestinationInput = z.input<typeof payoutDestinationInputSchema>;
export type ValidatedPayoutDestination = z.output<typeof payoutDestinationInputSchema>;

const payoutSecretPayloadSchema = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("upi"),
    accountHolderName: z.string().min(2).max(120),
    upiId: z.string().refine(isValidUpiVpa),
  }),
  z.object({
    method: z.literal("bank"),
    accountHolderName: z.string().min(2).max(120),
    accountNumber: z.string().refine(isValidBankAccountNumber),
    ifsc: z.string().refine(isValidIfsc),
    bankName: z.string().max(120).optional(),
  }),
]);

export type PayoutSecretPayload = z.infer<typeof payoutSecretPayloadSchema>;
export type PlainPayoutDestination = PayoutSecretPayload;

/* -------------------------------------------------------------------------- */
/* Masking helpers                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Masks an account holder or beneficiary name so list views confirm identity
 * without publishing full PII (e.g. `Asha Rao` -> `As•• R••`).
 */
export function maskAccountHolderName(name: string): string {
  const cleaned = String(name ?? "").trim().replace(/\s+/g, " ");
  if (!cleaned) return "••";
  return cleaned
    .split(" ")
    .map((part) => {
      if (part.length <= 1) return "•";
      if (part.length === 2) return `${part[0]}•`;
      const visible = Math.min(2, part.length - 1);
      return `${part.slice(0, visible)}${"•".repeat(Math.min(4, part.length - visible))}`;
    })
    .join(" ");
}

/**
 * Masks a UPI VPA, preserving only a short prefix/suffix and the `@psp` domain
 * (e.g. `rahulsharma@okaxis` -> `ra•••••a@okaxis`, `ab@upi` -> `a•@upi`).
 * Never returns the unmasked handle.
 */
export function maskUpiVpa(upiId: string): string {
  const normalized = normalizeUpiVpa(upiId);
  const atIndex = normalized.indexOf("@");
  if (atIndex <= 0) return "••••@upi";
  const handle = normalized.slice(0, atIndex);
  const provider = normalized.slice(atIndex + 1);
  if (handle.length <= 2) {
    return `${handle[0] ?? "•"}•@${provider}`;
  }
  if (handle.length <= 4) {
    return `${handle[0]}${"•".repeat(handle.length - 1)}@${provider}`;
  }
  return `${handle.slice(0, 2)}${"•".repeat(Math.min(5, handle.length - 3))}${handle.slice(-1)}@${provider}`;
}

/**
 * Masks an Indian bank account number and IFSC code for safe display
 * (e.g. `•••• 4321 · HDFC••••234`).
 */
export function maskBankAccount(accountNumber: string, ifsc: string): string {
  const normalizedAcc = normalizeBankAccountNumber(accountNumber);
  const normalizedIfsc = normalizeIfsc(ifsc);
  const last4 = normalizedAcc.slice(-4).padStart(4, "•");
  const bankPrefix = normalizedIfsc.slice(0, 4);
  const branchSuffix = normalizedIfsc.slice(-3);
  const maskedIfsc =
    bankPrefix.length === 4 && branchSuffix.length === 3
      ? `${bankPrefix}••••${branchSuffix}`
      : "••••";
  return `•••• ${last4} · ${maskedIfsc}`;
}

export interface PayoutDestinationSummaryMetadata {
  method: PayoutDestinationMethod;
  maskedDestination: string;
  maskedAccountHolder: string;
  bankLabel: string | null;
  secretPayload: PayoutSecretPayload;
}

/**
 * Validates raw user input and produces both the non-sensitive masked metadata
 * and the structured secret payload ready for AES-256-GCM encryption.
 */
export function preparePayoutDestination(
  rawInput: unknown
): PayoutDestinationSummaryMetadata {
  const parsed = payoutDestinationInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new PayoutCryptoError(
      "invalid_destination",
      parsed.error.issues[0]?.message ?? "Check your payout destination details"
    );
  }

  const data = parsed.data;
  if (data.method === "upi") {
    return {
      method: "upi",
      maskedDestination: maskUpiVpa(data.upiId),
      maskedAccountHolder: maskAccountHolderName(data.accountHolderName),
      bankLabel: null,
      secretPayload: {
        method: "upi",
        accountHolderName: data.accountHolderName,
        upiId: data.upiId,
      },
    };
  }

  const bankCode = data.ifsc.slice(0, 4);
  const bankLabel = data.bankName ? `${data.bankName} (${bankCode})` : bankCode;
  return {
    method: "bank",
    maskedDestination: maskBankAccount(data.accountNumber, data.ifsc),
    maskedAccountHolder: maskAccountHolderName(data.accountHolderName),
    bankLabel,
    secretPayload: {
      method: "bank",
      accountHolderName: data.accountHolderName,
      accountNumber: data.accountNumber,
      ifsc: data.ifsc,
      ...(data.bankName ? { bankName: data.bankName } : {}),
    },
  };
}

/* -------------------------------------------------------------------------- */
/* AES-256-GCM Key & Envelope Primitives                                       */
/* -------------------------------------------------------------------------- */

const KEY_BYTES = 32;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const ENVELOPE_PREFIX = "v1";

/**
 * Parses and validates the 32-byte encryption key from `PAYOUT_DETAILS_ENCRYPTION_KEY`.
 * Accepts either a 64-character hex string or a base64 string decoding to 32 bytes.
 * Fails closed on missing, wrong-length, or all-zero keys.
 */
export function parsePayoutEncryptionKey(explicitKey?: string | null): Buffer {
  const raw = (explicitKey !== undefined ? explicitKey : serverEnv.payoutDetailsEncryptionKey)?.trim();
  if (!raw) {
    throw new PayoutCryptoError(
      "encryption_unconfigured",
      "Payout destination encryption is not configured (missing PAYOUT_DETAILS_ENCRYPTION_KEY)."
    );
  }

  let keyBuffer: Buffer | null = null;

  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    keyBuffer = Buffer.from(raw, "hex");
  } else if (/^[A-Za-z0-9+/=_-]{42,46}$/.test(raw)) {
    try {
      const normalized = raw.replace(/-/g, "+").replace(/_/g, "/");
      const decoded = Buffer.from(normalized, "base64");
      if (decoded.length === KEY_BYTES) {
        keyBuffer = decoded;
      }
    } catch {
      keyBuffer = null;
    }
  }

  if (!keyBuffer || keyBuffer.length !== KEY_BYTES) {
    throw new PayoutCryptoError(
      "encryption_key_invalid",
      "PAYOUT_DETAILS_ENCRYPTION_KEY must be a valid 32-byte key (64 hex characters or 32-byte base64)."
    );
  }

  // Reject a key consisting entirely of zero bytes.
  if (keyBuffer.every((byte) => byte === 0)) {
    throw new PayoutCryptoError(
      "encryption_key_invalid",
      "PAYOUT_DETAILS_ENCRYPTION_KEY must not be an all-zero key."
    );
  }

  return keyBuffer;
}

export function buildPayoutAad(creatorId: string, method: PayoutDestinationMethod): Buffer {
  const cleanCreator = String(creatorId ?? "").trim();
  if (!cleanCreator) {
    throw new PayoutCryptoError("invalid_destination", "Creator ID is required for payout encryption AAD");
  }
  return Buffer.from(`zybble:payout-destination:v1:${cleanCreator}:${method}`, "utf8");
}

/**
 * Encrypts a validated payout destination payload using AES-256-GCM with a
 * fresh 12-byte IV, 16-byte authentication tag, and creator+method AAD.
 */
export function encryptPayoutDestination(
  payload: PayoutSecretPayload,
  options: { creatorId: string; key?: string | null }
): string {
  const validated = payoutSecretPayloadSchema.safeParse(payload);
  if (!validated.success) {
    throw new PayoutCryptoError(
      "invalid_destination",
      validated.error.issues[0]?.message ?? "Invalid payout destination payload"
    );
  }

  const key = parsePayoutEncryptionKey(options.key);
  const iv = randomBytes(IV_BYTES);
  const aad = buildPayoutAad(options.creatorId, validated.data.method);

  const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: AUTH_TAG_BYTES });
  cipher.setAAD(aad);

  const plaintext = Buffer.from(JSON.stringify(validated.data), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    ENVELOPE_PREFIX,
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

/**
 * Authenticates and decrypts an AES-256-GCM payout destination envelope.
 * Throws `PayoutCryptoError("decryption_failed")` if the envelope is malformed,
 * tampered with, encrypted under a different key, or bound to a different
 * creator/method in AAD.
 */
export function decryptPayoutDestination(
  envelope: string,
  options: {
    creatorId: string;
    expectedMethod: PayoutDestinationMethod;
    key?: string | null;
  }
): PayoutSecretPayload {
  const key = parsePayoutEncryptionKey(options.key);

  if (typeof envelope !== "string" || !envelope.startsWith(`${ENVELOPE_PREFIX}:`)) {
    throw new PayoutCryptoError("decryption_failed", "Invalid encrypted payout envelope format.");
  }

  const parts = envelope.split(":");
  if (parts.length !== 4 || parts[0] !== ENVELOPE_PREFIX) {
    throw new PayoutCryptoError("decryption_failed", "Malformed encrypted payout envelope.");
  }

  const [, ivB64, tagB64, ciphertextB64] = parts;
  if (!ivB64 || !tagB64 || !ciphertextB64) {
    throw new PayoutCryptoError("decryption_failed", "Incomplete encrypted payout envelope.");
  }

  let iv: Buffer;
  let authTag: Buffer;
  let ciphertext: Buffer;
  try {
    iv = Buffer.from(ivB64, "base64");
    authTag = Buffer.from(tagB64, "base64");
    ciphertext = Buffer.from(ciphertextB64, "base64");
  } catch {
    throw new PayoutCryptoError("decryption_failed", "Invalid base64 in encrypted payout envelope.");
  }

  if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES || ciphertext.length === 0) {
    throw new PayoutCryptoError("decryption_failed", "Invalid IV, authentication tag, or ciphertext length.");
  }

  const aad = buildPayoutAad(options.creatorId, options.expectedMethod);

  let decrypted: Buffer;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: AUTH_TAG_BYTES });
    decipher.setAAD(aad);
    decipher.setAuthTag(authTag);
    decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new PayoutCryptoError(
      "decryption_failed",
      "Could not authenticate or decrypt payout destination."
    );
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(decrypted.toString("utf8"));
  } catch {
    throw new PayoutCryptoError("decryption_failed", "Decrypted payout payload is not valid JSON.");
  }

  const validated = payoutSecretPayloadSchema.safeParse(parsedJson);
  if (!validated.success || validated.data.method !== options.expectedMethod) {
    throw new PayoutCryptoError("decryption_failed", "Decrypted payout payload failed schema validation.");
  }

  return validated.data;
}
