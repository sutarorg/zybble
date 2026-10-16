/**
 * Transactional email via Resend.
 *
 * Delivery is **outbox-backed**: every template is written to
 * `email_outbox` inside the same transaction that commits the business state,
 * and a dispatcher sends it. A failed send can therefore never duplicate a
 * purchase, approval or transfer, and nothing is emailed before the state it
 * announces is committed.
 */

import "server-only";
import { Resend } from "resend";
import { serverEnv, siteOrigin } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/server";
import { formatInr } from "@/lib/money";

export type EmailTemplate =
  | "purchase_confirmation"
  | "course_submitted"
  | "course_approved"
  | "course_changes_requested"
  | "course_rejected"
  | "verify_email"
  | "course_update"
  | "weekly_learning_report"
  | "study_reminder"
  | "catalog_digest"
  | "security_password_reset_requested"
  | "security_email_changed"
  | "transfer_status"
  | "payout_requested"
  | "payout_approved"
  | "payout_paid"
  | "payout_rejected"
  | "payout_failed";

/** Runtime list used to validate outbox rows written by an older build. */
export const EMAIL_TEMPLATES = [
  "purchase_confirmation",
  "course_submitted",
  "course_approved",
  "course_changes_requested",
  "course_rejected",
  "verify_email",
  "course_update",
  "weekly_learning_report",
  "study_reminder",
  "catalog_digest",
  "security_password_reset_requested",
  "security_email_changed",
  "transfer_status",
  "payout_requested",
  "payout_approved",
  "payout_paid",
  "payout_rejected",
  "payout_failed",
] as const satisfies readonly EmailTemplate[];

let cached: Resend | null = null;

export class EmailNotConfiguredError extends Error {
  constructor() {
    super("Resend is not configured");
    this.name = "EmailNotConfiguredError";
  }
}

export function getResend(): Resend {
  if (!serverEnv.resendApiKey) throw new EmailNotConfiguredError();
  if (!cached) cached = new Resend(serverEnv.resendApiKey);
  return cached;
}

/* -------------------------------------------------------------------------- */
/* Templates                                                                   */
/* -------------------------------------------------------------------------- */

export interface EmailPayload {
  to: string;
  template: EmailTemplate;
  data: Record<string, string | number>;
  /** Unique per business event; a retry reuses the same key and cannot duplicate. */
  idempotencyKey: string;
}

const shell = (title: string, body: string) => `<!doctype html>
<html><body style="margin:0;background:#f6f6f8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#18181b">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e6e6ea;border-radius:14px;padding:32px">
        <tr><td><h1 style="margin:0 0 4px;font-size:19px;font-weight:650">Zybble</h1>
        <p style="margin:0 0 24px;color:#71717a;font-size:13px">AI courses from independent creators</p></td></tr>
        <tr><td><h2 style="margin:0 0 12px;font-size:16px;font-weight:600">${title}</h2>
        <div style="font-size:14px;line-height:1.65;color:#3f3f46">${body}</div></td></tr>
        <tr><td style="padding-top:28px;border-top:1px solid #f0f0f3;margin-top:28px">
          <p style="margin:0;font-size:12px;color:#a1a1aa">All prices are in Indian Rupees (INR, ₹).</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

const button = (href: string, label: string) =>
  `<p style="margin:24px 0 0"><a href="${href}" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;padding:11px 18px;border-radius:9px;font-size:14px;font-weight:550">${label}</a></p>`;

