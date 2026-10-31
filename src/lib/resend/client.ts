import { Resend } from "resend";
import { env, isResendConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Resend transport.
 *
 * Email is best-effort by design: a failed send must never fail the workflow
 * that triggered it (a post that published successfully stays published even if
 * the notification email bounces). `sendEmail` therefore logs and returns null
 * instead of throwing for provider errors, except when the API key is missing,
 * which is a deployment problem and is reported loudly.
 */

let client: Resend | null = null;

function resend(): Resend {
  if (!isResendConfigured()) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  client ??= new Resend(env().RESEND_API_KEY);
  return client;
}

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  tags?: Array<{ name: string; value: string }>;
};

export type SendEmailResult =
  | { sent: true; id: string }
  | { sent: false; reason: "not_configured" | "provider_error"; message: string };

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!isResendConfigured()) {
    logger.warn("email.not_configured", { subject: input.subject });
    return { sent: false, reason: "not_configured", message: "RESEND_API_KEY is not configured" };
  }

  try {
    const { data, error } = await resend().emails.send({
      // EMAIL_FROM is a full RFC-5322 address, e.g. "Zybble <no-reply@zybble.app>".
      from: env().EMAIL_FROM,
      to: Array.isArray(input.to) ? input.to : [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo ?? env().EMAIL_REPLY_TO,
      tags: input.tags,
    });

    if (error) {
      logger.error("email.send_failed", {
        subject: input.subject,
        error: error.message,
      });
      return { sent: false, reason: "provider_error", message: error.message };
    }

    logger.info("email.sent", { id: data?.id ?? null, subject: input.subject });
    return { sent: true, id: data?.id ?? "unknown" };
  } catch (error) {
    logger.error("email.send_threw", {
      subject: input.subject,
      error: error instanceof Error ? error.message : "unknown",
    });
    return {
      sent: false,
      reason: "provider_error",
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
