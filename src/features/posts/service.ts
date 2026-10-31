import { inngest } from "@/inngest/client";
import { effectivePlan, entitlementsFor } from "@/features/billing/entitlements";
import { describeLimitError, type UsageSnapshot } from "@/features/billing/entitlements";
import { AppError, ConflictError, EntitlementError, NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { PostRow, SubscriptionRow } from "@/lib/supabase/database.types";
import { InvalidWallTimeError, usagePeriod, zonedWallTimeToUtc } from "@/lib/time";
import type { WorkspaceContext } from "@/features/workspaces/access";
import type { CreatePostInput, UpdatePostInput } from "@/lib/validation/posts";

/**
 * Post lifecycle.
 *
 * Reads and writes that happen on behalf of a signed-in user go through the
 * user's RLS-scoped client, so an incorrect authorisation check cannot cross a
 * workspace boundary. Two operations need to bypass RLS deliberately and are
 * documented where they happen (scheduling fan-out writes `scheduled_at` on
 * posts the job system owns).
 */

export type PostWithMedia = PostRow & {
  media: Array<{
    id: string;
    kind: "image" | "video" | "document";
    name: string;
    mimeType: string;
    bytes: number;
    url: string | null;
  }>;
};

/**
 * Result of a lifecycle operation.
 *
 * `publishJobQueued` is reported honestly: if the event could not be sent the
 * post is still scheduled and the dispatcher will pick it up, but the API says
 * so rather than implying a run is pending when it is not.
 */
export type PostMutationResult = {
  post: PostRow;
  publishJobQueued: boolean;
};

export class ScheduleLimitError extends AppError {
  constructor(message: string) {
    super("entitlement_required", message, { details: { code: "schedule_limit_reached" } });
  }
}

function mapSqlError(error: { message?: string; code?: string }): AppError {
  const friendly = describeLimitError(error.code);

  if (friendly) {
    return new EntitlementError(friendly, { code: error.code });
  }

  logger.error("posts.sql_error", { message: error.message, code: error.code });
  return new AppError("internal_error", "Could not save the post. The failure has been logged.");
}

/** Resolve the UTC instant a scheduled post should publish at. */
export function resolveScheduledAt(input: {
  date?: string;
  time?: string;
  timezone?: string;
  fallbackTimezone: string;
}): Date {
  const timezone = input.timezone ?? input.fallbackTimezone;

  if (!input.date || !input.time) {
    throw new AppError("validation_failed", "A date and time are required to schedule a post.");
  }

  let instant: Date;

  try {
    instant = zonedWallTimeToUtc({
      date: input.date!,
      time: input.time!,
      timeZone: timezone,
      // A slot inside a spring-forward gap does not exist, and quietly shifting
      // it an hour would publish at a time the author never chose.
      onNonexistent: "error",
    });
  } catch (error) {
    if (error instanceof InvalidWallTimeError) {
      // The message names only the date, time and IANA zone the user picked.
      throw new AppError("validation_failed", error.message);
    }

    throw error;
  }

  if (instant.getTime() <= Date.now()) {
    throw new AppError("validation_failed", "Pick a time in the future.");
  }

  return instant;
}

export async function loadUsageSnapshot(
  supabase: ServerSupabase,
  workspaceId: string,
): Promise<UsageSnapshot> {
  const [{ count: scheduledCount }, { data: subscription }, { count: accountCount }] =
    await Promise.all([
      supabase
        .from("usage_counters")
        .select("count", { count: "exact", head: true })
        .eq("workspace_id", workspaceId),
      supabase.from("subscriptions").select("*").eq("workspace_id", workspaceId).maybeSingle(),
      supabase
        .from("linkedin_accounts")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .neq("status", "revoked"),
    ]);

  const subscriptionRow = subscription as SubscriptionRow | null;
  const plan = effectivePlan({
    plan: subscriptionRow?.plan,
    status: subscriptionRow?.status,
    currentPeriodEnd: subscriptionRow?.current_period_end,
  });

  return {
    plan,
    scheduledPostsUsed:
      (await currentMonthUsage(supabase, workspaceId)) ?? (scheduledCount ?? 0),
    scheduledPostsLimit: entitlementsFor(plan).monthlyScheduleLimit,
    linkedinAccountsUsed: accountCount ?? 0,
    linkedinAccountsLimit: entitlementsFor(plan).maxLinkedInAccounts,
    analyticsHistoryDays: entitlementsFor(plan).analyticsHistoryDays,
  };
}

async function currentMonthUsage(
  supabase: ServerSupabase,
  workspaceId: string,
): Promise<number | null> {
  const { data } = await supabase
    .from("usage_counters")
    .select("count")
    .eq("workspace_id", workspaceId)
    .eq("period", usagePeriod())
    .eq("metric", "scheduled_posts")
    .maybeSingle();

  return (data as { count: number } | null)?.count ?? null;
}

/**
 * Create a draft, schedule a post, or publish immediately.
 *
 * The Free-plan quota is enforced by a SQL trigger (so it cannot be bypassed by
 * calling the API directly); the check here exists to produce a helpful message
 * before the database rejects the write.
 */
export async function createPost(
  context: WorkspaceContext,
  supabase: ServerSupabase,
  input: CreatePostInput,
): Promise<PostMutationResult> {
  if (!context.canWrite) {
    throw new AppError("forbidden", "Your role in this workspace is read-only.");
  }

  const snapshot = await loadUsageSnapshot(supabase, context.workspace.id);
  const entitlements = entitlementsFor(snapshot.plan);

  if (snapshot.linkedinAccountsUsed >= entitlements.maxLinkedInAccounts) {
    // Only a hard stop when the post targets an unconnected account; the
    // connection limit is enforced at connect time by its own trigger.
    const { data: account } = await supabase
      .from("linkedin_accounts")
      .select("id")
      .eq("id", input.authorAccountId)
      .eq("workspace_id", context.workspace.id)
      .maybeSingle();

    if (!account) {
      throw new NotFoundError("That LinkedIn connection is not part of this workspace.");
    }
  }

  let scheduledAt: Date | null = null;
  let status: PostRow["status"] = "draft";

  if (input.intent === "schedule" || input.intent === "publish_now") {
    if (input.intent === "publish_now") {
      scheduledAt = new Date(Date.now() + 5_000);
    } else {
      if (
        entitlements.monthlyScheduleLimit !== null &&
        snapshot.scheduledPostsUsed >= entitlements.monthlyScheduleLimit
      ) {
        throw new ScheduleLimitError(
          `You have used all ${entitlements.monthlyScheduleLimit} scheduled posts included in the Free plan this month. Upgrade to Pro for unlimited scheduling.`,
        );
      }

      scheduledAt = resolveScheduledAt({
        date: input.scheduleDate,
        time: input.scheduleTime,
        timezone: input.timezone,
        fallbackTimezone: context.workspace.timezone,
      });
    }

    status = "scheduled";
  }

  const period = scheduledAt ? usagePeriod(scheduledAt) : null;

  const { data, error } = await supabase
    .from("posts")
    .insert({
      workspace_id: context.workspace.id,
      author_account_id: input.authorAccountId,
      created_by: context.user.id,
      body: input.body,
      status,
      scheduled_at: scheduledAt?.toISOString() ?? null,
      timezone: input.timezone ?? context.workspace.timezone,
      usage_period: period,
      idempotency_key: input.idempotencyKey ?? null,
    })
    .select("*")
    .single();

  if (error) {
    // 23505 on (workspace_id, idempotency_key): the client retried a submit that
    // actually succeeded. Return the original post instead of creating a twin.
    if (error.code === "23505" && input.idempotencyKey) {
      const { data: existing } = await supabase
        .from("posts")
        .select("*")
        .eq("workspace_id", context.workspace.id)
        .eq("idempotency_key", input.idempotencyKey)
        .maybeSingle();

      if (existing) {
        const recovered = existing as PostRow;
        return {
          post: recovered,
          publishJobQueued:
            recovered.status === "scheduled"
              ? await schedulePublishJob(recovered, recovered.attempts + 1)
              : true,
        };
      }
    }

    throw mapSqlError(error);
  }

  const post = data as PostRow;

  if (input.mediaAssetIds && input.mediaAssetIds.length > 0) {
    await attachMedia(supabase, context.workspace.id, post.id, input.mediaAssetIds);
  }

  const publishJobQueued = status === "scheduled" ? await schedulePublishJob(post, 1) : true;

  return { post, publishJobQueued };
}

async function attachMedia(
  supabase: ServerSupabase,
  workspaceId: string,
  postId: string,
  assetIds: string[],
): Promise<void> {
  // The UPDATE is RLS-scoped to assets in this workspace, so ids belonging to
  // another workspace simply match zero rows.
  const { error } = await supabase
    .from("media_assets")
    .update({ post_id: postId })
    .in("id", assetIds)
    .eq("workspace_id", workspaceId)
    .is("post_id", null);

  if (error) {
    logger.error("posts.media_attach_failed", { postId, error: error.message });
    throw new AppError("internal_error", "Could not attach the media to this post.");
  }
}

/**
 * Hand a due post to Inngest.
 *
 * Best-effort by design: the database row is the source of truth, and the
 * dispatcher (`dispatchDuePosts`, every minute) re-enqueues anything that is due
 * but has no run. A failed send is therefore reported, not thrown — the user's
 * write has already succeeded.
 */
export async function schedulePublishJob(post: PostRow, attempt: number): Promise<boolean> {
  if (!post.scheduled_at) return true;

  try {
    await inngest.send({
      name: "post/publish.requested",
      data: {
        postId: post.id,
        workspaceId: post.workspace_id,
        scheduledAt: post.scheduled_at,
        attempt,
      },
    });
    return true;
  } catch (error) {
    logger.error("posts.schedule_failed", {
      postId: post.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return false;
  }
}

export async function cancelPublishJob(workspaceId: string, postId: string): Promise<boolean> {
  try {
    await inngest.send({
      name: "post/publish.cancelled",
      data: { postId, workspaceId, reason: "cancelled_or_rescheduled" },
    });
    return true;
  } catch (error) {
    logger.error("posts.cancel_job_failed", {
      postId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return false;
  }
}

export async function updatePost(
  context: WorkspaceContext,
  supabase: ServerSupabase,
  postId: string,
  input: UpdatePostInput,
): Promise<PostMutationResult> {
  if (!context.canWrite) {
    throw new AppError("forbidden", "Your role in this workspace is read-only.");
  }

  const { data: existing, error: loadError } = await supabase
    .from("posts")
    .select("*")
    .eq("id", postId)
    .eq("workspace_id", context.workspace.id)
    .maybeSingle();

  if (loadError || !existing) {
    throw new NotFoundError("Post not found.");
  }

  const current = existing as PostRow;

  if (current.status === "published") {
    throw new ConflictError("This post is already live on LinkedIn and cannot be edited.");
  }

  if (current.status === "publishing") {
    throw new ConflictError(
      "This post is being published right now. Wait a moment, then refresh.",
    );
  }

  const patch: Partial<PostRow> = {};

  if (input.body !== undefined) patch.body = input.body;
  if (input.timezone !== undefined) patch.timezone = input.timezone;
  if (input.authorAccountId !== undefined) patch.author_account_id = input.authorAccountId;

  const targetStatus = input.status ?? input.intent ?? null;

  if (targetStatus === "scheduled") {
    const scheduledAt = resolveScheduledAt({
      date: input.scheduleDate,
      time: input.scheduleTime,
      timezone: input.timezone ?? current.timezone ?? context.workspace.timezone,
      fallbackTimezone: context.workspace.timezone,
    });

    patch.status = "scheduled";
    patch.scheduled_at = scheduledAt.toISOString();
    patch.usage_period = usagePeriod(scheduledAt);
    patch.failure_reason = null;
    patch.failure_code = null;
  } else if (targetStatus === "draft") {
    patch.status = "draft";
    patch.scheduled_at = null;
    patch.usage_period = null;
  } else if (targetStatus === "cancelled") {
    patch.status = "cancelled";
    patch.scheduled_at = null;
  }

  const { data, error } = await supabase
    .from("posts")
    .update(patch)
    .eq("id", postId)
    .eq("workspace_id", context.workspace.id)
    .select("*")
    .single();

  if (error) throw mapSqlError(error);

  const updated = data as PostRow;

  // Any change to a scheduled post invalidates the pending run.
  if (current.status === "scheduled" || current.scheduled_at) {
    await cancelPublishJob(context.workspace.id, postId);
  }

  const publishJobQueued =
    updated.status === "scheduled" ? await schedulePublishJob(updated, current.attempts + 1) : true;

  return { post: updated, publishJobQueued };
}

export async function deletePost(
  context: WorkspaceContext,
  supabase: ServerSupabase,
  postId: string,
): Promise<{ deleted: true }> {
  if (!context.canWrite) {
    throw new AppError("forbidden", "Your role in this workspace is read-only.");
  }

  const { data: existing } = await supabase
    .from("posts")
    .select("id, status, scheduled_at")
    .eq("id", postId)
    .eq("workspace_id", context.workspace.id)
    .maybeSingle();

  if (!existing) throw new NotFoundError("Post not found.");

  const current = existing as { id: string; status: PostRow["status"]; scheduled_at: string | null };

  if (current.status === "publishing") {
    throw new ConflictError("This post is being published right now and cannot be deleted.");
  }

  await cancelPublishJob(context.workspace.id, postId);

  // Media rows cascade; the storage objects are removed by the deletion job so
  // a half-removed post never loses a file the user might still want.
  const { error } = await supabase
    .from("posts")
    .delete()
    .eq("id", postId)
    .eq("workspace_id", context.workspace.id);

  if (error) throw mapSqlError(error);

  return { deleted: true };
}

/**
 * Retry a failed post.
 *
 * Uses the next attempt number so the attempt ledger treats it as a new,
 * distinct run — the previous failure row stays as evidence. A post whose last
 * attempt ended UNKNOWN_OUTCOME is not retried automatically: only the user can
 * confirm whether LinkedIn already has it.
 */
export async function retryPost(
  context: WorkspaceContext,
  supabase: ServerSupabase,
  postId: string,
): Promise<PostMutationResult> {
  if (!context.canWrite) {
    throw new AppError("forbidden", "Your role in this workspace is read-only.");
  }

  const { data: existing } = await supabase
    .from("posts")
    .select("*")
    .eq("id", postId)
    .eq("workspace_id", context.workspace.id)
    .maybeSingle();

  if (!existing) throw new NotFoundError("Post not found.");

  const current = existing as PostRow;

  if (current.status !== "failed") {
    throw new ConflictError("Only failed posts can be retried.");
  }

  if (current.failure_code === "UNKNOWN_OUTCOME") {
    throw new ConflictError(
      "Check your LinkedIn feed first — this post may already be live. Mark it as published manually, or delete it.",
    );
  }

  const nextAttempt = current.attempts + 1;

  const { data, error } = await supabase
    .from("posts")
    .update({
      status: "scheduled",
      // Keep the original slot when it is still in the future, otherwise publish
      // as soon as the run starts.
      scheduled_at:
        current.scheduled_at && new Date(current.scheduled_at).getTime() > Date.now()
          ? current.scheduled_at
          : new Date(Date.now() + 5_000).toISOString(),
      failure_reason: null,
      failure_code: null,
    })
    .eq("id", postId)
    .eq("workspace_id", context.workspace.id)
    .select("*")
    .single();

  if (error) throw mapSqlError(error);

  const updated = data as PostRow;
  const publishJobQueued = await schedulePublishJob(updated, nextAttempt);

  return { post: updated, publishJobQueued };
}

/** Publish a draft immediately by moving it through the scheduled state. */
export async function publishNow(
  context: WorkspaceContext,
  supabase: ServerSupabase,
  postId: string,
): Promise<PostMutationResult> {
  return updatePost(context, supabase, postId, { intent: "publish_now" });
}

/**
 * Admin-path helper for background jobs: list posts due for publishing.
 * Uses the service-role client because no user session exists inside a job.
 */
export async function listDuePosts(limit = 50): Promise<PostRow[]> {
  const admin = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  const { data } = await admin
    .from("posts")
    .select("*")
    .eq("status", "scheduled")
    .lte("scheduled_at", nowIso)
    .order("scheduled_at", { ascending: true })
    .limit(limit);

  return (data ?? []) as PostRow[];
}
