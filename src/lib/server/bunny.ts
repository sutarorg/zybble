/**
 * Bunny Stream integration: server-side video creation, pre-signed resumable
 * uploads, processing-state webhooks and token-authenticated playback.
 *
 * The library API key never leaves the server. Uploads use Bunny's documented
 * pre-signed TUS flow (`SHA256(library_id + api_key + expiration + video_id)`),
 * so the browser uploads bytes straight to Bunny without ever seeing the key.
 */

import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";

export const BUNNY_VIDEO_BASE = "https://video.bunnycdn.com";
export const BUNNY_TUS_ENDPOINT = "https://video.bunnycdn.com/tusupload";
export const BUNNY_PLAYER_BASE = "https://player.mediadelivery.net";

/** Playback links are signed for 15 minutes. */
export const PLAYBACK_TTL_SECONDS = 15 * 60;
/** Pre-signed upload grants last 60 minutes. */
export const UPLOAD_GRANT_TTL_SECONDS = 60 * 60;

export class BunnyNotConfiguredError extends Error {
  constructor() {
    super("Bunny Stream is not configured");
    this.name = "BunnyNotConfiguredError";
  }
}

function requireConfig() {
  if (!serverEnv.bunnyLibraryId || !serverEnv.bunnyApiKey) throw new BunnyNotConfiguredError();
}

/* -------------------------------------------------------------------------- */
/* Create Video API                                                            */
/* -------------------------------------------------------------------------- */

export interface BunnyVideo {
  guid: string;
  libraryId: number;
  title: string;
  status: number;
  duration?: number;
  size?: number;
  encoding?: { status?: string; progress?: number };
}

/**
 * `POST /library/:libraryId/videos` — creates the upload slot. Bunny requires
 * this before any bytes are sent, for both the direct HTTP PUT and the TUS
 * pre-signed flow.
 */
export async function createVideo(title: string, collectionId?: string): Promise<BunnyVideo> {
  requireConfig();
  const response = await fetch(`${BUNNY_VIDEO_BASE}/library/${serverEnv.bunnyLibraryId}/videos`, {
    method: "POST",
    headers: {
      AccessKey: serverEnv.bunnyApiKey as string,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title, ...(collectionId ? { collectionId } : {}) }),
  });

  if (!response.ok) {
    throw new Error(`Bunny createVideo failed with status ${response.status}`);
  }
  const json = (await response.json()) as Record<string, unknown>;
  return {
    guid: String(json.guid),
    libraryId: Number(json.videoLibraryId ?? serverEnv.bunnyLibraryId),
    title: String(json.title ?? title),
    status: Number(json.status ?? 0),
    duration: json.duration === undefined ? undefined : Number(json.duration),
    size: json.size === undefined ? undefined : Number(json.size),
    encoding: json.encoding as BunnyVideo["encoding"],
  };
}

export async function fetchVideo(videoId: string): Promise<BunnyVideo> {
  requireConfig();
  const response = await fetch(`${BUNNY_VIDEO_BASE}/library/${serverEnv.bunnyLibraryId}/videos/${videoId}`, {
    headers: { AccessKey: serverEnv.bunnyApiKey as string, Accept: "application/json" },
  });
  if (response.status === 404) throw new Error("Video not found");
  if (!response.ok) throw new Error(`Bunny fetchVideo failed with status ${response.status}`);
  const json = (await response.json()) as Record<string, unknown>;
  return {
    guid: String(json.guid ?? videoId),
    libraryId: Number(json.videoLibraryId ?? serverEnv.bunnyLibraryId),
    title: String(json.title ?? ""),
    status: Number(json.status ?? 0),
    duration: json.duration === undefined ? undefined : Number(json.duration),
    size: json.size === undefined ? undefined : Number(json.size),
    encoding: json.encoding as BunnyVideo["encoding"],
  };
}

/**
 * `DELETE /library/:libraryId/videos/:videoId` — used when a lesson is deleted
 * or a video is replaced. Failures are non-fatal for the caller: the orphan is
 * reported in the lesson row rather than blocking the lesson edit.
 */
export async function deleteVideo(videoId: string): Promise<boolean> {
  requireConfig();
  const response = await fetch(
    `${BUNNY_VIDEO_BASE}/library/${serverEnv.bunnyLibraryId}/videos/${videoId}`,
    { method: "DELETE", headers: { AccessKey: serverEnv.bunnyApiKey as string } }
  );
  return response.ok || response.status === 404;
}

/* -------------------------------------------------------------------------- */
/* Pre-signed TUS upload                                                       */
/* -------------------------------------------------------------------------- */

export interface UploadGrant {
  videoId: string;
  libraryId: string;
  endpoint: string;
  expiration: number;
  signature: string;
}

/**
 * Builds the browser-safe upload grant.
 *
 * Signature per Bunny's documentation:
 *   `SHA256(library_id + api_key + expiration_time + video_id)` (hex).
 * The grant is scoped to one video that this server just created, so it cannot
 * be reused to write into somebody else's upload slot.
 */
