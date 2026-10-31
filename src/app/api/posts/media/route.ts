import { defineRoute } from "@/lib/api/http";
import { createMediaPreviewUrl, removeMediaAsset, storeMediaAsset } from "@/features/posts/media";
import { listMediaAssets } from "@/features/posts/media-queries";
import { requestedWorkspaceId, workspaceContext } from "@/lib/api/workspace";
import { assertCanWrite, writeAudit } from "@/features/workspaces/access";
import { ValidationError } from "@/lib/errors";

/**
 * /api/posts/media
 *
 * GET  — the workspace's unattached assets (what the composer is holding).
 * POST — multipart upload. Files are validated server side (mime allowlist,
 *        size ceiling per LinkedIn's published limits) *before* a byte is
 *        written to storage, and the bucket itself is private with a
 *        workspace-scoped policy.
 *
 * Uploads are deliberately not bound to a post: the composer uploads as soon as
 * a file is chosen, and the asset is attached when the post is created.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = defineRoute(
  {
    auth: "required",
    rateLimit: { limit: 120, windowMs: 60_000 },
    scope: "media:list",
  },
  async ({ supabase, req }) => {
    const context = await workspaceContext({
      supabase,
      user: null,
      workspaceId: requestedWorkspaceId(req),
    });

    return { assets: await listMediaAssets(context.workspace.id) };
  },
);

export const POST = defineRoute(
  {
    auth: "required",
    rateLimit: { limit: 30, windowMs: 60_000 },
    scope: "media:upload",
    status: 201,
  },
  async ({ supabase, req, requestId }) => {
    const context = await workspaceContext({
      supabase,
      user: null,
      workspaceId: requestedWorkspaceId(req),
      minimumRole: "editor",
    });

    assertCanWrite(context);

    const form = await req.formData().catch(() => null);
    const file = form?.get("file");

    if (!(file instanceof File)) {
      throw new ValidationError("Send the file as `file` in multipart/form-data.");
    }

    if (file.size === 0) {
      throw new ValidationError("That file is empty.");
    }

    const bytes = new Uint8Array(await file.arrayBuffer());

    const stored = await storeMediaAsset({
      workspaceId: context.workspace.id,
      userId: context.user.id,
      file: {
        name: file.name,
        type: file.type,
        size: file.size,
        bytes,
      },
    });

    await writeAudit(supabase!, {
      workspaceId: context.workspace.id,
      actorUserId: context.user.id,
      action: "media.uploaded",
      entityType: "media_asset",
      entityId: stored.asset.id,
      metadata: { kind: stored.asset.kind, bytes: stored.asset.byte_size },
      requestId,
    });

    return {
      asset: {
        id: stored.asset.id,
        kind: stored.asset.kind,
        name: stored.asset.file_name,
        mimeType: stored.asset.mime_type,
        bytes: stored.asset.byte_size,
        url: await createMediaPreviewUrl(stored.asset),
      },
    };
  },
);

/** DELETE /api/posts/media?assetId=… — drop an asset that was never attached. */
export const DELETE = defineRoute(
  {
    auth: "required",
    rateLimit: { limit: 60, windowMs: 60_000 },
    scope: "media:delete",
  },
  async ({ supabase, req, requestId }) => {
    const context = await workspaceContext({
      supabase,
      user: null,
      workspaceId: requestedWorkspaceId(req),
      minimumRole: "editor",
    });

    assertCanWrite(context);

    const assetId = req.nextUrl.searchParams.get("assetId");

    if (!assetId) {
      throw new ValidationError("`assetId` is required.");
    }

    await removeMediaAsset(context.workspace.id, assetId);

    await writeAudit(supabase!, {
      workspaceId: context.workspace.id,
      actorUserId: context.user.id,
      action: "media.deleted",
      entityType: "media_asset",
      entityId: assetId,
      requestId,
    });

    return { deleted: true };
  },
);