export function renderEmailTemplate(
  template: EmailTemplate,
  data: Record<string, string | number>
): { subject: string; html: string } {
  const origin = siteOrigin();
  switch (template) {
    case "purchase_confirmation": {
      const total = formatInr(Number(data.totalPaise ?? data.amountPaise ?? 0));
      const learnerName = data.learnerName ?? data.name ?? "there";
      return {
        subject: `Your Zybble receipt — ${data.courseTitle}`,
        html: shell(
          "Payment confirmed",
          `<p>Hi ${learnerName},</p>
           <p>We received your payment for <strong>${data.courseTitle}</strong>.</p>
           <table style="margin:16px 0;font-size:14px"><tr><td style="padding:4px 16px 4px 0;color:#71717a">Order</td><td style="font-family:ui-monospace,monospace">${data.orderRef}</td></tr>
           <tr><td style="padding:4px 16px 4px 0;color:#71717a">Amount paid</td><td><strong>${total}</strong></td></tr></table>
           <p>The course is now available in My Learning.</p>`
        ) + button(`${origin}/my-learning`, "Go to My Learning"),
      };
    }
    case "course_submitted":
      return {
        subject: `Course submitted for review — ${data.courseTitle}`,
        html: shell(
          "Submitted for review",
          `<p>Hi ${data.creatorName},</p><p><strong>${data.courseTitle}</strong> has been submitted to the Zybble moderation queue. You will get an email when a reviewer approves it, requests changes or rejects it.</p>`
        ) + button(`${origin}/creator/courses`, "Open Creator Studio"),
      };
    case "course_approved":
      return {
        subject: `Your course is live — ${data.courseTitle}`,
        html: shell(
          "Course approved and published",
          `<p>Hi ${data.creatorName},</p><p><strong>${data.courseTitle}</strong> is approved and now live in the Zybble catalog. Learners can discover and purchase it.</p>`
        ) + button(`${origin}/courses/${data.courseSlug}`, "View your course"),
      };
    case "course_changes_requested":
      return {
        subject: `Changes requested — ${data.courseTitle}`,
        html: shell(
          "Changes requested",
          `<p>Hi ${data.creatorName},</p><p>A reviewer asked for changes to <strong>${data.courseTitle}</strong>:</p>
           <blockquote style="margin:16px 0;padding:12px 16px;background:#fafafa;border-left:3px solid #d4d4d8;color:#52525b">${data.reason}</blockquote>
           <p>Update the course and resubmit it from Creator Studio.</p>`
        ) + button(`${origin}/creator/courses`, "Update and resubmit"),
      };
    case "course_rejected":
      return {
        subject: `Course not approved — ${data.courseTitle}`,
        html: shell(
          "Course not approved",
          `<p>Hi ${data.creatorName},</p><p><strong>${data.courseTitle}</strong> was not approved for the Zybble catalog.</p>
           <blockquote style="margin:16px 0;padding:12px 16px;background:#fafafa;border-left:3px solid #d4d4d8;color:#52525b">${data.reason}</blockquote>`
        ) + button(`${origin}/creator/courses`, "Open Creator Studio"),
      };
    case "verify_email":
      return {
        subject: "Confirm your Zybble email address",
        html: shell(
          "One last step",
          `<p>Hi ${data.name ?? "there"},</p>
           <p>Welcome to Zybble. Confirm your email address to finish setting up your account — it unlocks receipts, certificates and course updates.</p>
           <p style="color:#71717a;font-size:13px">If you did not create a Zybble account, you can ignore this email.</p>`
        ) + button(`${data.actionUrl ?? `${origin}/login`}`, "Confirm email address"),
      };
    case "course_update": {
      const courseUrl = String(data.courseUrl ?? `${origin}/my-learning`);
      return {
        subject: `New lesson in ${data.courseTitle}`,
        html: shell(
          "A course you are enrolled in was updated",
          `<p>Hi ${data.learnerName ?? "there"},</p>
           <p><strong>${data.courseTitle}</strong> has a new lesson:</p>
           <blockquote style="margin:16px 0;padding:12px 16px;background:#fafafa;border-left:3px solid #d4d4d8;color:#3f3f46">${data.lessonTitle ?? "New lesson"}</blockquote>
           <p>Your progress is saved, so you can pick up wherever you left off.</p>`
        ) + button(courseUrl, "Continue learning"),
      };
    }
    case "weekly_learning_report": {
      const lessons = Number(data.lessonsCompleted ?? 0);
      const streak = Number(data.streakDays ?? 0);
      const inProgress = Number(data.coursesInProgress ?? 0);
      const summary =
        lessons === 0
          ? `<p>No lessons were completed this week. A single lesson is enough to keep a streak alive.</p>`
          : `<p>You completed <strong>${lessons}</strong> ${lessons === 1 ? "lesson" : "lessons"} this week${
              streak > 0 ? ` and kept a <strong>${streak}-day</strong> streak going` : ""
            }.</p>`;
      return {
        subject: lessons > 0 ? `Your week on Zybble — ${lessons} ${lessons === 1 ? "lesson" : "lessons"} completed` : "Your week on Zybble",
        html: shell(
          "Weekly learning report",
          `<p>Hi ${data.learnerName ?? "there"},</p>
           ${summary}
           <table style="margin:16px 0;font-size:14px">
             <tr><td style="padding:4px 16px 4px 0;color:#71717a">Lessons completed</td><td><strong>${lessons}</strong></td></tr>
             <tr><td style="padding:4px 16px 4px 0;color:#71717a">Current streak</td><td><strong>${streak} ${streak === 1 ? "day" : "days"}</strong></td></tr>
             <tr><td style="padding:4px 16px 4px 0;color:#71717a">Courses in progress</td><td><strong>${inProgress}</strong></td></tr>
           </table>`
        ) + button(`${origin}/my-learning`, "Open My Learning"),
      };
    }
    case "study_reminder": {
      const courseUrl = String(data.courseUrl ?? `${origin}/my-learning`);
      const courseTitle = data.courseTitle ? String(data.courseTitle) : null;
      return {
        subject: courseTitle ? `Continue ${courseTitle}` : "Your Zybble lessons are waiting",
        html: shell(
          "A quick nudge",
          `<p>Hi ${data.learnerName ?? "there"},</p>
           <p>${
             courseTitle
               ? `You left off in <strong>${courseTitle}</strong>. One lesson today keeps your streak alive.`
               : "You have lessons waiting in My Learning. One short session today keeps your streak alive."
           }</p>`
        ) + button(courseUrl, "Resume where you left off"),
      };
    }
    case "catalog_digest": {
      const items = String(data.items ?? "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 6);
      const list =
        items.length > 0
          ? `<ul style="margin:16px 0;padding-left:18px;font-size:14px;color:#3f3f46">${items
              .map((item) => `<li style="padding:3px 0">${item}</li>`)
              .join("")}</ul>`
          : "";
      return {
        subject: `${items.length} ${items.length === 1 ? "course" : "courses"} worth a look this week`,
        html: shell(
          "New and discounted in the catalog",
          `<p>Hi ${data.learnerName ?? "there"},</p>
           <p>Here is what changed on Zybble this week. Prices are in Indian Rupees and every course is taught by an independent creator.</p>
           ${list}`
        ) + button(`${origin}/explore`, "Browse the catalog"),
      };
    }
    case "security_password_reset_requested":
      return {
        subject: "Reset your Zybble password",
        html: shell(
          "Password reset requested",
          `<p>We received a request to reset the password for your Zybble account.</p>
           <p>If you did not request this, you can ignore this email — your password stays unchanged.</p>`
        ) + button(`${data.actionUrl ?? `${origin}/login`}`, "Reset password"),
      };
    case "security_email_changed":
      return {
        subject: "Your Zybble email address was changed",
        html: shell(
          "Account security alert",
          `<p>Hi ${data.name ?? "there"},</p><p>The email address on your Zybble account was changed. If this wasn't you, contact support immediately.</p>`
        ),
      };
    case "payout_requested": {
      const ref = String(data.payoutRef ?? data.publicId ?? "");
      const amount = data.amountPaise !== undefined ? formatInr(Number(data.amountPaise ?? 0)) : String(data.amount ?? formatInr(0));
      const masked = String(data.maskedDestination ?? data.destinationMasked ?? "Saved destination");
      return {
        subject: `Payout request received — ${ref}`,
        html: shell(
          "Payout request received",
          `<p>Hi ${data.creatorName ?? "there"},</p>
           <p>We received your manual payout request for <strong>${amount}</strong>.</p>
           <table style="margin:16px 0;font-size:14px">
             <tr><td style="padding:4px 16px 4px 0;color:#71717a">Request ID</td><td style="font-family:ui-monospace,monospace">${ref}</td></tr>
             <tr><td style="padding:4px 16px 4px 0;color:#71717a">Amount</td><td><strong>${amount}</strong></td></tr>
             <tr><td style="padding:4px 16px 4px 0;color:#71717a">Destination</td><td>${masked}</td></tr>
             <tr><td style="padding:4px 16px 4px 0;color:#71717a">Status</td><td>Requested · awaiting review</td></tr>
           </table>
           <p>This amount is reserved from your available balance while an administrator reviews and processes the transfer.</p>`
        ) + button(`${origin}/creator/payouts`, "View payout requests"),
      };
    }
    case "payout_approved": {
      const ref = String(data.payoutRef ?? data.publicId ?? "");
      const amount = data.amountPaise !== undefined ? formatInr(Number(data.amountPaise ?? 0)) : String(data.amount ?? formatInr(0));
      const masked = String(data.maskedDestination ?? data.destinationMasked ?? "your saved destination");
      return {
        subject: `Payout request approved — ${ref}`,
        html: shell(
          "Payout request approved",
          `<p>Hi ${data.creatorName ?? "there"},</p>
           <p>Your payout request <strong>${ref}</strong> for <strong>${amount}</strong> to <strong>${masked}</strong> has been approved and queued for manual bank/UPI transfer.</p>
           <p>We will email you the UTR / transaction reference as soon as the transfer is completed.</p>`
        ) + button(`${origin}/creator/payouts`, "View payout status"),
      };
    }
    case "payout_paid": {
      const ref = String(data.payoutRef ?? data.publicId ?? "");
      const amount = data.amountPaise !== undefined ? formatInr(Number(data.amountPaise ?? 0)) : String(data.amount ?? formatInr(0));
      const masked = String(data.maskedDestination ?? data.destinationMasked ?? "masked destination");
      return {
        subject: `Payout sent — ${ref}`,
        html: shell(
          "Creator payout sent",
          `<p>Hi ${data.creatorName ?? "there"},</p>
           <p>We have transferred <strong>${amount}</strong> to your saved payout destination (<strong>${masked}</strong>).</p>
           <table style="margin:16px 0;font-size:14px">
             <tr><td style="padding:4px 16px 4px 0;color:#71717a">Request ID</td><td style="font-family:ui-monospace,monospace">${ref}</td></tr>
             <tr><td style="padding:4px 16px 4px 0;color:#71717a">Amount sent</td><td><strong>${amount}</strong></td></tr>
             <tr><td style="padding:4px 16px 4px 0;color:#71717a">Payment reference (UTR)</td><td style="font-family:ui-monospace,monospace"><strong>${data.paymentReference ?? "—"}</strong></td></tr>
             <tr><td style="padding:4px 16px 4px 0;color:#71717a">Method</td><td>${data.paymentMethodUsed ?? "Bank / UPI"}</td></tr>
           </table>`
        ) + button(`${origin}/creator/payouts`, "Open payouts"),
      };
    }
    case "payout_rejected": {
      const ref = String(data.payoutRef ?? data.publicId ?? "");
      const amount = data.amountPaise !== undefined ? formatInr(Number(data.amountPaise ?? 0)) : String(data.amount ?? formatInr(0));
      return {
        subject: `Payout request not approved — ${ref}`,
        html: shell(
          "Payout request not approved",
          `<p>Hi ${data.creatorName ?? "there"},</p>
           <p>Your payout request <strong>${ref}</strong> for <strong>${amount}</strong> was not approved:</p>
           <blockquote style="margin:16px 0;padding:12px 16px;background:#fafafa;border-left:3px solid #d4d4d8;color:#52525b">${data.reason ?? "Please review your payout details."}</blockquote>
           <p>The reserved amount has been released back to your available balance.</p>`
        ) + button(`${origin}/creator/payouts`, "Review payouts"),
      };
    }
    case "payout_failed": {
      const ref = String(data.payoutRef ?? data.publicId ?? "");
      const amount = data.amountPaise !== undefined ? formatInr(Number(data.amountPaise ?? 0)) : String(data.amount ?? formatInr(0));
      return {
        subject: `Payout transfer failed — action needed (${ref})`,
        html: shell(
          "Payout transfer could not be completed",
          `<p>Hi ${data.creatorName ?? "there"},</p>
           <p>We attempted to send <strong>${amount}</strong> for payout request <strong>${data.payoutRef}</strong> to <strong>${data.maskedDestination ?? "your saved destination"}</strong>, but the transfer could not be completed:</p>
           <blockquote style="margin:16px 0;padding:12px 16px;background:#fafafa;border-left:3px solid #d4d4d8;color:#52525b">${data.reason ?? "Please verify your UPI ID or bank account details."}</blockquote>
           <p>The reserved amount has been returned to your available balance. Please update your UPI ID or bank account details in Creator Studio and submit a new payout request.</p>`
        ) + button(`${origin}/creator/payouts`, "Update payout destination"),
      };
    }
    case "transfer_status":
      return {
        subject: `Payout update — ${data.status}`,
        html: shell(
          "Creator payout update",
          `<p>Hi ${data.creatorName},</p><p>Your payout of <strong>${formatInr(Number(data.amountPaise ?? 0))}</strong>${data.courseTitle ? ` for <strong>${data.courseTitle}</strong>` : ""} is now <strong>${data.status}</strong>.</p>`
        ) + button(`${origin}/creator/payouts`, "View payouts"),
      };
    default:
      return { subject: "Zybble", html: shell("Notification", "<p>You have a new update in Zybble.</p>") };
  }
}

const render = renderEmailTemplate;

/* -------------------------------------------------------------------------- */
/* Dispatch                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Sends one queued outbox row. Returns the provider message id on success.
 * Never throws for a business failure — the caller records the error on the row
 * so it can be retried without touching the underlying transaction.
 */
/* -------------------------------------------------------------------------- */
/* Consent                                                                     */
/* -------------------------------------------------------------------------- */

/** The `learner_preferences` column that gates an optional template. */
export type LearnerConsentKey =
  | "email_course_updates"
  | "email_promos"
  | "weekly_report"
  | "study_reminders";

/**
 * Which optional messages each preference controls.
 *
 * A template that is not listed here is **transactional** and always sent:
 * receipts, certificates, verification links, moderation decisions and payout
 * notices are the record of something that already happened, and a learner who
 * opts out of marketing still has to receive them. Everything listed here is
 * optional and is skipped when the learner has turned it off.
 */
export const EMAIL_CONSENT: Partial<Record<EmailTemplate, LearnerConsentKey>> = {
  course_update: "email_course_updates",
  weekly_learning_report: "weekly_report",
  study_reminder: "study_reminders",
  catalog_digest: "email_promos",
};

/** Column defaults from the schema, used when a learner has no preference row. */
const CONSENT_DEFAULTS: Record<LearnerConsentKey, boolean> = {
  email_course_updates: true,
  email_promos: false,
  weekly_report: true,
  study_reminders: true,
};

export type ConsentResult =
  | { allowed: true }
  | { allowed: false; reason: "opted_out" | "unknown_recipient" | "unavailable" };

/**
 * Whether an optional email may go to this address.
 *
 * Fails closed: if the recipient cannot be resolved, or the preferences cannot
 * be read, the optional message is not sent. Guessing "they probably meant yes"
 * is how an unsubscribe stops working.
 */
export async function hasEmailConsent(to: string, template: EmailTemplate): Promise<ConsentResult> {
  const key = EMAIL_CONSENT[template];
  if (!key) return { allowed: true };

  const service = createServiceClient();
  if (!service) return { allowed: false, reason: "unavailable" };

  const { data: profile } = await service
    .from("profiles")
    .select("id")
    .eq("email", to.trim().toLowerCase())
    .maybeSingle();
  if (!profile) return { allowed: false, reason: "unknown_recipient" };

  const { data: prefs, error } = await service
    .from("learner_preferences")
    .select(`${key}`)
    .eq("user_id", profile.id)
    .maybeSingle();
  if (error) return { allowed: false, reason: "unavailable" };

  // No preference row yet: fall back to the column default the schema defines,
  // so a brand-new learner gets course updates but no marketing.
  const stored = prefs ? (prefs as Record<string, unknown>)[key] : undefined;
  const allowed = stored === undefined || stored === null ? CONSENT_DEFAULTS[key] : Boolean(stored);
  return allowed ? { allowed: true } : { allowed: false, reason: "opted_out" };
}

export async function dispatchEmail(row: {
  to_email: string;
  template: EmailTemplate;
  payload: Record<string, string | number>;
}): Promise<{ providerId: string } | { error: string }> {
  if (!serverEnv.resendApiKey || !serverEnv.resendFromEmail) {
    return { error: "Resend is not configured" };
  }
  const { subject, html } = render(row.template, row.payload);
  try {
    const result = await getResend().emails.send({
      from: serverEnv.resendFromEmail,
      to: row.to_email,
      subject,
      html,
    });
    if (result.error) return { error: result.error.message };
    return { providerId: result.data?.id ?? "unknown" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Email send failed" };
  }
}

/** Convenience for non-transactional, best-effort notifications. */
export async function sendEmail(
  payload: EmailPayload
): Promise<{ providerId?: string; error?: string; skipped?: "consent" }> {
  const consent = await hasEmailConsent(payload.to, payload.template);
  if (!consent.allowed) return { skipped: "consent" };
  return dispatchEmail({ to_email: payload.to, template: payload.template, payload: payload.data });
}

/* -------------------------------------------------------------------------- */
/* Outbox drain                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Queues a transactional email.
 *
 * The write happens inside the same logical operation as the business change,
 * so a crash can never produce a receipt for an order that does not exist. The
 * unique `idempotency_key` means a retried enqueue — a double-clicked Pay
 * button, a replayed webhook — collapses to one row.
 */
export async function enqueueEmail(input: {
  to: string;
  template: EmailTemplate;
  payload: Record<string, string | number>;
  /** Stable per business object, e.g. `receipt:<publicOrderId>`. */
  idempotencyKey: string;
}): Promise<{ queued: boolean; error?: string; skipped?: "consent" }> {
  // An optional message to somebody who turned it off is not queued at all, so
  // the outbox never becomes a place where consent is checked later.
  const consent = await hasEmailConsent(input.to, input.template);
  if (!consent.allowed) return { queued: false, skipped: "consent" };

  const service = createServiceClient();
  if (!service) return { queued: false, error: "Email outbox is unavailable" };

  // The unique `idempotency_key` constraint is the real guard: a retry collides
  // and is treated as success, so a replayed webhook queues exactly one email.
  const { error } = await service.from("email_outbox").insert({
    to_email: input.to,
    template: input.template,
    payload: input.payload,
    idempotency_key: input.idempotencyKey,
    status: "queued",
  });
  if (error && !/duplicate key|already exists|23505/i.test(error.message)) {
    return { queued: false, error: error.message };
  }
  return { queued: true };
}

/* -------------------------------------------------------------------------- */
/* Batched enqueue                                                             */
/* -------------------------------------------------------------------------- */

export interface BatchEmailInput {
  to: string;
  /** Preferred: consent is then resolved in one query for the whole batch. */
  userId?: string;
  template: EmailTemplate;
  payload: Record<string, string | number>;
  idempotencyKey: string;
}

/**
 * Queues the same message for many learners.
 *
 * Fanning out one `enqueueEmail` call per recipient would be a round trip per
 * learner, so this resolves consent for the whole batch in a single read of
 * `learner_preferences` and writes the outbox rows in chunks. Duplicates are
 * ignored by the unique idempotency key, which keeps a retried announcement from
 * emailing anybody twice.
 */
export async function enqueueEmailBatch(
  inputs: BatchEmailInput[]
): Promise<{ queued: number; skippedConsent: number; error?: string }> {
  if (inputs.length === 0) return { queued: 0, skippedConsent: 0 };

  const service = createServiceClient();
  if (!service) return { queued: 0, skippedConsent: inputs.length, error: "Email outbox is unavailable" };

  const consentColumns: LearnerConsentKey[] = [
    "email_course_updates",
    "email_promos",
    "weekly_report",
    "study_reminders",
  ];
  /** `<userId>:<column>` → whether that learner allows that message. */
  const allowedById = new Map<string, boolean>();

  const gatedIds = [
    ...new Set(
      inputs.filter((input) => EMAIL_CONSENT[input.template] && input.userId).map((input) => input.userId as string)
    ),
  ];
  for (let i = 0; i < gatedIds.length; i += 500) {
    const { data } = await service
      .from("learner_preferences")
      .select("user_id, email_course_updates, email_promos, weekly_report, study_reminders")
      .in("user_id", gatedIds.slice(i, i + 500));
    for (const row of (data ?? []) as unknown as Array<Record<string, unknown>>) {
      for (const column of consentColumns) {
        const value = row[column];
        allowedById.set(
          `${String(row.user_id)}:${column}`,
          value === undefined || value === null ? CONSENT_DEFAULTS[column] : Boolean(value)
        );
      }
    }
  }

  const rows: Array<{
    to_email: string;
    template: EmailTemplate;
    payload: Record<string, string | number>;
    idempotency_key: string;
    status: "queued";
  }> = [];
  let skippedConsent = 0;

  for (const input of inputs) {
    const column = EMAIL_CONSENT[input.template];
    if (column) {
      // No preference row means the schema defaults apply, exactly as they do
      // for the single-recipient path.
      const allowed = input.userId
        ? allowedById.get(`${input.userId}:${column}`) ?? CONSENT_DEFAULTS[column]
        : (await hasEmailConsent(input.to, input.template)).allowed;
      if (!allowed) {
        skippedConsent += 1;
        continue;
      }
    }
    rows.push({
      to_email: input.to,
      template: input.template,
      payload: input.payload,
      idempotency_key: input.idempotencyKey,
      status: "queued",
    });
  }

  let queued = 0;
  for (let i = 0; i < rows.length; i += 500) {
    // An upsert with `ignoreDuplicates` is an insert that treats a duplicate
    // idempotency key as success, which is exactly what a re-run must do.
    const { error, count } = await service
      .from("email_outbox")
      .upsert(rows.slice(i, i + 500), { onConflict: "idempotency_key", ignoreDuplicates: true, count: "exact" });
    if (error) {
      console.error("[email] batch enqueue failed", { reason: error.message.slice(0, 200) });
      return { queued, skippedConsent, error: error.message };
    }
    queued += count ?? 0;
  }

  return { queued, skippedConsent };
}

const MAX_ATTEMPTS = 5;

/**
 * Sends queued outbox rows.
 *
 * Each row is marked `sent` or `failed` in the database with the provider's own
 * message id. A row that fails is retried up to {@link MAX_ATTEMPTS} and then
 * left for inspection — this never reports delivery it did not observe.
 */
export async function drainEmailOutbox(limit = 25): Promise<{ sent: number; failed: number; skipped: number }> {
  const service = createServiceClient();
  if (!service) return { sent: 0, failed: 0, skipped: 0 };

  const { data } = await service
    .from("email_outbox")
    .select("id, to_email, template, payload, attempts")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(Math.max(1, Math.min(limit, 100)));

  const rows = (data ?? []) as Array<{
    id: string;
    to_email: string;
    template: EmailTemplate;
    payload: Record<string, string | number>;
    attempts: number | null;
  }>;

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows) {
    if (!isEmailTemplate(row.template)) {
      await service
        .from("email_outbox")
        .update({ status: "failed", last_error: "Unknown template", attempts: MAX_ATTEMPTS })
        .eq("id", row.id);
      failed += 1;
      continue;
    }

    const result = await dispatchEmail({ to_email: row.to_email, template: row.template, payload: row.payload ?? {} });
    if ("providerId" in result) {
      await service
        .from("email_outbox")
        .update({ status: "sent", provider_id: result.providerId, sent_at: new Date().toISOString(), last_error: null })
        .eq("id", row.id);
      sent += 1;
      continue;
    }

    const attempts = (row.attempts ?? 0) + 1;
    // Give up loudly rather than looping forever on a permanently bad address.
    const exhausted = attempts >= MAX_ATTEMPTS;
    await service
      .from("email_outbox")
      .update({
        attempts,
        status: exhausted ? "failed" : "queued",
        last_error: result.error.slice(0, 500),
      })
      .eq("id", row.id);
    if (exhausted) failed += 1;
    else skipped += 1;
  }

  return { sent, failed, skipped };
}

/** Narrows a database string to a template this build actually renders. */
export function isEmailTemplate(value: unknown): value is EmailTemplate {
  return typeof value === "string" && (EMAIL_TEMPLATES as readonly string[]).includes(value);
}
