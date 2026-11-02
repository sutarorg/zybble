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

/**
 * Reserve a slot and mint a URL the browser can upload straight to.
 *
 * This exists because media used to be POSTed through this API, which meant
 * the bytes travelled through a serverless function. Vercel caps request
 * bodies at 4.5 MB, so a video (up to 200 MB) — or even a 5 MB image at the
 * top of LinkedIn's limit — was rejected by the platform before our code ran,
 * with a plain-text "Request Entity Too Large" the client could not parse.
 *
 * Uploading directly to storage fixes the ceiling. The server still decides
 * *whether* an upload may happen: the declared size and type are validated
 * against LinkedIn's published limits here, before any URL is minted, and the
 * row is recorded up front so an abandoned upload leaves a trace that can be
 * swept rather than an orphan nobody knows about.
 */
export async function createMediaUploadTicket(input: {
  workspaceId: string;
  userId: string;
  file: { name: string; type: string; size: number };
  postId?: string | null;
  sortOrder?: number;
}): Promise<{ assetId: string; uploadUrl: string }> {
  const kind = classifyMedia(input.file.type);
  assertWithinLimits({ kind, mimeType: input.file.type, byteSize: input.file.size });

  const admin = createSupabaseAdminClient();
  const assetId = crypto.randomUUID();
  const storagePath = `${input.workspaceId}/${assetId}.${extensionFor(input.file.type)}`;

  const { data, error } = await admin.storage
    .from(POST_MEDIA_BUCKET)
    .createSignedUploadUrl(storagePath);

  if (error || !data?.signedUrl) {
    logger.error("media.sign_failed", {
      workspaceId: input.workspaceId,
      error: error?.message,
    });
    throw new Error("Could not start the upload.");
  }

  const { error: insertError } = await admin.from("media_assets").insert({
    id: assetId,
    workspace_id: input.workspaceId,
    post_id: input.postId ?? null,
    kind,
    file_name: input.file.name.slice(0, 200),
    mime_type: input.file.type,
    byte_size: input.file.size,
    checksum_sha256: null,
    storage_path: storagePath,
    upload_status: "pending",
    sort_order: input.sortOrder ?? 0,
    created_by: input.userId,
  });

  if (insertError) {
    logger.error("media.ticket_record_failed", { error: insertError.message });
    throw new Error("Could not reserve the upload.");
  }

  return { assetId, uploadUrl: data.signedUrl };
}

/**
 * Confirm the bytes actually landed, and mark the asset usable.
 *
 * The browser could claim success without uploading anything, so the object is
 * looked up in the bucket and its size compared with what was declared when the
 * ticket was minted. `list` returns metadata only — checking a 200 MB video
 * this way costs nothing like downloading it.
 */
export async function finalizeMediaAsset(input: {
  workspaceId: string;
  assetId: string;
}): Promise<MediaAssetRow> {
  const admin = createSupabaseAdminClient();

  const { data: asset, error } = await admin
    .from("media_assets")
    .select("*")
    .eq("id", input.assetId)
    .eq("workspace_id", input.workspaceId)
    .maybeSingle();

  if (error || !asset) {
    throw new Error("That upload is no longer valid.");
  }

  const row = asset as MediaAssetRow;

  if (row.upload_status === "stored") return row;

  const directory = row.storage_path.includes("/")
    ? row.storage_path.slice(0, row.storage_path.lastIndexOf("/"))
    : "";
  const fileName = row.storage_path.slice(row.storage_path.lastIndexOf("/") + 1);

  const { data: entries, error: listError } = await admin.storage
    .from(POST_MEDIA_BUCKET)
    .list(directory, { search: fileName });

  const object = (entries ?? []).find((entry) => entry.name === fileName);

  if (listError || !object) {
    logger.warn("media.finalize_missing_object", { assetId: input.assetId });
    throw new Error("The upload did not finish. Please remove the file and try again.");
  }

  // `list` reports metadata size as a string in some client versions.
  const actualSize = Number(object.metadata?.size ?? 0);

  if (actualSize > 0 && actualSize !== row.byte_size) {
    logger.warn("media.finalize_size_mismatch", {
      assetId: input.assetId,
      declared: row.byte_size,
      actual: actualSize,
    });
    throw new Error("The uploaded file did not match what was declared. Please try again.");
  }

  const { data: updated, error: updateError } = await admin
    .from("media_assets")
    .update({ upload_status: "stored" })
    .eq("id", input.assetId)
    .eq("workspace_id", input.workspaceId)
    .select("*")
    .maybeSingle();

  if (updateError || !updated) {
    throw new Error("Could not confirm the upload.");
  }

  return updated as MediaAssetRow;
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

/**
 * Delete an asset and its object.
 *
 * Only ever removes an *unattached* asset. One that belongs to a post is the
 * post's to delete: dropping its bytes here would leave the post pointing at a
 * file that no longer exists, with nothing left to say what was lost. Detaching
 * an asset from a saved post goes through that post's own save path.
 *
 * Returns what happened so the caller can say something useful rather than
 * reporting success for a deletion that never occurred.
 */
export async function removeMediaAsset(
  workspaceId: string,
  assetId: string,
): Promise<{ deleted: boolean; reason?: "attached" | "missing" }> {
  const admin = createSupabaseAdminClient();

  const { data } = await admin
    .from("media_assets")
    .select("storage_path, post_id")
    .eq("id", assetId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!data) return { deleted: false, reason: "missing" };

  if (data.post_id) return { deleted: false, reason: "attached" };

  if (data.storage_path) {
    await admin.storage
      .from(POST_MEDIA_BUCKET)
      .remove([data.storage_path as string])
      .catch(() => undefined);
  }

  await admin.from("media_assets").delete().eq("id", assetId).eq("workspace_id", workspaceId);

  return { deleted: true };
}
