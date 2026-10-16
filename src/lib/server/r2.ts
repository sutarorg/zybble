/**
 * Cloudflare R2 storage for course resources, thumbnails and profile images.
 *
 * The bucket stays **private**. Nothing is served from a public URL: downloads
 * are issued as short-lived presigned URLs *after* an entitlement check, and
 * object keys are always built server-side from a validated UUID so a caller
 * can never steer a write or read outside their own namespace.
 */

import "server-only";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createHash } from "node:crypto";
// Shared with the browser pre-checks so the client and the server can never
// advertise different limits. The server remains the authority.
import {
  ALLOWED_RESOURCE_TYPES,
  ALLOWED_IMAGE_TYPES,
  MAX_RESOURCE_BYTES,
  MAX_IMAGE_BYTES,
} from "@/lib/upload-limits";
import { serverEnv } from "@/lib/env";

export class R2NotConfiguredError extends Error {
  constructor() {
    super("Cloudflare R2 is not configured");
    this.name = "R2NotConfiguredError";
  }
}

let cached: S3Client | null = null;

export function getR2(): S3Client {
  const { r2Endpoint, r2AccessKeyId, r2SecretAccessKey } = serverEnv;
  if (!r2Endpoint || !r2AccessKeyId || !r2SecretAccessKey || !serverEnv.r2Bucket) {
    throw new R2NotConfiguredError();
  }
  if (!cached) {
    cached = new S3Client({
      region: "auto",
      endpoint: r2Endpoint,
      credentials: { accessKeyId: r2AccessKeyId, secretAccessKey: r2SecretAccessKey },
    });
  }
  return cached;
}

/* -------------------------------------------------------------------------- */
/* Object keys                                                                */
/* -------------------------------------------------------------------------- */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Strips every path-traversal and control character from a user-supplied name. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  return (
    base
      .normalize("NFKD")
      .replace(/[^\w.\- ]+/g, "_")
      .replace(/\s+/g, "-")
      .replace(/^\.+/, "")
      .slice(0, 120) || "file"
  );
}

/**
 * Builds a server-controlled object key.
 * The owner id comes from the verified session, never from the request body.
 */
export function buildObjectKey(params: {
  ownerId: string;
  courseId?: string | null;
  kind: "thumbnail" | "resource" | "avatar";
  fileName: string;
}): string {
  if (!UUID_RE.test(params.ownerId)) throw new Error("Invalid owner id");
  if (params.courseId && !UUID_RE.test(params.courseId)) throw new Error("Invalid course id");
  const scope = params.courseId ? `courses/${params.courseId}` : `creators/${params.ownerId}`;
  const random = createHash("sha256")
    .update(`${params.ownerId}:${params.fileName}:${Date.now()}:${Math.random()}`)
    .digest("hex")
    .slice(0, 16);
  return `${scope}/${params.kind}/${random}-${safeFileName(params.fileName)}`;
}

/* -------------------------------------------------------------------------- */
/* Uploads                                                                     */
/* -------------------------------------------------------------------------- */

export { ALLOWED_RESOURCE_TYPES, ALLOWED_IMAGE_TYPES, MAX_RESOURCE_BYTES, MAX_IMAGE_BYTES };

export type UploadKind = "thumbnail" | "resource" | "avatar";

const LIMITS: Record<UploadKind, { types: string[]; max: number }> = {
  thumbnail: { types: ALLOWED_IMAGE_TYPES, max: MAX_IMAGE_BYTES },
  avatar: { types: ALLOWED_IMAGE_TYPES, max: MAX_IMAGE_BYTES },
  resource: { types: ALLOWED_RESOURCE_TYPES, max: MAX_RESOURCE_BYTES },
};

export function validateUpload(kind: UploadKind, input: { type: string; size: number }): string | null {
  const limits = LIMITS[kind];
  if (!limits.types.includes(input.type.toLowerCase())) {
    return `Unsupported file type for ${kind}`;
  }
  if (!Number.isFinite(input.size) || input.size <= 0) return "The selected file is empty";
  if (input.size > limits.max) {
    return `File exceeds the ${Math.round(limits.max / (1024 * 1024))} MB limit`;
  }
  return null;
}

/**
 * Uploads bytes the server received directly (small images, resources that fit
 * inside the platform request limit).
 */
export async function putObject(params: {
  key: string;
  body: Uint8Array | Buffer | string;
  contentType: string;
  sizeBytes: number;
}): Promise<void> {
  await getR2().send(
    new PutObjectCommand({
      Bucket: serverEnv.r2Bucket,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
      ContentLength: params.sizeBytes,
      CacheControl: "private, max-age=0, no-store",
    })
  );
}

export async function headObject(key: string) {
  return getR2().send(new HeadObjectCommand({ Bucket: serverEnv.r2Bucket, Key: key }));
}

export async function getObjectStream(key: string) {
  return getR2().send(new GetObjectCommand({ Bucket: serverEnv.r2Bucket, Key: key }));
}

export async function deleteObject(key: string): Promise<void> {
  await getR2().send(new DeleteObjectCommand({ Bucket: serverEnv.r2Bucket, Key: key }));
}

/* -------------------------------------------------------------------------- */
/* Presigned URLs                                                              */
/* -------------------------------------------------------------------------- */

/** Download links are valid for 10 minutes. */
export const DOWNLOAD_URL_TTL_SECONDS = 10 * 60;
/** Direct upload links are valid for 15 minutes. */
export const UPLOAD_URL_TTL_SECONDS = 15 * 60;

/**
 * Issues a short-lived presigned GET. Call this **only after** checking that the
 * caller holds an entitlement to the course that owns the object.
 */
export async function createPresignedDownloadUrl(key: string, fileName: string): Promise<string> {
  const safe = safeFileName(fileName);
  return getSignedUrl(
    getR2(),
    new GetObjectCommand({
      Bucket: serverEnv.r2Bucket,
      Key: key,
      // Forces a download with the original filename instead of inline display.
      ResponseContentDisposition: `attachment; filename="${safe}"`,
    }),
    { expiresIn: DOWNLOAD_URL_TTL_SECONDS }
  );
}

/** Issues a short-lived presigned PUT for browser-direct uploads. */
export async function createPresignedUploadUrl(
  key: string,
  contentType: string,
  sizeBytes: number
): Promise<string> {
  return getSignedUrl(
    getR2(),
    new PutObjectCommand({
      Bucket: serverEnv.r2Bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: sizeBytes,
    }),
    { expiresIn: UPLOAD_URL_TTL_SECONDS }
  );
}

/* -------------------------------------------------------------------------- */
/* Serving public-ish images through the app                                    */
/* -------------------------------------------------------------------------- */
