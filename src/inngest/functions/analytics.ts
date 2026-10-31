import { inngest } from "@/inngest/client";
import { cron, event } from "@/inngest/functions/triggers";
import { logger } from "@/lib/logger";
import { recomputeBestTime, syncPostMetrics, syncWorkspaceAnalytics } from "@/features/analytics/service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Analytics sync.
 *
 * Metrics are only ever stored from real LinkedIn API responses. Unsupported
 * metrics stay `null`, unsupported daily granularities produce an empty series,
 * and the best-time engine returns an "insufficient data" state below its
 * evidence threshold — nothing is interpolated, estimated or fabricated.
 */

export const syncPostAnalytics = inngest.createFunction(
  {
    id: "sync-post-analytics",
    name: "Sync analytics for one post",
    retries: 3,
    concurrency: { key: "event.data.postId", limit: 1 },
    // Deliberately delayed: LinkedIn's analytics are not instantly consistent
    // after publish, and an immediate read returns zeros that would then be
    // cached as real numbers.
    triggers: [event("analytics/post.sync")],
  },
  async ({ event, step }) => {
    const { postId, workspaceId } = event.data;

    const outcome = await step.run("sync-post", () =>
      syncPostMetrics({ workspaceId, postId }),
    );

    logger.info("analytics.post_sync", { postId, status: outcome.status });

    return outcome;
  },
);

export const syncWorkspaceAnalyticsJob = inngest.createFunction(
  {
    id: "sync-workspace-analytics",
    name: "Sync analytics for a workspace",
    retries: 2,
    triggers: [event("analytics/workspace.sync")],
  },
  async ({ event, step }) => {
    const { workspaceId } = event.data;

    const result = await step.run("fan-out", () => syncWorkspaceAnalytics(workspaceId));

    logger.info("analytics.workspace_sync", { workspaceId, ...result });

    return result;
  },
);

export const recomputeBestTimeJob = inngest.createFunction(
  {
    id: "recompute-best-time",
    name: "Recompute best time to post",
    retries: 2,
    concurrency: { key: "event.data.linkedinAccountId", limit: 1 },
    triggers: [event("analytics/best-time.recompute")],
  },
  async ({ event, step }) => {
    const { workspaceId, linkedinAccountId } = event.data;

    const result = await step.run("recompute", async () => {
      const admin = createSupabaseAdminClient();
      const { data: workspace } = await admin
        .from("workspaces")
        .select("timezone")
        .eq("id", workspaceId)
        .maybeSingle();

      const timeZone = (workspace?.timezone as string | undefined) ?? "UTC";

      return recomputeBestTime({ workspaceId, linkedinAccountId, timeZone });
    });

    return {
      linkedinAccountId,
      sufficient: !result.insufficientData,
      cells: result.cells?.length ?? 0,
    };
  },
);

/**
 * Nightly sweep (03:00 UTC). Refreshes every workspace that has published posts
 * in the last 30 days — LinkedIn's member post analytics cover a rolling window,
 * so older posts are not re-read.
 */
export const nightlyAnalyticsSync = inngest.createFunction(
  {
    id: "nightly-analytics-sync",
    name: "Nightly analytics sync",
    retries: 1,
    triggers: [cron("0 3 * * *")],
  },
  async ({ step }) => {
    const workspaceIds = await step.run("list-active-workspaces", async () => {
      const admin = createSupabaseAdminClient();
      const cutoff = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();

      const { data } = await admin
        .from("posts")
        .select("workspace_id")
        .eq("status", "published")
        .gte("published_at", cutoff);

      const unique = new Set(
        ((data ?? []) as Array<{ workspace_id: string }>).map((row) => row.workspace_id),
      );

      return Array.from(unique);
    });

    const events = workspaceIds.map((workspaceId) => ({
      name: "analytics/workspace.sync" as const,
      data: { workspaceId },
    }));

    if (events.length > 0) {
      await step.sendEvent("fan-out", events);
    }

    return { workspaces: workspaceIds.length };
  },
);
