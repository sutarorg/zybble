import { NextResponse, type NextRequest } from "next/server";
import { requireCronSecret } from "@/lib/env";
import { inngest } from "@/inngest/client";
import { logger } from "@/lib/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { listDuePosts } from "@/features/posts/service";

/**
 * GET /api/cron/run — Vercel Cron entry point (hourly).
 *
 * Inngest owns the schedules in production; this route exists so the app still
 * works on a deployment without Inngest (Vercel Hobby, self-host). It is
 * idempotent: due posts are enqueued with their next attempt number and the
 * unique `(post_id, attempt)` index absorbs any overlap with an Inngest run.
 *
 * Protected by `CRON_SECRET` (Vercel sends it as `Authorization: Bearer …`).
 * Without it configured, the route refuses rather than exposing an unauthenticated
 * job trigger.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const header = req.headers.get("authorization");
  const token = header?.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : null;

  if (!requireCronSecret(token)) {
    logger.warn("cron.unauthorized");
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const summary = { dispatched: 0, workspacesSynced: 0, connectionsChecked: false, seatsSynced: 0 };

  try {
    const due = await listDuePosts(50);

    for (const post of due) {
      await inngest.send({
        name: "post/publish.requested",
        data: {
          postId: post.id,
          workspaceId: post.workspace_id,
          scheduledAt: post.scheduled_at ?? new Date().toISOString(),
          attempt: post.attempts + 1,
        },
      });
      summary.dispatched += 1;
    }

    const admin = createSupabaseAdminClient();
    const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();

    const { data: recent } = await admin
      .from("posts")
      .select("workspace_id")
      .eq("status", "published")
      .gte("published_at", cutoff);

    const workspaceIds = new Set(
      ((recent ?? []) as Array<{ workspace_id: string }>).map((row) => row.workspace_id),
    );

    if (workspaceIds.size > 0) {
      await inngest.send(
        Array.from(workspaceIds).map((workspaceId) => ({
          name: "analytics/workspace.sync" as const,
          data: { workspaceId },
        })),
      );
      summary.workspacesSynced = workspaceIds.size;
    }

    await inngest.send({ name: "linkedin/connections.check", data: { reason: "cron" } });
    summary.connectionsChecked = true;

    await inngest.send({ name: "billing/reconcile", data: { reason: "cron" } });
  } catch (error) {
    logger.error("cron.run_failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ error: "cron_failed", summary }, { status: 500 });
  }

  return NextResponse.json({ ok: true, summary });
}
