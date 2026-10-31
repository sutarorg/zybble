import { NonRetriableError } from "inngest";
import { inngest } from "@/inngest/client";
import { cron, event } from "@/inngest/functions/triggers";
import {
  deliverInvitationEmail,
  deliverTemplateToUser,
  deliverTemplateToWorkspace,
  type EmailTemplate,
} from "@/features/notifications/email";
import { logger } from "@/lib/logger";

const KNOWN_TEMPLATES: readonly EmailTemplate[] = [
  "welcome",
  "linkedin_connected",
  "linkedin_reauth_required",
  "post_published",
  "post_failed",
  "post_reminder",
  "subscription_confirmed",
  "payment_failed",
  "subscription_cancelled",
  "team_invitation",
];

function isTemplate(value: string): value is EmailTemplate {
  return (KNOWN_TEMPLATES as readonly string[]).includes(value);
}

/**
 * Transactional email delivery.
 *
 * The event carries a user id or a workspace id — never an email address — so
 * event payloads retained by Inngest stay free of personal data. Preferences are
 * checked at send time, and a missing address or an opted-out recipient is a
 * successful no-op rather than a failure.
 */
export const sendTransactionalEmail = inngest.createFunction(
  {
    id: "send-transactional-email",
    name: "Send transactional email",
    retries: 3,
    triggers: [event("email/send")],
  },
  async ({ event, step }) => {
    const { template, userId, workspaceId, payload } = event.data;

    if (!isTemplate(template)) {
      logger.error("email.unknown_template", { template });
      throw new NonRetriableError(`Unknown email template: ${template}`);
    }

    if (template === "team_invitation" && payload?.invitationId) {
      // Invitations go to an address that has no account yet.
      const result = await step.run("send-invitation", () =>
        deliverInvitationEmail({
          invitationId: String(payload.invitationId),
          workspaceName: (payload.workspaceName as string | undefined) ?? null,
          inviterName: (payload.inviterName as string | undefined) ?? null,
          actionUrl: (payload.actionUrl as string | undefined) ?? null,
        }),
      );

      return result;
    }

    if (userId) {
      const result = await step.run("send-to-user", () =>
        deliverTemplateToUser({
          userId,
          template,
          payload: (payload ?? {}) as never,
        }),
      );

      return result;
    }

    if (workspaceId) {
      const result = await step.run("send-to-workspace", () =>
        deliverTemplateToWorkspace({
          workspaceId,
          template,
          payload: (payload ?? {}) as never,
        }),
      );

      return result;
    }

    logger.warn("email.no_recipient", { template });
    return { sent: 0, skipped: 0, failed: 0, recipients: [] };
  },
);
