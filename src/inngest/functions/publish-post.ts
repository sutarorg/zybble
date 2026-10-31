import { NonRetriableError } from "inngest";
import { inngest } from "@/inngest/client";
import { cron, event } from "@/inngest/functions/triggers";
import { logger } from "@/lib/logger";
import { emitPublishEvents, publishPostById, reconcileStuckPosts } from "@/features/posts/publish";

/**
 * The publish run.
 *
 * Everything dangerous lives inside `publishPostById`:
 *
 *  - claiming (unique `(post_id, attempt)` index means a redelivered event
 *    cannot start a second run),
 *  - a CAS update to `publishing` guarded on `linkedin_post_urn IS NULL`,
 *  - a single LinkedIn call with `retries: 0`.
 *
 * The function itself only decides whether Inngest should retry. Retryable
 * failures (LinkedIn 5xx / timeouts / rate limits) are re-thrown so Inngest
 * applies its backoff; everything else is wrapped in `NonRetriableError` so a
 * permission error or a bad media file never loops.
 *
 * `cancelOn` removes the pending run when the post is deleted, cancelled or
 * rescheduled, and the `postId` concurrency key guarantees serial execution even
 * if the cancellation event races the run.
 */
export const publishScheduledPost = inngest.createFunction(
  {
    id: "publish-scheduled-post",
    name: "Publish scheduled post",
    retries: 2,
    concurrency: {
      key: "event.data.postId",
      limit: 1,
    },
    cancelOn: [
      {
        event: "post/publish.cancelled",
        if: "event.data.postId == async.data.postId",
      },
    ],
    triggers: [event("post/publish.requested")],
  },
  async ({ event, step }) => {
    const { postId, workspaceId, attempt } = event.data;

    const outcome = await step.run("publish", async () =>
      publishPostById({ postId, workspaceId, attempt }),
    );

    await step.run("emit-lifecycle-events", async () => {
      await emitPublishEvents({ ...outcome, workspaceId });
    });

    if (outcome.status === "published") {
      await step.run("queue-analytics-sync", async () => {
        await inngest.send({ name: "analytics/post.sync", data: { postId, workspaceId } });
      });
      return { postId, status: outcome.status, urn: outcome.urn ?? null };
    }

    if (outcome.status === "skipped") {
      logger.info("publish.skipped", { postId, reason: outcome.reason });
      return { postId, status: outcome.status, reason: outcome.reason ?? null };
    }

    logger.warn("publish.failed", {
      postId,
      attempt,
      retryable: outcome.retryable,
      reason: outcome.reason,
    });

    if (outcome.retryable) {
      throw new Error(outcome.reason ?? "Publishing failed with a retryable error.");
    }

    throw new NonRetriableError(outcome.reason ?? "Publishing failed.", {
      cause: outcome.reason,
    });
  },
);

/**
 * Safety net: publish runs that never reported back (killed worker, hung HTTP
 * call) leave an attempt in `started`. They are resolved as UNKNOWN_OUTCOME so
 * the user is told to check LinkedIn before retrying instead of gambling on a
 * duplicate post.
 */
export const reconcileStuckPublishes = inngest.createFunction(
  {
    id: "reconcile-stuck-publishes",
    name: "Reconcile stuck publish runs",
    retries: 1,
    triggers: [cron("*/15 * * * *")],
  },
  async ({ step }) => {
    const result = await step.run("reconcile", async () => reconcileStuckPosts());
    return result;
  },
);

/**
 * Dispatcher: catches posts whose run never arrived (Inngest event lost, server
 * down at schedule time). It only touches posts whose `scheduled_at` is at least
 * one minute in the past, so a post scheduled for "now" is never double-fired
 * against its Inngest run — the unique attempt index absorbs the overlap either
 * way.
 */
export const dispatchDuePosts = inngest.createFunction(
  {
    id: "dispatch-due-posts",
    name: "Dispatch due posts",
    retries: 1,
    concurrency: { limit: 1 },
    triggers: [cron("* * * * *")],
  },
  async ({ step }) => {
    const due = await step.run("list-due", async () => {
      const { listDuePosts } = await import("@/features/posts/service");
      return listDuePosts(50);
    });

    const dispatched: string[] = [];

    for (const post of due) {
      const postId = post.id as string;
      const workspaceId = post.workspace_id as string;

      await step.run(`dispatch-${postId}`, async () => {
        await inngest.send({
          name: "post/publish.requested",
          data: {
            postId,
            workspaceId,
            scheduledAt: (post.scheduled_at as string) ?? new Date().toISOString(),
            attempt: (post.attempts as number) + 1,
          },
        });
      });

      dispatched.push(postId);
    }

    return { dispatched: dispatched.length };
  },
);
