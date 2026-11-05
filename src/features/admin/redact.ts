/**
 * Redaction for admin-facing JSON.
 *
 * `audit_logs.metadata` and `webhook_events.payload` are free-form JSONB
 * written by many different call sites. Some of them legitimately carry
 * provider identifiers, and a future one could carry more. Rather than
 * trusting each writer, the admin layer removes anything that looks
 * credential-shaped before it leaves the server.
 *
 * Two deliberate choices:
 *
 *  - **Keys are removed, not masked.** A masked value still reveals that the
 *    key existed and roughly how long the value was, which is more than an
 *    operator needs.
 *  - **The rules match `src/lib/logger.ts`.** Consistency matters more than
 *    originality here: one redaction vocabulary across the codebase is easier
 *    to audit than two that differ in a corner case.
 */

const SENSITIVE_KEY =
  /token|secret|password|authorization|cookie|api[-_]?key|signature|bearer|otp|refresh|ciphertext|private/i;

/** Very long opaque strings are almost always credentials or JWTs. */
const OPAQUE_VALUE = /^[A-Za-z0-9_-]{60,}$/;

const MAX_DEPTH = 5;
const MAX_KEYS = 40;

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export function redactMetadata(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object" || Array.isArray(value)) return null;

  const output = scrub(value as Record<string, unknown>, 0);
  return Object.keys(output).length > 0 ? output : null;
}

function scrub(input: Record<string, unknown>, depth: number): Record<string, unknown> {
  const output: Record<string, unknown> = {};

  for (const [key, entry] of Object.entries(input).slice(0, MAX_KEYS)) {
    if (SENSITIVE_KEY.test(key)) continue;
    output[key] = scrubValue(entry, depth + 1);
  }

  return output;
}

function scrubValue(value: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH) return "[omitted]";

  if (typeof value === "string") {
    if (value.length > 200 || OPAQUE_VALUE.test(value)) return "[redacted]";
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((entry) => scrubValue(entry, depth + 1));
  }

  if (typeof value === "object") {
    return scrub(value as Record<string, unknown>, depth + 1);
  }

  return "[omitted]";
}

/**
 * A short, redacted error line from a webhook row.
 *
 * The raw `error` column can contain a provider message with identifiers in
 * it. Truncating keeps the panel readable and caps how much of anything can
 * reach the browser.
 */
export function redactError(value: string | null | undefined): string | null {
  if (!value) return null;

  const line = value.split("\n")[0]?.trim() ?? "";
  if (!line) return null;

  return line.length > 160 ? `${line.slice(0, 160)}…` : line;
}
