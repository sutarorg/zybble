import { defineRoute } from "@/lib/api/http";
import { getPost } from "@/features/posts/queries";
import { deletePost, updatePost } from "@/features/posts/service";
import { requestedWorkspaceId, workspaceContext } from "@/lib/api/workspace";
import { assertCanWrite, writeAudit } from "@/features/workspaces/access";
import { updatePostSchema } from "@/lib/validation/posts";

/**
 * /api/posts/[postId]
 *
 * PATCH  — edit body, media, authoring account, or reschedule. Editing a post
 *          that is mid-publish is refused; rescheduling cancels the old run and
 *          queues a new one with the next attempt number.
 * DELETE — drafts and scheduled posts only. Published posts are history.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = defineRoute(
  {
    auth: "required",
    rateLimit: { limit: 180, windowMs: 60_000 },
    scope: "posts:read",
  },
  async ({ supabase, req, params }) => {
    const context = await workspaceContext({
      supabase,
      user: null,
      workspaceId: requestedWorkspaceId(req),
    });

    return { post: await getPost(context, params.postId!) };
  },
);

export const PATCH = defineRoute(
  {
    auth: "required",
    body: updatePostSchema,
    rateLimit: { limit: 60, windowMs: 60_000 },
    scope: "posts:update",
  },
  async ({ supabase, req, body, params, requestId }) => {
    const context = await workspaceContext({
      supabase,
      user: null,
      workspaceId: requestedWorkspaceId(req),
      minimumRole: "editor",
    });

    assertCanWrite(context);

    const result = await updatePost(context, supabase!, params.postId!, body!);

    await writeAudit(supabase!, {
      workspaceId: context.workspace.id,
      actorUserId: context.user.id,
      action: "post.updated",
      entityType: "post",
      entityId: params.postId!,
      metadata: { status: result.post.status },
      requestId,
    });

    return {
      post: result.post,
      warning: result.publishJobQueued
        ? null
        : "The schedule was saved, but the background run could not be queued. It publishes anyway — due posts are re-dispatched every minute.",
    };
  },
);

export const DELETE = defineRoute(
  {
    auth: "required",
    rateLimit: { limit: 60, windowMs: 60_000 },
    scope: "posts:delete",
  },
  async ({ supabase, req, params, requestId }) => {
    const context = await workspaceContext({
      supabase,
      user: null,
      workspaceId: requestedWorkspaceId(req),
      minimumRole: "editor",
    });

    assertCanWrite(context);

    const result = await deletePost(context, supabase!, params.postId!);

    await writeAudit(supabase!, {
      workspaceId: context.workspace.id,
      actorUserId: context.user.id,
      action: "post.deleted",
      entityType: "post",
      entityId: params.postId!,
      requestId,
    });

    return result;
  },
);
