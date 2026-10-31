import { inngest } from "@/inngest/client";
import { entitlementsFor } from "@/features/billing/entitlements";
import { getUsableConnection } from "@/features/linkedin/tokens";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import {
  engagementRate as computeEngagementRate,
  fetchAccountMetricDaily,
  fetchPostMetrics,
} from "@/lib/linkedin/analytics";
import type { MetricType } from "@/lib/linkedin/analytics";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";
import type {
  AnalyticsSnapshotRow,
  BestTimeRecommendationRow,
  PostAnalyticsRow,
  PostRow,
} from "@/lib/supabase/database.types";
import { addDays, startOfUtcDay, toIsoDate } from "@/lib/time";
import {
  computeBestTime,
  type BestTimeObservation,
  type BestTimeResult,
} from "./best-time";

/**
 * Analytics ingestion and reading.
 *
 * Source of truth is LinkedIn's `memberCreatorPostAnalytics` API, which requires
 * the `r_member_postAnalytics` scope (Community Management API approval). Where
 * that permission is missing the sync returns a typed skip reason and the UI
 * renders a capability-gated empty state — no numbers are ever invented.
 *
 * What is stored:
 *  * `post_analytics`   — one row per (post, capture date) with metric totals;
 *  * `analytics_snapshots` — account-wide daily series from the `me` finder.
 *
 * LinkedIn does not offer a daily impression breakdown for a single post, so the
 * per-day chart is built from the account-level daily series and the per-post
 * chart uses capture-date snapshots. Both are labelled accordingly in the UI.
 */

export type RangeKey = "7d" | "28d" | "12m";

export const RANGE_DAYS: Record<RangeKey, number> = {
  "7d": 7,
  "28d": 28,
  "12m": 365,
};

/** How long after publishing a post keeps changing materially. */
const ACTIVE_SYNC_WINDOW_DAYS = 30;

export type SyncOutcome = {
  postId: string;
  status: "synced" | "skipped" | "failed";
  reason?: string;
  metrics?: {
    impressions: number | null;
    reactions: number | null;
    comments: number | null;
    reposts: number | null;
    engagementRate: number | null;
  };
};

