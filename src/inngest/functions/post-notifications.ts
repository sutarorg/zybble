import { inngest } from "@/inngest/client";
import { cron, event } from "@/inngest/functions/triggers";
import { logger } from "@/lib/logger";
import { deliverTemplateToUser, deliverTemplateToWorkspace } from "@/features/notifications/email";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PostRow, ProfileRow } from "@/lib/supabase/database.types";

/** Short, human label for a post that has no title column. */
function postLabel(body: string | null | undefined): string {
  const text = (body ?? "").replace(/\s+/g, " ").trim();
  if (text.length === 0) return "Untitled post";
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
}

async function loadPost(postId: string): Promise<PostRow | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("posts").select("*").eq("id", postId).maybeSingle();
  return (data as PostRow | null) ?? null;
}

async function loadProfile(userId: string): Promise<{ email: string; fullName: string | null } | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("profiles").select("email, full_name").eq("id", userId).maybeSingle();
  const row = data as Pick<ProfileRow, "email" | "full_name"> | null;
  return row ? { email: row.email, fullName: row.full_name } : null;
}

/**
 * Notify the author and everyone who opted in when a post goes live.
 */
export const notifyPostPublished = inngest.createFunction(
  {
    id: "notify-post-published",
    name: "Notify: post published",
    retries: 2,
    triggers: [event("post/published")],
  },
  async ({ event, step }) => {
    const { postId, workspaceId, linkedinPostUrn } = event.data;
    const post = await step.run("load-post", () => loadPost(postId));

    if (!post) return { skipped: "post_missing" };

    const shareId = linkedinPostUrn.split(":").pop();
    const postUrl = shareId ? `https://www.linkedin.com/feed/update/${linkedinPostUrn}` : null;

    await step.run("in-app-notification", async () => {
      await createSupabaseAdminClient().from("notifications").insert({
        workspace_id: workspaceId,
        user_id: post.created_by,
        kind: "post_published",
        title: "Post published",
        body: `“${postLabel(post.body)}” is live on LinkedIn.`,
        severity: "success",
        action_url: "/analytics",
        metadata: { postId, linkedinPostUrn } as never,
      });
    });

    const result = await step.run("email", () =>
      deliverTemplateToUser({
        userId: post.created_by,
        template: "post_published",
        payload: { postTitle: postLabel(post.body), postUrl, workspaceName: null },
      }),
    );

    return { sent: result.sent, skipped: result.skipped };
  },
);

/**
 * Notify on failure. This is the user-visible "never silently mark failed ops
 * successful" path: the post is moved to `failed` with a readable reason and the
 * author is told exactly what to do about it.
 */
export const notifyPostFailed = inngest.createFunction(
  {
    id: "notify-post-failed",
    name: "Notify: post failed",
    retries: 2,
    triggers: [event("post/publish.failed")],
  },
  async ({ event, step }) => {
    const { postId, workspaceId, attempt, retryable, reason } = event.data;
    const post = await step.run("load-post", () => loadPost(postId));

    if (!post) return { skipped: "post_missing" };

    await step.run("in-app-notification", async () => {
      await createSupabaseAdminClient().from("notifications").insert({
        workspace_id: workspaceId,
        user_id: post.created_by,
        kind: "post_failed",
        title: "Post failed to publish",
        body: `“${postLabel(post.body)}” could not be published. ${reason}`,
        severity: "error",
        action_url: "/posts",
        metadata: { postId, attempt, retryable } as never,
      });
    });

    const result = await step.run("email", () =>
      deliverTemplateToUser({
        userId: post.created_by,
        template: "post_failed",
        payload: { postTitle: postLabel(post.body), failureReason: reason },
      }),
    );

    return { sent: result.sent, skipped: result.skipped };
  },
);

/**
 * Scheduled-post reminder. Only sent when the author enabled
 * `email_post_reminder`, and the reminder event is only ever queued alongside a
 * scheduled post (never for drafts).
 */
export const sendPostReminder = inngest.createFunction(
  {
    id: "send-post-reminder",
    name: "Notify: post reminder",
    retries: 2,
    triggers: [event("post/reminder.requested")],
  },
  async ({ event, step }) => {
    const { postId, workspaceId, scheduledAt } = event.data;
    const post = await step.run("load-post", () => loadPost(postId));

    if (!post || post.status !== "scheduled") {
      return { skipped: post ? "post_not_scheduled" : "post_missing" };
    }

    const formatted = new Date(scheduledAt).toUTCString();

    await step.run("in-app-notification", async () => {
      await createSupabaseAdminClient().from("notifications").insert({
        workspace_id: workspaceId,
        user_id: post.created_by,
        kind: "post_reminder",
        title: "Your post publishes soon",
        body: `“${postLabel(post.body)}” is scheduled for ${formatted}.`,
        severity: "info",
        action_url: "/posts",
        metadata: { postId } as never,
      });
    });

    const result = await step.run("email", () =>
      deliverTemplateToUser({
        userId: post.created_by,
        template: "post_reminder",
        payload: { postTitle: postLabel(post.body), scheduledAt: formatted },
      }),
    );

    return { sent: result.sent, skipped: result.skipped };
  },
);

/**
 * LinkedIn connection expiry / revocation sweep.
 *
 * Extends a token that is close to expiry, warns the workspace when a token is
 * about to expire and cannot be refreshed, and marks connections revoked when
 * LinkedIn rejects the refresh.
 */
export const notifyWorkspacePostFailedSummary = inngest.createFunction(
  {
    id: "post-failure-digest",
    name: "Notify: workspace failure digest",
    retries: 1,
    triggers: [cron("0 9 * * *")],
  },
  async ({ step }) => {
    const summary = await step.run("count-open-failures", async () => {
      const admin = createSupabaseAdminClient();
      const { data } = await admin
        .from("posts")
        .select("workspace_id")
        .eq("status", "failed");

      const counts = new Map<string, number>();

      for (const row of (data ?? []) as Array<{ workspace_id: string }>) {
        counts.set(row.workspace_id, (counts.get(row.workspace_id) ?? 0) + 1);
      }

      return Array.from(counts.entries()).map(([workspaceId, count]) => ({ workspaceId, count }));
    });

    for (const entry of summary) {
      if (entry.count === 0) continue;

      await step.run(`digest-${entry.workspaceId}`, async () => {
        await createSupabaseAdminClient().from("notifications").insert({
          workspace_id: entry.workspaceId,
          user_id: null,
          kind: "system",
          title: `${entry.count} post${entry.count === 1 ? "" : "s"} need attention`,
          body: "Some scheduled posts failed to publish. Open the posts list to review and retry them.",
          severity: "warning",
          action_url: "/posts",
          metadata: { count: entry.count } as never,
        });
      });
    }

    return { workspaces: summary.length };
  },
);

export { deliverTemplateToWorkspace, loadProfile };
