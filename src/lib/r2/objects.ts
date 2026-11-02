import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Bucket, r2Client, r2PublicBaseUrl } from "@/lib/r2/client";
import { logger } from "@/lib/logger";

/**
 * Object primitives for media storage on Cloudflare R2.
 *
 * Every path into the bucket goes through here, so the rules live in one place:
 *
 *  - **The bucket is private by default.** Reads are signed and short-lived
 *    unless `R2_PUBLIC_URL` is set, which is an explicit opt-in to public read.
 *  - **Uploads are presigned, not proxied.** A serverless request body is
 *    capped at 4.5 MB, so the browser has to talk to storage directly for
 *    anything larger.
 *  - **Presigned PUT signs `content-type`.** The browser must send exactly that
 *    header or R2 rejects the request with a signature mismatch — which is why
 *    the content type is passed in here rather than left to the caller.
 */

/** How long a browser has to complete a direct upload. 15 minutes. */
export const UPLOAD_URL_TTL_SECONDS = 900;

/** Preview links: long enough to render an image, not long enough to share. */
export const DOWNLOAD_URL_TTL_SECONDS = 60;

/** `Cache-Control` applied to stored objects. */
const OBJECT_CACHE_CONTROL = "public, max-age=3600";

function normaliseKey(key: string): string {
  // A leading slash would create an empty first path segment, which quietly
  // breaks the `<workspace_id>/…` prefix scheme every listing relies on.
  return key.startsWith("/") ? key.slice(1) : key;
}

/**
 * A presigned PUT the browser can upload straight to.
 *
 * `content-type` is signed, so the caller must send that exact header. No
 * `content-length` is signed on purpose: browsers do not reliably send it for
 * a Blob body, and pinning it would make every upload fail rather than most.
 * The real size is verified afterwards with `headObject`.
 */
export async function createUploadUrl(input: {
  key: string;
  contentType: string;
  expiresIn?: number;
}): Promise<string> {
  return getSignedUrl(
    r2Client(),
    new PutObjectCommand({
      Bucket: r2Bucket(),
      Key: normaliseKey(input.key),
      ContentType: input.contentType,
      CacheControl: OBJECT_CACHE_CONTROL,
    }),
    { expiresIn: input.expiresIn ?? UPLOAD_URL_TTL_SECONDS },
  );
}

export type ObjectHead = { exists: boolean; size: number | null };

/**
 * Does the object exist, and how big is it?
 *
 * A HEAD costs nothing like a download, which matters when confirming a 200 MB
 * video. Used by the upload-finalise step to prove the bytes really arrived
 * before an asset can be attached to a post.
 */
export async function headObject(key: string): Promise<ObjectHead> {
  try {
    const response = await r2Client().send(
      new HeadObjectCommand({ Bucket: r2Bucket(), Key: normaliseKey(key) }),
    );

    return { exists: true, size: response.ContentLength ?? null };
  } catch (error) {
    // NotFound / 404 is the expected outcome for an upload that never landed;
    // anything else is a real fault and is logged rather than swallowed.
    if (isNotFound(error)) return { exists: false, size: null };

    logger.error("r2.head_failed", {
      key: normaliseKey(key),
      error: error instanceof Error ? error.message : "unknown",
    });
    throw error;
  }
}

/** Download the bytes. Server-side only — used to hand media to LinkedIn. */
export async function getObjectBytes(key: string): Promise<Buffer> {
  const response = await r2Client().send(
    new GetObjectCommand({ Bucket: r2Bucket(), Key: normaliseKey(key) }),
  );

  if (!response.Body) {
    throw new Error("The stored file was empty.");
  }

  // Readable -> Buffer. AWS SDK v3 returns a stream on Node.
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

/**
 * A URL the browser can render.
 *
 * Signed and short-lived by default. When `R2_PUBLIC_URL` is configured the
 * plain link is returned instead, because the objects are already readable —
 * and an unsigned link lets the browser cache previews.
 */
export async function createDownloadUrl(input: {
  key: string;
  expiresIn?: number;
}): Promise<string> {
  const key = normaliseKey(input.key);
  const publicBase = r2PublicBaseUrl();

  if (publicBase) return `${publicBase}/${key}`;

  return getSignedUrl(r2Client(), new GetObjectCommand({ Bucket: r2Bucket(), Key: key }), {
    expiresIn: input.expiresIn ?? DOWNLOAD_URL_TTL_SECONDS,
  });
}

/** True when previews are plain links rather than signed ones. */
export function usesPublicUrls(): boolean {
  return r2PublicBaseUrl() !== null;
}

export async function deleteObject(key: string): Promise<void> {
  await r2Client().send(
    new DeleteObjectCommand({ Bucket: r2Bucket(), Key: normaliseKey(key) }),
  );
}

/**
 * Bulk delete. R2 accepts 1000 keys per call, so this chunks.
 *
 * Used when a workspace is purged, where a single workspace can hold hundreds
 * of objects.
 */
export async function deleteObjects(keys: string[]): Promise<{ deleted: number }> {
  const normalised = keys.map(normaliseKey);
  let deleted = 0;

  for (let index = 0; index < normalised.length; index += 1000) {
    const batch = normalised.slice(index, index + 1000).map((key) => ({ Key: key }));

    if (batch.length === 0) continue;

    const response = await r2Client().send(
      new DeleteObjectsCommand({ Bucket: r2Bucket(), Delete: { Objects: batch } }),
    );

    deleted += response.Deleted?.length ?? 0;

    if (response.Errors?.length) {
      logger.error("r2.delete_partial_failure", {
        failed: response.Errors.length,
        first: response.Errors[0]?.Message ?? "unknown",
      });
    }
  }

  return { deleted };
}

/** Every key under a prefix, following pagination to the end. */
export async function listKeys(prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await r2Client().send(
      new ListObjectsV2Command({
        Bucket: r2Bucket(),
        Prefix: normaliseKey(prefix),
        ContinuationToken: continuationToken,
      }),
    );

    for (const object of response.Contents ?? []) {
      if (object.Key) keys.push(object.Key);
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);

  return keys;
}

/**
 * Server-side upload.
 *
 * Only for small, trusted payloads where a direct upload is not worth the
 * round trip. Anything user-supplied goes through `createUploadUrl` instead,
 * because this path is bound by the serverless request-body limit.
 */
export async function putObject(input: {
  key: string;
  body: Uint8Array;
  contentType: string;
}): Promise<void> {
  await r2Client().send(
    new PutObjectCommand({
      Bucket: r2Bucket(),
      Key: normaliseKey(input.key),
      Body: input.body,
      ContentType: input.contentType,
      CacheControl: OBJECT_CACHE_CONTROL,
    }),
  );
}

function isNotFound(error: unknown): boolean {
  const name = (error as { name?: string; $metadata?: { httpStatusCode?: number } } | null)?.name;
  const status = (error as { $metadata?: { httpStatusCode?: number } } | null)?.$metadata
    ?.httpStatusCode;

  return name === "NotFound" || name === "NoSuchKey" || status === 404;
}