export async function syncPostMetrics(input: {
  workspaceId: string;
  postId: string;
}): Promise<SyncOutcome> {
  const admin = createSupabaseAdminClient();

  const { data: post, error } = await admin
    .from("posts")
    .select("*")
    .eq("id", input.postId)
    .eq("workspace_id", input.workspaceId)
    .maybeSingle();

  if (error || !post) {
    return { postId: input.postId, status: "failed", reason: "Post not found." };
  }

  const postRow = post as PostRow;

  if (postRow.status !== "published" || !postRow.linkedin_post_urn) {
    return {
      postId: postRow.id,
      status: "skipped",
      reason: "Post is not published on LinkedIn.",
    };
  }

  const { data: account } = await admin
    .from("linkedin_accounts")
    .select("can_read_analytics, status")
    .eq("id", postRow.author_account_id)
    .maybeSingle();

  if (!account?.can_read_analytics) {
    return {
      postId: postRow.id,
      status: "skipped",
      reason: "This connection was not granted the LinkedIn analytics permission.",
    };
  }

  try {
    const connection = await getUsableConnection(postRow.author_account_id);
    const metrics = await fetchPostMetrics(connection.accessToken, postRow.linkedin_post_urn);
    const rate = computeEngagementRate(metrics);
    const capturedOn = toIsoDate(startOfUtcDay(new Date()));

    const { error: upsertError } = await admin.from("post_analytics").upsert(
      {
        workspace_id: input.workspaceId,
        post_id: postRow.id,
        captured_on: capturedOn,
        source: "linkedin_member_creator_post_analytics",
        impressions: metrics.impressions,
        members_reached: metrics.membersReached,
        reactions: metrics.reactions,
        comments: metrics.comments,
        reposts: metrics.reposts,
        engagement_rate: rate === null ? null : String(rate),
        raw: metrics as never,
        synced_at: new Date().toISOString(),
      },
      { onConflict: "post_id,captured_on" },
    );

    if (upsertError) {
      logger.error("analytics.post_upsert_failed", {
        postId: postRow.id,
        error: upsertError.message,
      });
      return { postId: postRow.id, status: "failed", reason: "Could not store the metrics." };
    }

    return {
      postId: postRow.id,
      status: "synced",
      metrics: { ...metrics, engagementRate: rate },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    logger.error("analytics.post_sync_failed", { postId: postRow.id, error: message });
    return { postId: postRow.id, status: "failed", reason: message };
  }
}

/** Fan out per-post syncs and refresh the account-level daily series. */
export async function syncWorkspaceAnalytics(workspaceId: string): Promise<{
  postsQueued: number;
  snapshotsWritten: number;
  skippedReason?: string;
}> {
  const admin = createSupabaseAdminClient();

  const { data: accounts } = await admin
    .from("linkedin_accounts")
    .select("id, can_read_analytics, status")
    .eq("workspace_id", workspaceId)
    .eq("status", "active");

  const readable = ((accounts ?? []) as Array<{ id: string; can_read_analytics: boolean }>).filter(
    (account) => account.can_read_analytics,
  );

  if (readable.length === 0) {
    return {
      postsQueued: 0,
      snapshotsWritten: 0,
      skippedReason:
        "No connected LinkedIn account has the analytics permission (r_member_postAnalytics).",
    };
  }

  const since = addDays(new Date(), -ACTIVE_SYNC_WINDOW_DAYS).toISOString();

  const { data: posts } = await admin
    .from("posts")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("status", "published")
    .gte("published_at", since)
    .limit(100);

  const postIds = ((posts ?? []) as Array<{ id: string }>).map((post) => post.id);

  if (postIds.length > 0) {
    await inngest.send(
      postIds.map((postId) => ({
        name: "analytics/post.sync" as const,
        data: { postId, workspaceId },
      })),
    );
  }

  let snapshotsWritten = 0;

  for (const account of readable) {
    snapshotsWritten += await syncAccountDailySeries(workspaceId, account.id);
  }

  return { postsQueued: postIds.length, snapshotsWritten };
}

async function syncAccountDailySeries(
  workspaceId: string,
  accountId: string,
): Promise<number> {
  const admin = createSupabaseAdminClient();

  let written = 0;

  try {
    const connection = await getUsableConnection(accountId);
    const end = startOfUtcDay(new Date());
    const start = addDays(end, -(RANGE_DAYS["12m"] - 1));

    const metrics: MetricType[] = ["IMPRESSION", "REACTION", "COMMENT", "RESHARE"];

    for (const metric of metrics) {
      const series = await fetchAccountMetricDaily(connection.accessToken, metric, {
        start,
        end,
      });

      for (const point of series) {
        if (!point.startDate) continue;

        const { error } = await admin.from("analytics_snapshots").upsert(
          {
            workspace_id: workspaceId,
            linkedin_account_id: accountId,
            captured_on: point.startDate,
            metric_type: metric,
            granularity: "daily",
            value: point.count,
            raw: point as never,
            synced_at: new Date().toISOString(),
          },
          { onConflict: "linkedin_account_id,captured_on,metric_type,granularity" },
        );

        if (!error) written += 1;
      }
    }
  } catch (error) {
    logger.error("analytics.account_series_failed", {
      accountId,
      error: error instanceof Error ? error.message : "unknown",
    });
  }

  return written;
}

/**
 * Recompute and cache the best-time grid for one connection.
 *
 * Only posts whose metrics LinkedIn actually returned are used, and the engine
 * refuses to produce a grid below its evidence threshold. Old rows are cleared
 * so a workspace that drops below the threshold (data deleted, plan change)
 * stops showing stale recommendations.
 */
export async function recomputeBestTime(input: {
  workspaceId: string;
  linkedinAccountId: string;
  timeZone: string;
}): Promise<BestTimeResult> {
  const admin = createSupabaseAdminClient();

  // Two explicit queries rather than an embedded `posts!inner(...)` select:
  // the schema declares no PostgREST relationships, and the analytics window is
  // small enough that reading the posts first is cheaper than maintaining
  // relationship metadata just for this join.
  const { data: publishedPosts } = await admin
    .from("posts")
    .select("id, published_at")
    .eq("workspace_id", input.workspaceId)
    .eq("author_account_id", input.linkedinAccountId)
    .eq("status", "published")
    .not("published_at", "is", null);

  const publishedAt = new Map<string, string>(
    ((publishedPosts ?? []) as Array<{ id: string; published_at: string | null }>)
      .filter((post) => post.published_at !== null)
      .map((post) => [post.id, post.published_at as string]),
  );

  if (publishedAt.size === 0) {
    await admin
      .from("best_time_recommendations")
      .delete()
      .eq("workspace_id", input.workspaceId)
      .eq("linkedin_account_id", input.linkedinAccountId);

    return computeBestTime([], { timeZone: input.timeZone });
  }

  const { data: rows } = await admin
    .from("post_analytics")
    .select("post_id, impressions, reactions, comments, reposts")
    .eq("workspace_id", input.workspaceId)
    .in("post_id", Array.from(publishedAt.keys()));

  type MetricRow = {
    post_id: string;
    impressions: number | null;
    reactions: number | null;
    comments: number | null;
    reposts: number | null;
  };

  const observations: BestTimeObservation[] = ((rows ?? []) as MetricRow[])
    .map((row) => {
      const publishedAtIso = publishedAt.get(row.post_id);
      if (!publishedAtIso) return null;

      return {
        postId: row.post_id,
        publishedAt: new Date(publishedAtIso),
        impressions: row.impressions,
        reactions: row.reactions,
        comments: row.comments,
        reposts: row.reposts,
      } satisfies BestTimeObservation;
    })
    .filter((entry): entry is BestTimeObservation => entry !== null);

  const result = computeBestTime(observations, { timeZone: input.timeZone });

  await admin
    .from("best_time_recommendations")
    .delete()
    .eq("workspace_id", input.workspaceId)
    .eq("linkedin_account_id", input.linkedinAccountId);

  if (result.insufficientData) {
    return result;
  }

  const payload = result.cells
    .filter((cell) => cell.score !== null)
    .map((cell) => ({
      workspace_id: input.workspaceId,
      linkedin_account_id: input.linkedinAccountId,
      weekday: cell.weekday,
      hour: cell.hour,
      score: String(cell.score),
      sample_size: Math.round(cell.sampleSize),
      confidence: String(cell.confidence),
      computed_at: new Date().toISOString(),
    }));

  if (payload.length > 0) {
    const { error } = await admin.from("best_time_recommendations").insert(payload);

    if (error) {
      logger.error("analytics.best_time_write_failed", { error: error.message });
    }
  }

  return result;
}

/* -------------------------------------------------------------------------- */
/*                                  Reading                                   */
/* -------------------------------------------------------------------------- */

export type AnalyticsOverview = {
  rangeDays: number;
  totals: { impressions: number; reactions: number; comments: number; reposts: number };
  deltas: { impressions: number | null; engagement: number | null };
  series: Array<{
    date: string;
    impressions: number;
    reactions: number;
    comments: number;
    reposts: number;
  }>;
  topPosts: Array<{
    postId: string;
    text: string;
    publishedAt: string | null;
    metrics: {
      impressions: number;
      reactions: number;
      comments: number;
      reposts: number;
      engagementRate: number | null;
    };
  }>;
  bestTime: {
    cells: Array<{ weekday: number; hour: number; score: number | null }>;
    insufficientData: { requiredPosts: number; observedPosts: number } | null;
    meta: BestTimeResult["meta"] | null;
  };
  capabilities: {
    analyticsPermission: boolean;
    connectedAccounts: number;
    bestTimeUnlocked: boolean;
    historyDays: number;
    note: string | null;
  };
};

function emptyTotals() {
  return { impressions: 0, reactions: 0, comments: 0, reposts: 0 };
}

function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

/**
 * Build the analytics payload for the dashboard.
 *
 * The RLS policies on `post_analytics` and `analytics_snapshots` already clamp
 * the window to the workspace's plan, so this function simply reads what it is
 * allowed to see — a Free workspace asking for 12 months gets 7 days back.
 */
export async function getAnalyticsOverview(input: {
  supabase: ServerSupabase;
  workspaceId: string;
  range: RangeKey;
  plan: "free" | "pro";
  timeZone: string;
  linkedinAccountId?: string;
}): Promise<AnalyticsOverview> {
  const { supabase, workspaceId, range, plan } = input;
  const entitlements = entitlementsFor(plan);
  const rangeDays = range === "12m" && !entitlements.bestTimeInsights ? 28 : RANGE_DAYS[range];

  const today = startOfUtcDay(new Date());
  const from = toIsoDate(addDays(today, -(rangeDays - 1)));
  const previousFrom = toIsoDate(addDays(today, -(rangeDays * 2 - 1)));
  const previousTo = toIsoDate(addDays(today, -rangeDays));

  const [{ data: accounts }, { data: currentRows }, { data: previousRows }, { data: snapshots }, { data: bestTimeRows }] =
    await Promise.all([
      supabase
        .from("linkedin_accounts")
        .select("id, can_read_analytics, status")
        .eq("workspace_id", workspaceId),
      supabase
        .from("post_analytics")
        .select("impressions, reactions, comments, reposts, post_id")
        .eq("workspace_id", workspaceId)
        .gte("captured_on", from),
      supabase
        .from("post_analytics")
        .select("impressions, reactions, comments, reposts")
        .eq("workspace_id", workspaceId)
        .gte("captured_on", previousFrom)
        .lte("captured_on", previousTo),
      supabase
        .from("analytics_snapshots")
        .select("captured_on, metric_type, value")
        .eq("workspace_id", workspaceId)
        .eq("granularity", "daily")
        .gte("captured_on", from)
        .order("captured_on", { ascending: true }),
      entitlements.bestTimeInsights
        ? supabase
            .from("best_time_recommendations")
            .select("*")
            .eq("workspace_id", workspaceId)
        : Promise.resolve({ data: [] }),
    ]);

  const accountRows = (accounts ?? []) as Array<{ id: string; can_read_analytics: boolean; status: string }>;
  const analyticsPermission = accountRows.some(
    (account) => account.can_read_analytics && account.status === "active",
  );

  const totals = emptyTotals();
  for (const row of (currentRows ?? []) as PostAnalyticsRow[]) {
    totals.impressions += row.impressions ?? 0;
    totals.reactions += row.reactions ?? 0;
    totals.comments += row.comments ?? 0;
    totals.reposts += row.reposts ?? 0;
  }

  const previousTotals = emptyTotals();
  for (const row of (previousRows ?? []) as PostAnalyticsRow[]) {
    previousTotals.impressions += row.impressions ?? 0;
    previousTotals.reactions += row.reactions ?? 0;
    previousTotals.comments += row.comments ?? 0;
    previousTotals.reposts += row.reposts ?? 0;
  }

  const currentEngagement =
    totals.impressions > 0
      ? (totals.reactions + totals.comments + totals.reposts) / totals.impressions
      : 0;
  const previousEngagement =
    previousTotals.impressions > 0
      ? (previousTotals.reactions + previousTotals.comments + previousTotals.reposts) /
        previousTotals.impressions
      : 0;

  const seriesMap = new Map<
    string,
    { date: string; impressions: number; reactions: number; comments: number; reposts: number }
  >();

  for (const row of (snapshots ?? []) as Array<Pick<AnalyticsSnapshotRow, "captured_on" | "metric_type" | "value">>) {
    const entry = seriesMap.get(row.captured_on) ?? {
      date: row.captured_on,
      impressions: 0,
      reactions: 0,
      comments: 0,
      reposts: 0,
    };

    if (row.metric_type === "IMPRESSION") entry.impressions += row.value;
    if (row.metric_type === "REACTION") entry.reactions += row.value;
    if (row.metric_type === "COMMENT") entry.comments += row.value;
    if (row.metric_type === "RESHARE") entry.reposts += row.value;

    seriesMap.set(row.captured_on, entry);
  }

  const series = [...seriesMap.values()].sort((a, b) => a.date.localeCompare(b.date));

  // Top posts: latest snapshot per post inside the window.
  const perPost = new Map<string, { impressions: number; reactions: number; comments: number; reposts: number }>();
  for (const row of (currentRows ?? []) as PostAnalyticsRow[]) {
    perPost.set(row.post_id, {
      impressions: row.impressions ?? 0,
      reactions: row.reactions ?? 0,
      comments: row.comments ?? 0,
      reposts: row.reposts ?? 0,
    });
  }

  const topPostIds = [...perPost.entries()]
    .sort((a, b) => b[1].impressions - a[1].impressions)
    .slice(0, 5)
    .map(([postId]) => postId);

  let topPosts: AnalyticsOverview["topPosts"] = [];

  if (topPostIds.length > 0) {
    const { data: posts } = await supabase
      .from("posts")
      .select("id, body, published_at")
      .in("id", topPostIds)
      .eq("workspace_id", workspaceId);

    topPosts = ((posts ?? []) as Array<{ id: string; body: string; published_at: string | null }>).map(
      (post) => {
        const metrics = perPost.get(post.id) ?? {
          impressions: 0,
          reactions: 0,
          comments: 0,
          reposts: 0,
        };

        return {
          postId: post.id,
          text: post.body,
          publishedAt: post.published_at,
          metrics: {
            ...metrics,
            engagementRate: computeEngagementRate(metrics),
          },
        };
      },
    );
  }

  const bestTimeRowList = (bestTimeRows ?? []) as BestTimeRecommendationRow[];

  return {
    rangeDays,
    totals,
    deltas: {
      impressions: percentChange(totals.impressions, previousTotals.impressions),
      engagement: percentChange(currentEngagement, previousEngagement),
    },
    series,
    topPosts,
    bestTime: {
      cells: bestTimeRowList.map((row) => ({
        weekday: row.weekday,
        hour: row.hour,
        score: Number(row.score),
      })),
      insufficientData:
        entitlements.bestTimeInsights && bestTimeRowList.length === 0
          ? { requiredPosts: 12, observedPosts: 0 }
          : null,
      meta: null,
    },
    capabilities: {
      analyticsPermission,
      connectedAccounts: accountRows.filter((account) => account.status === "active").length,
      bestTimeUnlocked: entitlements.bestTimeInsights,
      historyDays: entitlements.analyticsHistoryDays,
      note: buildCapabilityNote({
        analyticsPermission,
        connectedAccounts: accountRows.filter((account) => account.status === "active").length,
        hasData: series.length > 0 || totals.impressions > 0,
      }),
    },
  };
}

function buildCapabilityNote(input: {
  analyticsPermission: boolean;
  connectedAccounts: number;
  hasData: boolean;
}): string | null {
  if (input.connectedAccounts === 0) {
    return "Connect a LinkedIn account to start collecting analytics.";
  }

  if (!input.analyticsPermission) {
    return "This connection was not granted the LinkedIn analytics permission (r_member_postAnalytics), which requires Community Management API approval. Publishing still works; analytics stay empty until the permission is granted and the account is reconnected.";
  }

  if (!input.hasData) {
    return "No metrics yet. Analytics appear once scheduled posts publish through Zybble and LinkedIn reports their performance.";
  }

  return null;
}

/** Guard used by API routes: 12-month history is a Pro entitlement. */
export function assertRangeAllowed(range: RangeKey, plan: "free" | "pro"): void {
  if (range === "12m" && plan !== "pro") {
    throw new AppError(
      "entitlement_required",
      "The 12-month view is part of Zybble Pro. The Free plan includes 7-day analytics.",
      { details: { code: "pro_required" } },
    );
  }
}
