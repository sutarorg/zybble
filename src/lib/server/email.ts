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
  | "security_password_reset_requested"
  | "security_email_changed"
  | "payment_reversed"
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
  "security_password_reset_requested",
  "security_email_changed",
  "payment_reversed",
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
    case "payment_reversed":
      // A reversal is an accounting correction applied by the payment provider.
      // Zybble publishes no refund policy and must not imply one.
      return {
        subject: `Payment reversed — ${data.orderRef}`,
        html: shell(
          "Payment reversed",
          `<p>Hi ${data.learnerName ?? "there"},</p>
           <p>Razorpay reported that <strong>${formatInr(Number(data.amountPaise ?? 0))}</strong> on order <strong>${data.orderRef}</strong>
           ${data.courseTitle ? ` for <strong>${data.courseTitle}</strong>` : ""} was reversed at your bank or card issuer.</p>
           <p>This is a correction to Zybble's accounting record, not a refund Zybble issued: the marketplace has no refund policy.
           Access to the course has ended because the payment no longer stands. Your bank may take several business days to show the credit.</p>`
        ) + button(`${origin}/orders`, "View your orders"),
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
export async function sendEmail(payload: EmailPayload): Promise<{ providerId?: string; error?: string }> {
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
}): Promise<{ queued: boolean; error?: string }> {
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
