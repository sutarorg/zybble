import { S3Client } from "@aws-sdk/client-s3";
import { env, isR2Configured } from "@/lib/env";
import { IntegrationNotConfiguredError } from "@/lib/errors";

/**
 * Cloudflare R2, spoken over its S3-compatible API.
 *
 * R2 implements the S3 protocol, so the standard AWS SDK is used rather than a
 * Cloudflare-specific dependency — one client, no extra abstraction. Four
 * details are R2-specific and easy to get wrong:
 *
 *  - the endpoint is account-scoped,
 *    `https://<account_id>.r2.cloudflarestorage.com`;
 *  - the region is literally `auto`. Supplying a real region such as `us-east-1`
 *    makes every request fail signature validation;
 *  - `forcePathStyle` is required, because the account endpoint does not
 *    resolve a virtual-hosted `<bucket>.<account>.r2.cloudflarestorage.com`;
 *  - SigV4 is mandatory — R2 rejects the older SigV2 outright.
 *
 * The client is created lazily and memoised: `next build` must succeed on a
 * machine with no credentials, so nothing here reads configuration at module
 * load.
 */

let cached: S3Client | null = null;

export function r2Endpoint(): string {
  return `https://${env().R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
}

export function r2Bucket(): string {
  return env().R2_BUCKET;
}

/**
 * The bucket, or a clear error.
 *
 * Every storage helper funnels through here so that a deployment missing
 * credentials reports one sentence naming the missing variables, instead of
 * leaking a raw AWS SDK signature error into a user-facing form.
 */
export function r2Client(): S3Client {
  if (!isR2Configured()) {
    throw new IntegrationNotConfiguredError("Cloudflare R2");
  }

  if (cached) return cached;

  cached = new S3Client({
    region: "auto",
    endpoint: r2Endpoint(),
    forcePathStyle: true,
    credentials: {
      accessKeyId: env().R2_ACCESS_KEY_ID as string,
      secretAccessKey: env().R2_SECRET_ACCESS_KEY as string,
    },
  });

  return cached;
}

/**
 * Base URL for plain (unsigned) read links, or null when the bucket is private.
 *
 * Only set when `R2_PUBLIC_URL` is configured, which is a deliberate opt-in:
 * it implies the objects are world-readable, so it must never be assumed.
 */
export function r2PublicBaseUrl(): string | null {
  const value = env().R2_PUBLIC_URL;
  return value ? value.replace(/\/$/, "") : null;
}

/** Test hook: forget the memoised client so a new env can take effect. */
export function resetR2Client(): void {
  cached = null;
}
