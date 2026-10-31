import { cron, event } from "@/inngest/functions/triggers";
import { inngest } from "@/inngest/client";
import { logger } from "@/lib/logger";
import { getUsableConnection, LinkedInConnectionError, markConnectionStatus } from "@/features/linkedin/tokens";
import { deliverTemplateToWorkspace } from "@/features/notifications/email";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { LinkedInAccountRow } from "@/lib/supabase/database.types";

/**
 * Connection health sweep.
 *
 * LinkedIn access tokens are short-lived and refresh tokens are not issued for
 * every application configuration, so expiry is a normal product state — not an
 * error. This job:
 *
 *  1. refreshes tokens that are within the refresh window,
 *  2. marks connections that LinkedIn rejects as `reauth_required`,
 *  3. warns the workspace 7 days before an unavoidable expiry.
 *
 * Nothing is retried forever: after a refresh failure the connection becomes
 * `reauth_required`, scheduled posts stay put (they are never published through
 * a dead connection), and the user gets a "Reconnect LinkedIn" email.
 */

const WARNING_DAYS = 7;

type CheckOutcome = {
  accountId: string;
  workspaceId: string;
  outcome: "ok" | "reauth_required" | "error";
  daysLeft: number | null;
  refreshable: boolean;
};

export const checkLinkedInConnections = inngest.createFunction(
  {
    id: "check-linkedin-connections",
    name: "Check LinkedIn connection health",
    retries: 2,
    triggers: [event("linkedin/connections.check"), cron("0 6 * * *")],
  },
  async ({ step }) => {
    const accounts = await step.run("list-connections", async () => {
      const admin = createSupabaseAdminClient();
      const { data } = await admin
        .from("linkedin_accounts")
        .select("*")
        .in("status", ["active", "reauth_required", "expired"]);

      return (data ?? []) as LinkedInAccountRow[];
    });

    const summary = { checked: accounts.length, ok: 0, needsReauth: 0, warned: 0, errors: 0 };

    for (const account of accounts) {
      const result = await step.run(`check-${account.id}`, async (): Promise<CheckOutcome> => {
        try {
          const connection = await getUsableConnection(account.id);

          const daysLeft = connection.expiresAt
            ? Math.floor((connection.expiresAt.getTime() - Date.now()) / 86_400_000)
            : null;

          return {
            accountId: account.id,
            workspaceId: account.workspace_id,
            outcome: "ok",
            daysLeft,
            refreshable: connection.refreshable,
          };
        } catch (error) {
          if (error instanceof LinkedInConnectionError) {
            return {
              accountId: account.id,
              workspaceId: account.workspace_id,
              outcome: "reauth_required",
              daysLeft: null,
              refreshable: false,
            };
          }

          logger.error("linkedin.health_check_failed", {
            accountId: account.id,
            error: error instanceof Error ? error.message : "unknown",
          });

          return {
            accountId: account.id,
            workspaceId: account.workspace_id,
            outcome: "error",
            daysLeft: null,
            refreshable: false,
          };
        }
      });

      if (result.outcome === "error") {
        summary.errors += 1;
        continue;
      }

      if (result.outcome === "reauth_required") {
        summary.needsReauth += 1;

        await step.run(`notify-${account.id}`, async () => {
          await markConnectionStatus(account.id, "reauth_required");

          await createSupabaseAdminClient().from("notifications").insert({
            workspace_id: result.workspaceId,
            user_id: null,
            kind: "token_revoked",
            title: "Reconnect your LinkedIn account",
            body: `${account.display_name ?? "A LinkedIn account"} can no longer publish. Scheduled posts are paused until you reconnect.`,
            severity: "error",
            action_url: "/settings/accounts",
            metadata: { accountId: account.id } as never,
          });

          await deliverTemplateToWorkspace({
            workspaceId: result.workspaceId,
            template: "linkedin_reauth_required",
            payload: { accountName: account.display_name ?? null },
          });
        });

        continue;
      }

      summary.ok += 1;

      if (result.daysLeft !== null && result.daysLeft <= WARNING_DAYS) {
        summary.warned += 1;

        await step.run(`warn-${account.id}`, async () => {
          await createSupabaseAdminClient().from("notifications").insert({
            workspace_id: result.workspaceId,
            user_id: null,
            kind: "token_expiring",
            title: "LinkedIn access expires soon",
            body: result.refreshable
              ? `Access for ${account.display_name ?? "your LinkedIn account"} expires in ${result.daysLeft} day(s). We will renew it automatically.`
              : `Access for ${account.display_name ?? "your LinkedIn account"} expires in ${result.daysLeft} day(s). Reconnect to keep scheduled posts publishing.`,
            severity: "warning",
            action_url: "/settings/accounts",
            metadata: { accountId: account.id, daysLeft: result.daysLeft } as never,
          });
        });
      }
    }

    return summary;
  },
);
