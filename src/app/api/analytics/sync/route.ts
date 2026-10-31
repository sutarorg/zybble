import { z } from "zod";
import { defineRoute } from "@/lib/api/http";
import { syncPostMetrics, syncWorkspaceAnalytics } from "@/features/analytics/service";
import { requestedWorkspaceId, workspaceContext } from "@/lib/api/workspace";
import { inngest } from "@/inngest/client";
import { assertCanWrite } from "@/features/workspaces/access";

/**
 * POST /api/analytics/sync
 *
 * LinkedIn's analytics are eventually consistent, so the UI offers an explicit
 * refresh instead of pretending the cached numbers are live. A workspace-wide
 * sync fans out through Inngest (one run per post) — it is never done inline.
 *
 * Body: {} → whole workspace; { postId } → a single post.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const syncSchema = z.object({ postId: z.string().uuid().optional() }).default({});

export const POST = defineRoute(
  {
    auth: "required",
    body: syncSchema,
    rateLimit: { limit: 20, windowMs: 60_000 },
    scope: "analytics:sync",
    status: 202,
  },
  async ({ supabase, req, body }) => {
    const context = await workspaceContext({
      supabase,
      user: null,
      workspaceId: requestedWorkspaceId(req),
    });

    assertCanWrite(context);

    if (body?.postId) {
      await inngest.send({
        name: "analytics/post.sync",
        data: { postId: body.postId, workspaceId: context.workspace.id },
      });

      const outcome = await syncPostMetrics({
        workspaceId: context.workspace.id,
        postId: body.postId,
      });

      return { mode: "post" as const, outcome };
    }

    const result = await syncWorkspaceAnalytics(context.workspace.id);

    return { mode: "workspace" as const, ...result };
  },
);
