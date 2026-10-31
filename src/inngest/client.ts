import { Inngest } from "inngest";
import { env } from "@/lib/env";

/**
 * Event catalogue.
 *
 * Every background transition in the product is an event, so the whole system is
 * replayable and observable in the Inngest dashboard. Payloads carry ids — never
 * post bodies, tokens or email addresses — because events are retained and shown
 * in a UI.
 *
 * The catalogue is the single source of truth for event *shape*: each function
 * binds its trigger with `eventType(name, { schema: staticSchema<Events[name]>() })`,
 * so a typo in a payload is a compile error rather than a silent runtime
 * mismatch. `staticSchema` is type-only (no runtime cost) — payloads are
 * validated where they are created, not again on the wire.
 */
export type Events = {
  /** A post reached `scheduled` (or was asked to publish immediately). */
  "post/publish.requested": {
    data: {
      postId: string;
      workspaceId: string;
      /** UTC instant the run should fire at. */
      scheduledAt: string;
      /** Attempt number claimed by the caller. */
      attempt: number;
    };
  };
  /** Cancel a pending publish run (post deleted, cancelled or rescheduled). */
  "post/publish.cancelled": {
    data: { postId: string; workspaceId: string; reason?: string };
  };
  /** A scheduled post is due in `reminderLeadMinutes`. */
  "post/reminder.requested": {
    data: { postId: string; workspaceId: string; scheduledAt: string };
  };
  "post/published": {
    data: { postId: string; workspaceId: string; linkedinPostUrn: string };
  };
  "post/publish.failed": {
    data: {
      postId: string;
      workspaceId: string;
      attempt: number;
      retryable: boolean;
      reason: string;
    };
  };
  /** Fetch metrics for one published post. */
  "analytics/post.sync": {
    data: { postId: string; workspaceId: string };
  };
  /** Fan-out entry point for a workspace-wide analytics sweep. */
  "analytics/workspace.sync": {
    data: { workspaceId: string };
  };
  /** Recompute the best-time grid for a connection. */
  "analytics/best-time.recompute": {
    data: { workspaceId: string; linkedinAccountId: string };
  };
  /** Connection health sweep (expiry warnings, revoked detection). */
  "linkedin/connections.check": {
    data: { reason: "cron" | "manual" };
  };
  /** Push the current seat count to Dodo after a membership change. */
  "billing/seats.sync": {
    data: { workspaceId: string; actorUserId: string | null };
  };
  /** Reconcile subscription state against the provider. */
  "billing/reconcile": {
    data: { reason: "cron" | "manual" };
  };
  /**
   * Queue a transactional email.
   *
   * The event carries ids only — never an email address — because Inngest
   * retains and displays event payloads. The address is resolved from the
   * profile at send time.
   */
  "email/send": {
    data: {
      template: string;
      /** Recipient user id; when absent the whole workspace is notified. */
      userId?: string | null;
      workspaceId?: string | null;
      payload?: Record<string, unknown>;
    };
  };
  /** Erase a workspace's data (account deletion). */
  "workspace/delete.requested": {
    data: { workspaceId: string; requestedBy: string };
  };
};

function inngestOptions() {
  const configuration = env();
  const dev =
    configuration.INNGEST_DEV ??
    (configuration.NODE_ENV !== "production" ? true : undefined);

  return {
    id: "zybble",
    ...(dev !== undefined ? { isDev: dev } : {}),
    ...(configuration.INNGEST_EVENT_KEY ? { eventKey: configuration.INNGEST_EVENT_KEY } : {}),
  };
}

export const inngest = new Inngest(inngestOptions());

export function isInngestConfigured(): boolean {
  return Boolean(env().INNGEST_EVENT_KEY) || env().NODE_ENV !== "production";
}

/**
 * Send one or more events.
 *
 * Failures are logged and swallowed at call sites that must not fail the user's
 * request (e.g. notifications); call sites where scheduling *is* the request
 * (e.g. "schedule this post") treat a thrown error as a failed operation.
 */
export async function sendEvents<TEvent extends keyof Events>(
  events: Array<{ name: TEvent; data: Events[TEvent]["data"] }>,
): Promise<void> {
  if (events.length === 0) return;
  await inngest.send(events as never);
}
