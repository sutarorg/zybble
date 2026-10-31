import { defineRoute } from "@/lib/api/http";
import { publishNow } from "@/features/posts/service";
import { requestedWorkspaceId, workspaceContext } from "@/lib/api/workspace";
import { assertCanWrite, writeAudit } from "@/features/workspaces/access";

/**
 * POST /api/posts/[postId]/publish — publish a draft immediately.
 *
 * The post moves through `scheduled` (a few seconds out) rather than calling
 * LinkedIn inline: that way immediate publishing uses the exact same durable,
 * idempotent pipeline as scheduled publishing, with the same attempt ledger.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = defineRoute(
  {
    auth: "required",
    rateLimit: { limit: 20, windowMs: 60_000 },
    scope: "posts:publish",
    status: 202,
  },
  async ({ supabase, req, params, requestId }) => {
    const context = await workspaceContext({
      supabase,
      user: null,
      workspaceId: requestedWorkspaceId(req),
      minimumRole: "editor",
    });

    assertCanWrite(context);

    const result = await publishNow(context, supabase!, params.postId!);

    await writeAudit(supabase!, {
      workspaceId: context.workspace.id,
      actorUserId: context.user.id,
      action: "post.publish_requested",
      entityType: "post",
      entityId: params.postId!,
      requestId,
    });

    return { post: result.post, publishJobQueued: result.publishJobQueued };
  },
);
