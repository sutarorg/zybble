import { z } from "zod";
import { defineRoute } from "@/lib/api/http";
import { createMediaUploadTicket } from "@/features/posts/media";
import { requestedWorkspaceId, workspaceContext } from "@/lib/api/workspace";
import { assertCanWrite } from "@/features/workspaces/access";

/**
 * POST /api/posts/media/ticket — step one of a two-step upload.
 *
 * Validates the *declared* file against LinkedIn's published limits and returns
 * a short-lived URL the browser uploads straight to. The bytes deliberately do
 * not pass through this function: a serverless request body is capped at
 * 4.5 MB, which is smaller than a single large image and far smaller than the
 * 200 MB video LinkedIn accepts. See 0012_media_direct_upload.sql.
 *
 * Only metadata crosses the wire here, so this endpoint is cheap and its rate
 * limit can be generous.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ticketSchema = z.object({
  name: z.string().trim().min(1).max(200),
  // e.g. "video/mp4". Kept short; the allowlist check is the real gate.
  type: z.string().trim().min(1).max(120),
  // LinkedIn's hard ceiling for any single upload is 500 MB.
  size: z.number().int().positive().max(524_288_000),
});

export const POST = defineRoute(
  {
    auth: "required",
    body: ticketSchema,
    rateLimit: { limit: 60, windowMs: 60_000 },
    scope: "media:ticket",
    status: 201,
  },
  async ({ supabase, req, body }) => {
    const context = await workspaceContext({
      supabase,
      user: null,
      workspaceId: requestedWorkspaceId(req),
      minimumRole: "editor",
    });

    assertCanWrite(context);

    return createMediaUploadTicket({
      workspaceId: context.workspace.id,
      userId: context.user.id,
      file: { name: body!.name, type: body!.type, size: body!.size },
    });
  },
);
