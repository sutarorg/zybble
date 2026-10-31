import { createHash } from "node:crypto";
import { MediaValidationError } from "@/lib/linkedin/media";
import { MEDIA_LIMITS, type MediaKind } from "@/lib/linkedin/config";
import { logger } from "@/lib/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { MediaAssetRow } from "@/lib/supabase/database.types";

/**
 * Media handling.
 *
 * Files live in the private `post-media` bucket under
 * `<workspace_id>/<post_id>/<asset_id>.<ext>`. Storage policies key off the
 * first path segment, so another workspace cannot read or overwrite them.
 *
 * Uploads are validated twice, on purpose:
 *  1. here, against the limits LinkedIn actually enforces (so the user learns
 *     immediately rather than at publish time);
 *  2. again in the publish pipeline, because the file may have been stored
 *     before a limit changed.
 */

export const POST_MEDIA_BUCKET = "post-media";

export type IncomingFile = {
  name: string;
  type: string;
  size: number;
  bytes: ArrayBuffer | Uint8Array;
};

export function classifyMedia(mimeType: string): MediaKind {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType === "application/pdf") return "document";
  throw new MediaValidationError(`Unsupported file type: ${mimeType}`);
}

export function assertWithinLimits(input: {
  kind: MediaKind;
  mimeType: string;
  byteSize: number;
}): void {
  const limits = MEDIA_LIMITS[input.kind];

  if (!(limits.mimeTypes as readonly string[]).includes(input.mimeType)) {
    throw new MediaValidationError(
      `LinkedIn accepts ${limits.mimeTypes.join(", ")} for ${input.kind} posts — ${input.mimeType} is not supported. ${limits.note}`,
    );
  }

  if (input.byteSize > limits.maxBytes) {
    const mb = Math.round(limits.maxBytes / (1024 * 1024));
    throw new MediaValidationError(
      `${input.kind} files must be ${mb} MB or smaller. ${limits.note}`,
    );
  }

  if (input.byteSize <= 0) {
    throw new MediaValidationError("The file is empty.");
  }
}

function extensionFor(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "application/pdf": "pdf",
  };
  return map[mimeType] ?? "bin";
}

export type StoredMedia = {
  asset: MediaAssetRow;
  checksum: string;
};

/**
 * Store an uploaded file.
 *
 * The object is addressed by workspace and asset id only —
 * `<workspace_id>/<asset_id>.<ext>` — because media is uploaded *before* the
 * post it belongs to exists (the composer uploads as you type). The asset row is
 * attached to a post later by `attachMedia`, and the object never has to move.
 * The bucket is private and every policy re-derives the workspace from the first
 * path segment, so the missing post folder costs nothing in isolation.
 */
export async function storeMediaAsset(input: {
  workspaceId: string;
  userId: string;
  file: IncomingFile;
  sortOrder?: number;
  /** Optional: attach straight away when the post already exists. */
  postId?: string | null;
}): Promise<StoredMedia> {
  const kind = classifyMedia(input.file.type);
  assertWithinLimits({ kind, mimeType: input.file.type, byteSize: input.file.size });

  const admin = createSupabaseAdminClient();
  const body = new Uint8Array(
    input.file.bytes instanceof Uint8Array ? input.file.bytes : new Uint8Array(input.file.bytes),
  );

  const checksum = createHash("sha256").update(body).digest("hex");
  const assetId = crypto.randomUUID();
  const storagePath = `${input.workspaceId}/${assetId}.${extensionFor(input.file.type)}`;

  const { error: uploadError } = await admin.storage
    .from(POST_MEDIA_BUCKET)
    .upload(storagePath, body, {
      contentType: input.file.type,
      // `upsert: false` means a collision (path replay) fails loudly.
      upsert: false,
      cacheControl: "3600",
    });

  if (uploadError) {
    logger.error("media.upload_failed", {
      workspaceId: input.workspaceId,
      error: uploadError.message,
    });
    throw new Error(`Could not store the file: ${uploadError.message}`);
  }

  const { data, error } = await admin
    .from("media_assets")
    .insert({
      id: assetId,
      workspace_id: input.workspaceId,
      post_id: input.postId ?? null,
      kind,
      file_name: input.file.name.slice(0, 200),
      mime_type: input.file.type,
      byte_size: input.file.size,
      checksum_sha256: checksum,
      storage_path: storagePath,
      upload_status: "stored",
      sort_order: input.sortOrder ?? 0,
      created_by: input.userId,
    })
    .select("*")
    .single();

  if (error || !data) {
    // Do not leave an orphaned object in the bucket.
    await admin.storage.from(POST_MEDIA_BUCKET).remove([storagePath]).catch(() => undefined);
    logger.error("media.record_failed", { error: error?.message });
    throw new Error("Could not record the uploaded file.");
  }

  return { asset: data as MediaAssetRow, checksum };
}

/** Download the bytes of a stored asset. Server-side only. */
export async function loadMediaBytes(asset: MediaAssetRow): Promise<Buffer> {
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin.storage
    .from(POST_MEDIA_BUCKET)
    .download(asset.storage_path);

  if (error || !data) {
    logger.error("media.download_failed", {
      assetId: asset.id,
      error: error?.message,
    });
    throw new Error("Could not read the stored media file.");
  }

  return Buffer.from(await data.arrayBuffer());
}

/** Short-lived URL for the composer preview. 60 seconds, private bucket. */
export async function createMediaPreviewUrl(asset: MediaAssetRow): Promise<string | null> {
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin.storage
    .from(POST_MEDIA_BUCKET)
    .createSignedUrl(asset.storage_path, 60);

  if (error || !data) return null;
  return data.signedUrl;
}

export async function removeMediaAsset(
  workspaceId: string,
  assetId: string,
): Promise<void> {
  const admin = createSupabaseAdminClient();

  const { data } = await admin
    .from("media_assets")
    .select("storage_path")
    .eq("id", assetId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (data?.storage_path) {
    await admin.storage
      .from(POST_MEDIA_BUCKET)
      .remove([data.storage_path as string])
      .catch(() => undefined);
  }

  await admin.from("media_assets").delete().eq("id", assetId).eq("workspace_id", workspaceId);
}
