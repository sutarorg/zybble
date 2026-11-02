import { z } from "zod";
import { defineRoute } from "@/lib/api/http";
import {
  createMediaPreviewUrl,
  finalizeMediaAsset,
  removeMediaAsset,
} from "@/features/posts/media";
import { requestedWorkspaceId, workspaceContext } from "@/lib/api/workspace";
import { assertCanWrite } from "@/features/workspaces/access";
import { writeAudit } from "@/features/workspaces/access";

/**
 * POST /api/posts/media/finalize — step two of a two-step upload.
 *
 * Confirms the bytes really arrived before the asset can be attached to a
 * post: the object is looked up in the bucket and its size compared with what
 * was declared when the ticket was minted. Without this, a client could
 * reserve a row, skip the upload, and attach an asset that has no file behind
 * it — which would only surface as a confusing failure at publish time.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const finalizeSchema = z.object({
  assetId: z.string().uuid(),
});

export const POST = defineRoute(
  {
    auth: "required",
    body: finalizeSchema,
    rateLimit: { limit: 60, windowMs: 60_000 },
    scope: "media:finalize",
  },
  async ({ supabase, req, body, requestId }) => {
    const context = await workspaceContext({
      supabase,
      user: null,
      workspaceId: requestedWorkspaceId(req),
      minimumRole: "editor",
    });

    assertCanWrite(context);

    let asset;

    try {
      asset = await finalizeMediaAsset({
        workspaceId: context.workspace.id,
        assetId: body!.assetId,
      });
    } catch (error) {
      // An upload that never completed has nothing to keep. Drop the reserved
      // row and its (absent) object so the workspace is not left with debris
      // the composer would otherwise go on showing.
      await removeMediaAsset(context.workspace.id, body!.assetId).catch(() => undefined);
      throw error;
    }

    await writeAudit(supabase!, {
      workspaceId: context.workspace.id,
      actorUserId: context.user.id,
      action: "media.uploaded",
      entityType: "media_asset",
      entityId: asset.id,
      metadata: { kind: asset.kind, bytes: asset.byte_size },
      requestId,
    });

    return {
      asset: {
        id: asset.id,
        kind: asset.kind,
        name: asset.file_name,
        mimeType: asset.mime_type,
        bytes: asset.byte_size,
        url: await createMediaPreviewUrl(asset),
      },
    };
  },
);
