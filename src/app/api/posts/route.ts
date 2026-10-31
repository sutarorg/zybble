import { defineRoute, ok } from "@/lib/api/http";
import { listPosts } from "@/features/posts/queries";
import { createPost } from "@/features/posts/service";
import { requestedWorkspaceId, workspaceContext } from "@/lib/api/workspace";
import { assertCanWrite, writeAudit } from "@/features/workspaces/access";
import { createPostSchema, listPostsQuerySchema } from "@/lib/validation/posts";
import type { PostStatus } from "@/lib/supabase/database.types";

/**
 * /api/posts
 *
 * GET  — the workspace's posts (RLS-scoped, media joined with signed URLs).
 * POST — create a draft, schedule one, or publish immediately.
 *
 * Scheduling is honest about its outcome: the post row is written first and the
 * Inngest run is queued second, so a failure to enqueue leaves a *scheduled*
 * post that the `/api/cron/run` dispatcher picks up. The client is told which of
 * the two happened rather than being shown a success that did not occur.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = defineRoute(
  {
    auth: "required",
    query: listPostsQuerySchema,
    rateLimit: { limit: 180, windowMs: 60_000 },
    scope: "posts:list",
  },
  async ({ supabase, req, query }) => {
    const context = await workspaceContext({
      supabase,
      user: null,
      workspaceId: requestedWorkspaceId(req),
    });

    return {
      posts: await listPosts(context, {
        status: query.status as PostStatus | undefined,
        from: query.from,
        to: query.to,
        accountId: query.accountId,
        limit: query.limit,
      }),
    };
  },
);

export const POST = defineRoute(
  {
    auth: "required",
    body: createPostSchema,
    rateLimit: { limit: 60, windowMs: 60_000 },
    scope: "posts:create",
    status: 201,
  },
  async ({ supabase, req, body, requestId }) => {
    const context = await workspaceContext({
      supabase,
      user: null,
      workspaceId: requestedWorkspaceId(req),
      minimumRole: "editor",
    });

    assertCanWrite(context);

    const result = await createPost(context, supabase!, body!);

    await writeAudit(supabase!, {
      workspaceId: context.workspace.id,
      actorUserId: context.user.id,
      action: "post.created",
      entityType: "post",
      entityId: result.post.id,
      metadata: { status: result.post.status },
      requestId,
    });

    if (!result.publishJobQueued && result.post.status === "scheduled") {
      // The row is correct; only the event is missing. Surface it as a 202 so
      // the UI can say "scheduled — confirmation pending" instead of lying.
      return ok(
        {
          post: result.post,
          warning:
            "The post is scheduled, but the background run could not be queued. It will still publish — we re-dispatch due posts every minute.",
        },
        202,
      );
    }

    return { post: result.post, warning: null };
  },
);
