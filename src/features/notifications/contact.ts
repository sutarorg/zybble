import { sendEmail } from "@/lib/resend/client";

/**
 * Contact form delivery.
 *
 * A thin, honest wrapper around the shared Resend transport. Kept separate
 * from the product notification templates because the contact flow must work
 * (or fail visibly) with no workspace, no notification preferences and no
 * recipient account — it is the one email anyone on the internet can trigger,
 * which is also why the route that calls it is the most rate-limited public
 * surface in the app.
 */

export type ContactEmailInput = {
  name: string;
  email: string;
  topic: string;
  message: string;
};

export type ContactDelivery = {
  to: string;
  replyTo: string;
  subject: string;
  html: string;
  text: string;
};

const TOPIC_LABELS: Record<string, string> = {
  support: "Support",
  sales: "Sales / plans",
  feedback: "Product feedback",
  security: "Security",
  other: "General",
};

/** Escape user text for safe inclusion in the HTML email body. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderContactEmail(input: ContactEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const topicLabel = TOPIC_LABELS[input.topic] ?? "General";
  const subject = `[Zybble contact] ${topicLabel}: ${input.name}`;

  const text = [
    `New message from the Zybble contact form`,
    ``,
    `From: ${input.name} <${input.email}>`,
    `Topic: ${topicLabel}`,
    ``,
    input.message,
  ].join("\n");

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
  <p style="font-size:13px;color:#64748b;margin:0 0 16px">New message from the Zybble contact form</p>
  <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px">
    <tr><td style="padding:4px 0;color:#64748b;width:80px">From</td><td style="padding:4px 0"><strong>${escapeHtml(input.name)}</strong> &lt;${escapeHtml(input.email)}&gt;</td></tr>
    <tr><td style="padding:4px 0;color:#64748b">Topic</td><td style="padding:4px 0">${escapeHtml(topicLabel)}</td></tr>
  </table>
  <div style="white-space:pre-wrap;font-size:14px;line-height:1.6;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px">${escapeHtml(input.message)}</div>
  <p style="font-size:12px;color:#94a3b8;margin-top:16px">Reply directly to this email to answer ${escapeHtml(input.name)}.</p>
</div>`.trim();

  return { subject, html, text };
}

/**
 * Deliver a contact message. Returns the shared transport's honest result —
 * the caller decides how to surface failure. This function never throws for
 * provider errors (the transport already handles that); a missing API key is
 * reported as `not_configured` so the route can distinguish deployment
 * problems from transient ones.
 */
export async function sendContactEmail(
  options: ContactDelivery,
): Promise<{ sent: true; id: string } | { sent: false; reason: string }> {
  const result = await sendEmail({
    to: options.to,
    replyTo: options.replyTo,
    subject: options.subject,
    html: options.html,
    text: options.text,
    tags: [{ name: "kind", value: "contact" }],
  });

  return result.sent
    ? { sent: true, id: result.id }
    : { sent: false, reason: result.reason };
}
