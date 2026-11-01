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
   * Cancel a live subscription at the provider immediately.
   *
   * Used when the workspace (or the account that owns it) is being deleted —
   * the subscription row is about to disappear, so the provider has to be told
   * first or Dodo would keep billing a customer that no longer exists.
   */
  "billing/subscription.cancel": {
    data: { workspaceId: string; reason: "workspace_deleted" | "account_deleted" };
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

  // Three-state decision: an explicit INNGEST_DEV override wins, otherwise
  // anything that is not production talks to a local dev server, and
  // production talks to Inngest Cloud.
  const isDev = configuration.INNGEST_DEV ?? configuration.NODE_ENV !== "production";

  return {
    id: "zybble",
    isDev,
    /**
     * The signing key is what lets this endpoint prove a request really came
     * from Inngest. Without it the SDK will not serve at all: it answers 500
     * to GET, PUT and POST alike, which the dashboard reports as "the URL is
     * unreachable". It is read from the environment explicitly rather than
     * left to the SDK's own `process.env` lookup, so that the configuration
     * the app believes it has and the configuration the SDK uses cannot
     * drift apart.
     */
    ...(configuration.INNGEST_SIGNING_KEY
      ? { signingKey: configuration.INNGEST_SIGNING_KEY }
      : {}),
    ...(configuration.INNGEST_EVENT_KEY ? { eventKey: configuration.INNGEST_EVENT_KEY } : {}),
  };
}

export const inngest = new Inngest(inngestOptions());

/** True when this deployment is talking to Inngest Cloud rather than a dev server. */
function inCloudMode(): boolean {
  const configuration = env();
  return !(configuration.INNGEST_DEV ?? configuration.NODE_ENV !== "production");
}

/**
 * Can this deployment *receive* work from Inngest?
 *
 * This is the condition `/api/inngest` needs. Cloud mode verifies a signature
 * on every request, so it needs the signing key; a dev server does not.
 */
export function isInngestServeConfigured(): boolean {
  if (!inCloudMode()) return true;
  return Boolean(env().INNGEST_SIGNING_KEY);
}

/**
 * Can this deployment *send* events?
 *
 * A different credential from serving: the event key authorises outbound
 * events, the signing key authorises inbound requests. Reporting one as the
 * other is how a deployment looks healthy while its endpoint returns 500.
 */
export function canSendInngestEvents(): boolean {
  if (!inCloudMode()) return true;
  return Boolean(env().INNGEST_EVENT_KEY);
}

/**
 * Why the endpoint cannot serve, or `null` when it can.
 *
 * Returned to a caller that probes `/api/inngest` and logged on every
 * rejected request, so "unreachable" in the Inngest dashboard is immediately
 * traceable to the exact missing variable.
 */
export function inngestServeProblem(): { variable: string; message: string } | null {
  if (isInngestServeConfigured()) return null;
  return {
    variable: "INNGEST_SIGNING_KEY",
    message:
      "Inngest is in cloud mode but has no signing key, so /api/inngest cannot verify " +
      "that a request came from Inngest and refuses every request. Set INNGEST_SIGNING_KEY " +
      "to the signing key from the Inngest dashboard, redeploy, then sync with " +
      "curl -X PUT https://<your-domain>/api/inngest. Alternatively set INNGEST_DEV=true " +
      "to serve against a local dev server.",
  };
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