export function buildUploadGrant(
  videoId: string,
  options: { ttlSeconds?: number; now?: number } = {}
): UploadGrant {
  requireConfig();
  const now = options.now ?? Date.now();
  const expiration = Math.floor(now / 1000) + (options.ttlSeconds ?? UPLOAD_GRANT_TTL_SECONDS);
  const libraryId = serverEnv.bunnyLibraryId as string;
  const signature = createHash("sha256")
    .update(`${libraryId}${serverEnv.bunnyApiKey}${expiration}${videoId}`)
    .digest("hex");
  return { videoId, libraryId, endpoint: BUNNY_TUS_ENDPOINT, expiration, signature };
}

/* -------------------------------------------------------------------------- */
/* Webhooks                                                                    */
/* -------------------------------------------------------------------------- */

export interface BunnyWebhookEvent {
  VideoLibraryId: number;
  VideoGuid: string;
  Status: number;
}

/** Bunny's documented stream status codes. */
export const BUNNY_STATUS = {
  QUEUED: 0,
  PROCESSING: 1,
  ENCODING: 2,
  FINISHED: 3,
  RESOLUTION_FINISHED: 4,
  FAILED: 5,
  PRESIGNED_UPLOAD_STARTED: 6,
  PRESIGNED_UPLOAD_FINISHED: 7,
  PRESIGNED_UPLOAD_FAILED: 8,
  CAPTIONS_GENERATED: 9,
  TITLE_OR_DESCRIPTION_GENERATED: 10,
} as const;

export type EncodingState = "uploading" | "processing" | "ready" | "error";

/**
 * Maps Bunny's numeric status onto Zybble's stored encoding state.
 * Only `Finished`/`Resolution finished` mark a video playable — a video is
 * never treated as ready merely because bytes were accepted.
 */
export function mapBunnyStatus(status: number): EncodingState {
  switch (status) {
    case BUNNY_STATUS.PRESIGNED_UPLOAD_STARTED:
      return "uploading";
    case BUNNY_STATUS.PRESIGNED_UPLOAD_FINISHED:
    case BUNNY_STATUS.QUEUED:
    case BUNNY_STATUS.PROCESSING:
    case BUNNY_STATUS.ENCODING:
      return "processing";
    case BUNNY_STATUS.FINISHED:
    case BUNNY_STATUS.RESOLUTION_FINISHED:
      return "ready";
    case BUNNY_STATUS.FAILED:
    case BUNNY_STATUS.PRESIGNED_UPLOAD_FAILED:
      return "error";
    default:
      return "processing";
  }
}

export function isBunnyStatusReady(status: number): boolean {
  return mapBunnyStatus(status) === "ready";
}

/**
 * Validates a Bunny Stream webhook.
 * Signing secret is the library's Read-Only API key; the comparison is constant
 * time and uses the exact raw body.
 */
export function verifyBunnyWebhookSignature(input: {
  rawBody: string;
  signature: string | null | undefined;
  version: string | null | undefined;
  algorithm: string | null | undefined;
  secret: string | undefined;
}): boolean {
  if (input.version !== "v1") return false;
  if (input.algorithm !== "hmac-sha256") return false;
  if (!input.signature || !input.secret) return false;
  if (!/^[0-9a-f]{64}$/.test(input.signature)) return false;

  const expected = createHmac("sha256", input.secret).update(input.rawBody, "utf8").digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(input.signature, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/* -------------------------------------------------------------------------- */
/* Playback                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Builds a token-authenticated embed URL.
 *
 * Bunny's documented procedure: `SHA256_HEX(token_security_key + video_id + expiration)`.
 * The expiration is UNIX seconds. The token key is server-only.
 */
export function buildPlaybackUrl(
  videoId: string,
  options: { ttlSeconds?: number; now?: number } = {}
): { url: string; expires: number } {
  if (!serverEnv.bunnyTokenAuthKey) throw new BunnyNotConfiguredError();
  const now = options.now ?? Date.now();
  const expires = Math.floor(now / 1000) + (options.ttlSeconds ?? PLAYBACK_TTL_SECONDS);
  const token = createHash("sha256")
    .update(`${serverEnv.bunnyTokenAuthKey}${videoId}${expires}`)
    .digest("hex");
  const url =
    `${BUNNY_PLAYER_BASE}/embed/${serverEnv.bunnyLibraryId}/${videoId}` +
    `?token=${token}&expires=${expires}`;
  return { url, expires };
}

/** The plain `player.mediadelivery.net` iframe origin, for CSP allow-listing. */
export const bunnyPlaybackOrigin = BUNNY_PLAYER_BASE;

/* -------------------------------------------------------------------------- */
/* Upload validation                                                           */
/* -------------------------------------------------------------------------- */

export const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"];
/** 2 GB — Bunny's own ceiling for a single HTTP upload. */
export const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;

export function validateVideoFile(input: { type: string; size: number }): string | null {
  if (!ALLOWED_VIDEO_TYPES.includes(input.type.toLowerCase())) {
    return "Only MP4, MOV, WebM or M4V video files are supported";
  }
  if (!Number.isFinite(input.size) || input.size <= 0) return "The selected file is empty";
  if (input.size > MAX_VIDEO_BYTES) return "Videos must be 2 GB or smaller";
  return null;
}
