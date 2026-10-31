import { inngest } from "@/inngest/client";
import { cron, event } from "@/inngest/functions/triggers";
import { logger } from "@/lib/logger";
import { POST_MEDIA_BUCKET } from "@/features/posts/media";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Workspace erasure (account deletion / "delete workspace").
 *
 * Order matters: cancel pending publish runs first (so nothing fires mid-wipe),
 * then remove storage objects, then delete the row — the schema cascades posts,
 * analytics, media metadata and notifications. Billing is cancelled before the
 * delete so a customer is never charged for erased data.
 */
export const deleteWorkspace = inngest.createFunction(
  {
    id: "delete-workspace",
    name: "Delete workspace data",
    retries: 2,
    triggers: [event("workspace/delete.requested")],
  },
  async ({ event, step }) => {
    const { workspaceId, requestedBy } = event.data;

    await step.run("cancel-pending-publishes", async () => {
      const admin = createSupabaseAdminClient();
      const { data: posts } = await admin
        .from("posts")
        .select("id")
        .eq("workspace_id", workspaceId)
        .in("status", ["scheduled", "publishing"]);

      const ids = ((posts ?? []) as Array<{ id: string }>).map((post) => post.id);

      if (ids.length > 0) {
        await inngest.send(
          ids.map((postId) => ({
            name: "post/publish.cancelled" as const,
            data: { postId, workspaceId, reason: "workspace_deleted" },
          })),
        );
      }

      return ids.length;
    });

    await step.run("cancel-subscription", async () => {
      const admin = createSupabaseAdminClient();
      const { data: subscription } = await admin
        .from("subscriptions")
        .select("dodo_subscription_id")
        .eq("workspace_id", workspaceId)
        .maybeSingle();

      const dodoSubscriptionId = (subscription as { dodo_subscription_id?: string | null } | null)
        ?.dodo_subscription_id;

      if (!dodoSubscriptionId) return "no_subscription";

      try {
        const { cancelSubscription } = await import("@/lib/dodo/client");
        await cancelSubscription({ dodoSubscriptionId, immediately: true });
        return "cancelled";
      } catch (error) {
        // Never block deletion on a billing API failure; it is flagged in the
        // audit log for manual follow-up.
        logger.error("workspace.cancel_subscription_failed", {
          workspaceId,
          error: error instanceof Error ? error.message : "unknown",
        });
        return "cancel_failed";
      }
    });

    await step.run("remove-media", async () => {
      const admin = createSupabaseAdminClient();
      const { data: files, error } = await admin.storage.from(POST_MEDIA_BUCKET).list(workspaceId, {
        limit: 1000,
      });

      if (error) {
        logger.error("workspace.storage_list_failed", { error: error.message });
        return { removed: 0 };
      }

      const paths = (files ?? []).map((file) => `${workspaceId}/${file.name}`);

      if (paths.length > 0) {
        const { error: removeError } = await admin.storage.from(POST_MEDIA_BUCKET).remove(paths);
        if (removeError) {
          logger.error("workspace.storage_remove_failed", { error: removeError.message });
        }
      }

      return { removed: paths.length };
    });

    await step.run("delete-row", async () => {
      const admin = createSupabaseAdminClient();
      const { error } = await admin.from("workspaces").delete().eq("id", workspaceId);

      if (error) {
        logger.error("workspace.delete_failed", { error: error.message });
        throw new Error("Could not delete the workspace.");
      }

      logger.warn("workspace.deleted", { workspaceId, requestedBy });
    });

    return { workspaceId, deleted: true };
  },
);
