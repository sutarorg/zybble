import { defineRoute } from "@/lib/api/http";
import { updatePost } from "@/features/posts/service";
import { requestedWorkspaceId, workspaceContext } from "@/lib/api/workspace";
import { assertCanWrite, writeAudit } from "@/features/workspaces/access";

/**
 * POST /api/posts/[postId]/cancel — cancel a scheduled post.
 *
 * Cancelling moves the post to `cancelled`, refunds its Free-plan slot (the
 * usage trigger runs on the status change) and emits `post/publish.cancelled`,
 * which removes the pending Inngest run.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = defineRoute(
  {
    auth: "required",
    rateLimit: { limit: 30, windowMs: 60_000 },
    scope: "posts:cancel",
  },
  async ({ supabase, req, params, requestId }) => {
    const context = await workspaceContext({
      supabase,
      user: null,
      workspaceId: requestedWorkspaceId(req),
      minimumRole: "editor",
    });

    assertCanWrite(context);

    const result = await updatePost(context, supabase!, params.postId!, { status: "cancelled" });

    await writeAudit(supabase!, {
      workspaceId: context.workspace.id,
      actorUserId: context.user.id,
      action: "post.cancelled",
      entityType: "post",
      entityId: params.postId!,
      requestId,
    });

    return { post: result.post };
  },
);
