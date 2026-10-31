import { defineRoute } from "@/lib/api/http";
import { retryPost } from "@/features/posts/service";
import { requestedWorkspaceId, workspaceContext } from "@/lib/api/workspace";
import { assertCanWrite, writeAudit } from "@/features/workspaces/access";

/**
 * POST /api/posts/[postId]/retry — retry a failed post.
 *
 * Retries always use a fresh attempt number, so a retry can never re-use the
 * claim of a run that may have succeeded. Posts whose last attempt ended
 * UNKNOWN_OUTCOME are refused: only the user can confirm whether LinkedIn
 * already published it.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = defineRoute(
  {
    auth: "required",
    rateLimit: { limit: 20, windowMs: 60_000 },
    scope: "posts:retry",
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

    const result = await retryPost(context, supabase!, params.postId!);

    await writeAudit(supabase!, {
      workspaceId: context.workspace.id,
      actorUserId: context.user.id,
      action: "post.retried",
      entityType: "post",
      entityId: params.postId!,
      metadata: { attempt: result.post.attempts },
      requestId,
    });

    return { post: result.post, publishJobQueued: result.publishJobQueued };
  },
);
