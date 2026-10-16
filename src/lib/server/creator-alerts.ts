/**
 * Telling a creator something happened in their studio.
 *
 * Every alert here is a pair: an in-app notification and an email. Both are
 * gated by the creator's own `/creator/settings` switches — `notify_in_app` for
 * the bell, and one of the four `email_*` columns for the message — so the
 * settings page controls behaviour instead of merely describing it.
 *
 * Alerts are best-effort by contract. They run after the business change is
 * committed (a captured payment, a published review), and a failure to notify
 * must never roll that change back or surface as an error to the learner who
 * triggered it.
 */

import "server-only";
import { createServiceClient, type ServiceClient } from "@/lib/supabase/server";
import { enqueueEmail, type EmailTemplate } from "@/lib/server/email";

export type CreatorAlertKind = "new_enrollment" | "new_review";

const EMAIL_COLUMN: Record<CreatorAlertKind, string> = {
  new_enrollment: "email_new_enrollment",
  new_review: "email_new_review",
};

const EMAIL_TEMPLATE: Record<CreatorAlertKind, EmailTemplate> = {
  new_enrollment: "creator_new_enrollment",
  new_review: "creator_new_review",
};

export interface CreatorAlert {
  creatorId: string;
  kind: CreatorAlertKind;
  notification: { title: string; body: string; href: string };
  payload: Record<string, string | number>;
  /** Stable per business event, so a replayed webhook notifies once. */
  idempotencyKey: string;
}

export interface CreatorAlertResult {
  notified: boolean;
  queued: boolean;
  /** Set when the creator turned the channel off — not an error. */
  skipped?: "in_app" | "email";
}

/**
 * Raises one studio alert.
 *
 * Never throws: callers are payment and review paths that have already done the
 * important work.
 */
export async function alertCreator(
  alert: CreatorAlert,
  service: ServiceClient | null = createServiceClient()
): Promise<CreatorAlertResult> {
  const result: CreatorAlertResult = { notified: false, queued: false };
  if (!service) return result;

  try {
    const [{ data: prefs }, { data: profile }] = await Promise.all([
      service
        .from("creator_studio_preferences")
        .select("notify_in_app, email_new_enrollment, email_new_review")
        .eq("user_id", alert.creatorId)
        .maybeSingle(),
      service.from("profiles").select("email, full_name").eq("id", alert.creatorId).maybeSingle(),
    ]);

    const settings = (prefs ?? null) as Record<string, unknown> | null;
    // No row yet: the schema defaults apply, which is what the settings page
    // shows a creator who has never opened it.
    const inAppWanted = settings ? Boolean(settings.notify_in_app) : true;

    if (inAppWanted) {
      const { error } = await service.from("notifications").insert({
        user_id: alert.creatorId,
        kind: alert.kind === "new_enrollment" ? "course" : "system",
        title: alert.notification.title,
        body: alert.notification.body,
        href: alert.notification.href,
      });
      if (error) {
        console.error("[creator-alert] notification failed", {
          creator: alert.creatorId,
          reason: error.message.slice(0, 200),
        });
      } else {
        result.notified = true;
      }
    } else {
      result.skipped = "in_app";
    }

    const recipient = (profile ?? null) as { email?: string | null; full_name?: string | null } | null;
    if (!recipient?.email) return result;

    const emailWanted = settings ? Boolean(settings[EMAIL_COLUMN[alert.kind]]) : true;
    if (!emailWanted) {
      result.skipped = result.skipped ?? "email";
      return result;
    }

    // `enqueueEmail` re-checks the same preference, so a creator who turned the
    // alert off between the read above and the insert is still respected.
    const queued = await enqueueEmail({
      to: recipient.email,
      userId: alert.creatorId,
      template: EMAIL_TEMPLATE[alert.kind],
      payload: {
        creatorName: String(recipient.full_name ?? "there"),
        ...alert.payload,
      },
      idempotencyKey: alert.idempotencyKey,
    });

    if (queued.queued) result.queued = true;
    else if (queued.error) {
      console.error("[creator-alert] email not queued", {
        creator: alert.creatorId,
        reason: queued.error.slice(0, 200),
      });
    }

    return result;
  } catch (error) {
    console.error("[creator-alert] failed", {
      creator: alert.creatorId,
      kind: alert.kind,
      reason: error instanceof Error ? error.message.slice(0, 200) : "unknown",
    });
    return result;
  }
}
