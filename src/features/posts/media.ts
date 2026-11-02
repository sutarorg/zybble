import { createHash } from "node:crypto";
import { MediaValidationError } from "@/lib/linkedin/media";
import { MEDIA_LIMITS, type MediaKind } from "@/lib/linkedin/config";
import { logger } from "@/lib/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  createDownloadUrl,
  createUploadUrl,
  deleteObject,
  getObjectBytes,
  headObject,
  putObject,
} from "@/lib/r2/objects";
import type { MediaAssetRow } from "@/lib/supabase/database.types";

/**
 * Media handling.
 *
 * Bytes live in **Cloudflare R2**, reached over its S3-compatible API; only the
 * metadata lives in Postgres. The split matters: R2 is where the object is,
 * `public.media_assets` is the record of it, and nothing here assumes the two
 * are the same system.
 *
 * Objects are addressed `<workspace_id>/<asset_id>.<ext>`. Media is uploaded
 * *before* the post it belongs to exists (the composer uploads as you type), so
 * the asset row is attached to a post later and the object never has to move.
 * Keeping the workspace id as the first path segment means a whole workspace's
 * media can be listed and deleted by prefix — which is what account erasure
 * relies on.
 *
 * The bucket is private. Access is granted by short-lived signed URLs minted
 * here, so a workspace can never read or overwrite another's files, and a
 * preview link expires before it can be meaningfully shared.
 *
 * Uploads are validated twice, on purpose:
 *  1. here, against the limits LinkedIn actually enforces (so the user learns
 *     immediately rather than at publish time);
 *  2. again in the publish pipeline, because the file may have been stored
 *     before a limit changed.
 */

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

/** Object key for a new asset. Deterministic from ids, so it can be rebuilt. */
function keyFor(workspaceId: string, assetId: string, mimeType: string): string {
  return `${workspaceId}/${assetId}.${extensionFor(mimeType)}`;
}

export type StoredMedia = {
  asset: MediaAssetRow;
  checksum: string;
};

/**
 * Store an uploaded file.
 *
 * Writes the bytes from the server, so it is only suitable for small payloads —
 * anything user-supplied should use `createMediaUploadTicket` and go straight
 * to storage, since a serverless request body is capped at 4.5 MB.
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
  const storagePath = keyFor(input.workspaceId, assetId, input.file.type);

  try {
    await putObject({ key: storagePath, body, contentType: input.file.type });
  } catch (error) {
    logger.error("media.upload_failed", {
      workspaceId: input.workspaceId,
      error: error instanceof Error ? error.message : "unknown",
    });
    throw new Error("Could not store the file.");
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
    await deleteObject(storagePath).catch(() => undefined);
    logger.error("media.record_failed", { error: error?.message });
    throw new Error("Could not record the uploaded file.");
  }

  return { asset: data as MediaAssetRow, checksum };
}

/**
 * Reserve a slot and mint a URL the browser can upload straight to.
 *
 * The bytes deliberately never touch our API: a serverless request body is
 * capped at 4.5 MB, so a video (up to 200 MB) — or even a 5 MB image at the top
 * of LinkedIn's limit — would be rejected by the platform before our code ran.
 *
 * The server still decides *whether* an upload may happen. The declared size and
 * type are validated against LinkedIn's published limits before any URL is
 * minted, and the row is recorded up front so an abandoned upload leaves a
 * trace that can be swept rather than an orphan nobody knows about.
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
  const storagePath = keyFor(input.workspaceId, assetId, input.file.type);

  let uploadUrl: string;

  try {
    uploadUrl = await createUploadUrl({
      key: storagePath,
      contentType: input.file.type,
    });
  } catch (error) {
    logger.error("media.sign_failed", {
      workspaceId: input.workspaceId,
      error: error instanceof Error ? error.message : "unknown",
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

  return { assetId, uploadUrl };
}

/**
 * Confirm the bytes actually landed, and mark the asset usable.
 *
 * The browser could claim success without uploading anything, so the object is
 * looked up with a HEAD and its size compared with what was declared when the
 * ticket was minted. A HEAD returns metadata only — checking a 200 MB video this
 * way costs nothing like downloading it.
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

  const head = await headObject(row.storage_path);

  if (!head.exists) {
    logger.warn("media.finalize_missing_object", { assetId: input.assetId });
    throw new Error("The upload did not finish. Please remove the file and try again.");
  }

  if (head.size !== null && head.size !== row.byte_size) {
    logger.warn("media.finalize_size_mismatch", {
      assetId: input.assetId,
      declared: row.byte_size,
      actual: head.size,
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
  try {
    return await getObjectBytes(asset.storage_path);
  } catch (error) {
    logger.error("media.download_failed", {
      assetId: asset.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    throw new Error("Could not read the stored media file.");
  }
}

/**
 * Short-lived URL for the composer preview.
 *
 * Signed for 60 seconds while the bucket is private, which is how it behaved on
 * Supabase Storage. If `R2_PUBLIC_URL` is set the link is plain instead — the
 * objects are already readable in that configuration, and an unsigned link at
 * least lets the browser cache it.
 */
export async function createMediaPreviewUrl(asset: MediaAssetRow): Promise<string | null> {
  try {
    return await createDownloadUrl({ key: asset.storage_path });
  } catch (error) {
    logger.error("media.preview_url_failed", {
      assetId: asset.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }
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
    // Delete the object first. A row without bytes is recoverable in the sense
    // that nothing is being paid to store it; an object without a row is not.
    await deleteObject(data.storage_path as string).catch((error: unknown) => {
      logger.error("media.object_delete_failed", {
        assetId,
        error: error instanceof Error ? error.message : "unknown",
      });
    });
  }

  await admin.from("media_assets").delete().eq("id", assetId).eq("workspace_id", workspaceId);

  return { deleted: true };
}
