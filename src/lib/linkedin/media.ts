import { LinkedInApiError, linkedinRequestWithHeaders } from "./client";
import { LINKEDIN_ENDPOINTS, linkedinVersion, MEDIA_LIMITS, type MediaKind } from "./config";

/**
 * LinkedIn media registration + upload.
 *
 * LinkedIn never accepts a file in the create-post call. The documented
 * sequence is:
 *   1. `initializeUpload` → returns a short-lived upload URL and an asset URN;
 *   2. PUT the bytes to that URL (images/documents: one call; video: one call
 *      per part, then `finalizeUpload`);
 *   3. wait for the asset to leave PROCESSING before referencing it in a post.
 *
 * Supported here: image (JPG/PNG/GIF), video (MP4, multipart) and document
 * (PDF). Anything else is rejected before an upload is attempted, with the
 * reason surfaced to the user.
 */

export type RegisteredMedia = {
  assetUrn: string;
  uploadUrl: string;
  /** Video only. */
  uploadToken?: string;
  /** Video only, one instruction per 4 MB part. */
  uploadInstructions?: Array<{ firstByte: number; lastByte: number; uploadUrl: string }>;
  expiresAt: Date | null;
};

export class MediaValidationError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(reason);
    this.name = "MediaValidationError";
    this.reason = reason;
  }
}

export function validateMedia(input: {
  kind: MediaKind;
  mimeType: string;
  byteSize: number;
}): void {
  const limits = MEDIA_LIMITS[input.kind];

  if (!(limits.mimeTypes as readonly string[]).includes(input.mimeType)) {
    throw new MediaValidationError(
      `LinkedIn does not accept ${input.mimeType} for ${input.kind} posts. Allowed: ${limits.mimeTypes.join(", ")}.`,
    );
  }

  if (input.byteSize > limits.maxBytes) {
    const mb = (limits.maxBytes / (1024 * 1024)).toFixed(0);
    throw new MediaValidationError(`${input.kind} files must be ${mb} MB or smaller.`);
  }

  if (input.byteSize <= 0) {
    throw new MediaValidationError("The file is empty.");
  }
}

export async function initializeImageUpload(
  accessToken: string,
  ownerUrn: string,
): Promise<RegisteredMedia> {
  const { data } = await linkedinRequestWithHeaders<{
    value: { uploadUrl: string; image: string; uploadUrlExpiresAt?: number };
  }>(LINKEDIN_ENDPOINTS.images, {
    accessToken,
    method: "POST",
    query: "action=initializeUpload",
    body: { initializeUploadRequest: { owner: ownerUrn } },
  });

  return {
    assetUrn: data.value.image,
    uploadUrl: data.value.uploadUrl,
    expiresAt: data.value.uploadUrlExpiresAt
      ? new Date(data.value.uploadUrlExpiresAt)
      : null,
  };
}

export async function initializeDocumentUpload(
  accessToken: string,
  ownerUrn: string,
): Promise<RegisteredMedia> {
  const { data } = await linkedinRequestWithHeaders<{
    value: { uploadUrl: string; document: string; uploadUrlExpiresAt?: number };
  }>(LINKEDIN_ENDPOINTS.documents, {
    accessToken,
    method: "POST",
    query: "action=initializeUpload",
    body: { initializeUploadRequest: { owner: ownerUrn } },
  });

  return {
    assetUrn: data.value.document,
    uploadUrl: data.value.uploadUrl,
    expiresAt: data.value.uploadUrlExpiresAt
      ? new Date(data.value.uploadUrlExpiresAt)
      : null,
  };
}

/** LinkedIn's multipart video upload works in 4 MB parts. */
export const VIDEO_PART_SIZE = 4 * 1024 * 1024;

export async function initializeVideoUpload(
  accessToken: string,
  ownerUrn: string,
  fileSizeBytes: number,
): Promise<RegisteredMedia> {
  const { data } = await linkedinRequestWithHeaders<{
    value: {
      video: string;
      uploadToken: string;
      uploadInstructions: Array<{ firstByte: number; lastByte: number; uploadUrl: string }>;
      uploadUrlsExpireAt?: number;
    };
  }>(LINKEDIN_ENDPOINTS.videos, {
    accessToken,
    method: "POST",
    query: "action=initializeUpload",
    body: {
      initializeUploadRequest: {
        owner: ownerUrn,
        fileSizeBytes,
        uploadCaptions: false,
        uploadThumbnail: false,
      },
    },
  });

  return {
    assetUrn: data.value.video,
    uploadToken: data.value.uploadToken,
    uploadInstructions: data.value.uploadInstructions,
    uploadUrl: data.value.uploadInstructions?.[0]?.uploadUrl ?? "",
    expiresAt: data.value.uploadUrlsExpireAt
      ? new Date(data.value.uploadUrlsExpireAt)
      : null,
  };
}

/** PUT the bytes to the URL LinkedIn issued. */
export async function uploadBinary(
  accessToken: string,
  uploadUrl: string,
  bytes: Buffer | Uint8Array,
  contentType: string,
): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": contentType,
    },
    body: new Uint8Array(bytes),
  });

  if (!response.ok) {
    throw new LinkedInApiError({
      status: response.status,
      code: "MEDIA_UPLOAD_FAILED",
      message: `LinkedIn rejected the media upload (HTTP ${response.status}).`,
      kind: response.status >= 500 ? "server_error" : "validation",
    });
  }
}

export async function finalizeVideoUpload(
  accessToken: string,
  input: { videoUrn: string; uploadToken: string; uploadedPartIds: string[] },
): Promise<void> {
  await linkedinRequestWithHeaders(LINKEDIN_ENDPOINTS.videos, {
    accessToken,
    method: "POST",
    query: "action=finalizeUpload",
    body: {
      finalizeUploadRequest: {
        video: input.videoUrn,
        uploadToken: input.uploadToken,
        uploadedPartIds: input.uploadedPartIds,
      },
    },
  });
}

/**
 * Assets are PROCESSING until LinkedIn finishes transcoding/rendering.
 * Returns the terminal status or null if LinkedIn still reports PROCESSING.
 */
export async function checkAssetStatus(
  accessToken: string,
  assetUrn: string,
  kind: MediaKind,
): Promise<{ status: string; downloadUrl: string | null } | null> {
  const path = kind === "image" ? LINKEDIN_ENDPOINTS.images : kind === "video" ? LINKEDIN_ENDPOINTS.videos : LINKEDIN_ENDPOINTS.documents;

  try {
    const { data } = await linkedinRequestWithHeaders<{
      status?: string;
      downloadUrl?: string;
    }>(path, {
      accessToken,
      method: "GET",
      query: `ids=List(${encodeURIComponent(assetUrn)})`,
      retries: 1,
    });

    const results = (data as unknown as {
      results?: Record<string, { status?: string; downloadUrl?: string }>;
    })?.results;

    const entry = results?.[assetUrn] ?? (data as { status?: string; downloadUrl?: string });

    return {
      status: entry?.status ?? "UNKNOWN",
      downloadUrl: entry?.downloadUrl ?? null,
    };
  } catch (error) {
    // A versioned GET on /rest/images needs more than w_member_social; a 403
    // here is expected for member tokens and is not a failure to publish.
    if (error instanceof LinkedInApiError && (error.status === 403 || error.status === 404)) {
      return null;
    }
    throw error;
  }
}

export function assetReady(status: string | null | undefined): boolean {
  return status === "AVAILABLE";
}

export function assetFailed(status: string | null | undefined): boolean {
  return status === "PROCESSING_FAILED";
}

export function linkedinApiVersion(): string {
  return linkedinVersion();
}
