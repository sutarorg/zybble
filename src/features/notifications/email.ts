import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { sendEmail } from "@/lib/resend/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Branded transactional email.
 *
 * Templates are plain functions returning subject + html + text so they can be
 * unit tested without a network. Every send is gated on the recipient's
 * `notification_preferences` row (default: enabled) and the product URL from
 * `NEXT_PUBLIC_SITE_URL`.
 *
 * Email verification and password reset are delivered by Supabase Auth — the
 * app only supplies the redirect URLs (see `src/features/auth/password.ts` and
 * the Supabase dashboard template configuration). Resend is used for the
 * product emails listed in `TEMPLATE_PREFERENCE`.
 */

export type EmailTemplate =
  | "welcome"
  | "linkedin_connected"
  | "linkedin_reauth_required"
  | "post_published"
  | "post_failed"
  | "post_reminder"
  | "subscription_confirmed"
  | "payment_failed"
  | "subscription_cancelled"
  | "team_invitation";

/** Which preference switch guards each template. */
export const TEMPLATE_PREFERENCE: Record<
  EmailTemplate,
  "email_post_published" | "email_post_failed" | "email_post_reminder" | "email_token_expiring" | "email_billing" | null
> = {
  welcome: null, // transactional: always sent
  team_invitation: null,
  linkedin_connected: "email_token_expiring",
  linkedin_reauth_required: "email_token_expiring",
  post_published: "email_post_published",
  post_failed: "email_post_failed",
  post_reminder: "email_post_reminder",
  subscription_confirmed: "email_billing",
  payment_failed: "email_billing",
  subscription_cancelled: "email_billing",
};

export type TemplatePayload = {
  recipientName?: string | null;
  workspaceName?: string | null;
  postTitle?: string | null;
  postUrl?: string | null;
  failureReason?: string | null;
  scheduledAt?: string | null;
  accountName?: string | null;
  seats?: number | null;
  inviterName?: string | null;
  actionUrl?: string | null;
  [key: string]: string | number | boolean | null | undefined;
};

const BRAND = {
  name: "Zybble",
  accent: "#6366f1",
  ink: "#111827",
  muted: "#6b7280",
  background: "#f9fafb",
};

function siteUrl(): string {
  return (env().NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function escape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layout(input: { title: string; preheader: string; body: string; ctaUrl?: string | null; ctaLabel?: string }): {
  subject: string;
  html: string;
} {
  const cta =
    input.ctaUrl && input.ctaLabel
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 0">
           <tr><td style="border-radius:10px;background:${BRAND.accent}">
             <a href="${escape(input.ctaUrl)}" style="display:inline-block;padding:12px 22px;color:#fff;font-size:15px;font-weight:600;text-decoration:none">
               ${escape(input.ctaLabel)}
             </a>
           </td></tr>
         </table>`
      : "";

  return {
    subject: input.title,
    html: `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${escape(input.title)}</title></head>
<body style="margin:0;background:${BRAND.background};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND.ink}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escape(input.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb">
<tr><td style="padding:26px 32px 0">
  <span style="font-size:18px;font-weight:700;letter-spacing:-0.02em">${BRAND.name}</span>
</td></tr>
<tr><td style="padding:18px 32px 8px">
  <h1 style="margin:0;font-size:20px;line-height:1.3;font-weight:650">${escape(input.title)}</h1>
</td></tr>
<tr><td style="padding:0 32px 8px;font-size:15px;line-height:1.6;color:#374151">
  ${input.body}
</td></tr>
<tr><td style="padding:0 32px 8px">${cta}</td></tr>
<tr><td style="padding:24px 32px 28px;font-size:12px;line-height:1.6;color:${BRAND.muted}">
  You are receiving this because you have a ${BRAND.name} account.
  Manage email preferences in <a href="${siteUrl()}/settings/notifications" style="color:${BRAND.muted}">Settings → Notifications</a>.
</td></tr>
</table>
</td></tr></table>
</body></html>`,
  };
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 14px">${escape(text)}</p>`;
}

function greeting(name?: string | null): string {
  return name ? paragraph(`Hi ${name},`) : paragraph("Hi there,");
}

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

export function renderTemplate(template: EmailTemplate, payload: TemplatePayload = {}): RenderedEmail {
  const name = payload.recipientName ?? null;
  const workspace = payload.workspaceName ?? "your workspace";
  const actionUrl = payload.actionUrl ?? null;

  const build = (
    parts: { title: string; preheader: string; bodyHtml: string; bodyText: string[]; ctaLabel?: string; ctaUrl?: string | null },
  ): RenderedEmail => {
    const rendered = layout({
      title: parts.title,
      preheader: parts.preheader,
      body: parts.bodyHtml,
      ctaUrl: parts.ctaUrl ?? actionUrl,
      ctaLabel: parts.ctaLabel,
    });

    return {
      subject: rendered.subject,
      html: rendered.html,
      text: [...parts.bodyText, parts.ctaUrl ?? actionUrl ? `${parts.ctaLabel}: ${parts.ctaUrl ?? actionUrl}` : ""]
        .filter(Boolean)
        .join("\n\n"),
    };
  };

  switch (template) {
    case "welcome":
      return build({
        title: "Welcome to Zybble",
        preheader: "Schedule LinkedIn posts, measure them, and find your best time to post.",
        bodyHtml:
          greeting(name) +
          paragraph(
            "Zybble helps you draft, schedule and publish LinkedIn posts, then learn from the numbers that LinkedIn actually returns.",
          ) +
          paragraph("Start with three steps: connect your LinkedIn account, write your first post, and pick a time."),
        bodyText: [
          name ? `Hi ${name},` : "Hi there,",
          "Zybble helps you draft, schedule and publish LinkedIn posts, then learn from the numbers that LinkedIn actually returns.",
          "Start with three steps: connect your LinkedIn account, write your first post, and pick a time.",
        ],
        ctaLabel: "Connect LinkedIn",
        ctaUrl: `${siteUrl()}/settings/accounts`,
      });

    case "linkedin_connected":
      return build({
        title: "LinkedIn account connected",
        preheader: `${payload.accountName ?? "Your LinkedIn account"} is now connected to ${workspace}.`,
        bodyHtml:
          greeting(name) +
          paragraph(
            `${payload.accountName ?? "Your LinkedIn account"} is connected to ${workspace}. Scheduled posts will publish there once you set a time.`,
          ),
        bodyText: [
          name ? `Hi ${name},` : "Hi there,",
          `${payload.accountName ?? "Your LinkedIn account"} is connected to ${workspace}. Scheduled posts will publish there once you set a time.`,
        ],
        ctaLabel: "Create a post",
        ctaUrl: `${siteUrl()}/composer`,
      });

    case "linkedin_reauth_required":
      return build({
        title: "Reconnect your LinkedIn account",
        preheader: `${payload.accountName ?? "A LinkedIn account"} needs to be re-authorised.`,
        bodyHtml:
          greeting(name) +
          paragraph(
            `${payload.accountName ?? "A LinkedIn account"} in ${workspace} can no longer publish. LinkedIn access expired or the permission was revoked, so scheduled posts are paused until you reconnect.`,
          ) +
          paragraph("Nothing was lost — drafts and scheduled posts stay exactly where they are."),
        bodyText: [
          name ? `Hi ${name},` : "Hi there,",
          `${payload.accountName ?? "A LinkedIn account"} in ${workspace} can no longer publish. LinkedIn access expired or the permission was revoked, so scheduled posts are paused until you reconnect.`,
          "Nothing was lost — drafts and scheduled posts stay exactly where they are.",
        ],
        ctaLabel: "Reconnect LinkedIn",
        ctaUrl: `${siteUrl()}/settings/accounts`,
      });

    case "post_published":
      return build({
        title: "Post published",
        preheader: payload.postTitle ? `"${payload.postTitle}" is live on LinkedIn.` : "Your post is live on LinkedIn.",
        bodyHtml:
          greeting(name) +
          paragraph(
            payload.postTitle
              ? `“${payload.postTitle}” was published to LinkedIn.`
              : "Your scheduled post was published to LinkedIn.",
          ),
        bodyText: [
          name ? `Hi ${name},` : "Hi there,",
          payload.postTitle ? `“${payload.postTitle}” was published to LinkedIn.` : "Your scheduled post was published to LinkedIn.",
        ],
        ctaLabel: payload.postUrl ? "View on LinkedIn" : "See analytics",
        ctaUrl: payload.postUrl ?? `${siteUrl()}/analytics`,
      });

    case "post_failed":
      return build({
        title: "Post failed to publish",
        preheader: payload.failureReason ?? "We could not publish a scheduled post.",
        bodyHtml:
          greeting(name) +
          paragraph(
            payload.postTitle
              ? `We could not publish “${payload.postTitle}”. Reason: ${payload.failureReason ?? "unknown error"}.`
              : `We could not publish your scheduled post. Reason: ${payload.failureReason ?? "unknown error"}.`,
          ) +
          paragraph("Your post is saved as a draft. Fix the issue and schedule it again when you are ready."),
        bodyText: [
          name ? `Hi ${name},` : "Hi there,",
          payload.postTitle
            ? `We could not publish “${payload.postTitle}”. Reason: ${payload.failureReason ?? "unknown error"}.`
            : `We could not publish your scheduled post. Reason: ${payload.failureReason ?? "unknown error"}.`,
          "Your post is saved as a draft. Fix the issue and schedule it again when you are ready.",
        ],
        ctaLabel: "Review the post",
        ctaUrl: `${siteUrl()}/posts`,
      });

    case "post_reminder":
      return build({
        title: "Reminder: a post is scheduled",
        preheader: payload.scheduledAt ? `Scheduled for ${payload.scheduledAt}.` : "You have a post scheduled soon.",
        bodyHtml:
          greeting(name) +
          paragraph(
            payload.postTitle
              ? `“${payload.postTitle}” is scheduled${payload.scheduledAt ? ` for ${payload.scheduledAt}` : ""}.`
              : `You have a post scheduled${payload.scheduledAt ? ` for ${payload.scheduledAt}` : ""}.`,
          ),
        bodyText: [
          name ? `Hi ${name},` : "Hi there,",
          payload.postTitle
            ? `“${payload.postTitle}” is scheduled${payload.scheduledAt ? ` for ${payload.scheduledAt}` : ""}.`
            : `You have a post scheduled${payload.scheduledAt ? ` for ${payload.scheduledAt}` : ""}.`,
        ],
        ctaLabel: "Open the post",
        ctaUrl: `${siteUrl()}/posts`,
      });

    case "subscription_confirmed":
      return build({
        title: "Zybble Pro is active",
        preheader: `Pro is active for ${workspace}.`,
        bodyHtml:
          greeting(name) +
          paragraph(
            `Zybble Pro is active for ${workspace}${payload.seats ? ` with ${payload.seats} seat${payload.seats === 1 ? "" : "s"}` : ""}. Unlimited scheduled posts, 12 months of analytics and best-time insights are unlocked.`,
          ),
        bodyText: [
          name ? `Hi ${name},` : "Hi there,",
          `Zybble Pro is active for ${workspace}${payload.seats ? ` with ${payload.seats} seat${payload.seats === 1 ? "" : "s"}` : ""}. Unlimited scheduled posts, 12 months of analytics and best-time insights are unlocked.`,
        ],
        ctaLabel: "Manage billing",
        ctaUrl: `${siteUrl()}/settings/billing`,
      });

    case "payment_failed":
      return build({
        title: "We could not take your payment",
        preheader: `Update your payment method to keep Pro on ${workspace}.`,
        bodyHtml:
          greeting(name) +
          paragraph(
            `We could not collect payment for Zybble Pro on ${workspace}. Update your card to keep Pro features; otherwise the workspace returns to the Free plan at the end of the paid period.`,
          ),
        bodyText: [
          name ? `Hi ${name},` : "Hi there,",
          "We could not collect payment for Zybble Pro on " +
            workspace +
            ". Update your card to keep Pro features; otherwise the workspace returns to the Free plan at the end of the paid period.",
        ],
        ctaLabel: "Update payment method",
        ctaUrl: `${siteUrl()}/settings/billing`,
      });

    case "subscription_cancelled":
      return build({
        title: "Your Pro subscription ended",
        preheader: `${workspace} is now on the Free plan.`,
        bodyHtml:
          greeting(name) +
          paragraph(
            `Zybble Pro has ended for ${workspace}. The workspace is now on the Free plan: 1 LinkedIn account, 10 scheduled posts per month and 7 days of analytics.`,
          ) +
          paragraph("Posts already scheduled beyond the Free limit stay scheduled; you can reactivate Pro at any time."),
        bodyText: [
          name ? `Hi ${name},` : "Hi there,",
          `Zybble Pro has ended for ${workspace}. The workspace is now on the Free plan: 1 LinkedIn account, 10 scheduled posts per month and 7 days of analytics.`,
          "Posts already scheduled beyond the Free limit stay scheduled; you can reactivate Pro at any time.",
        ],
        ctaLabel: "Reactivate Pro",
        ctaUrl: `${siteUrl()}/settings/billing`,
      });

    case "team_invitation":
      return build({
        title: "You have been invited to a Zybble workspace",
        preheader: `${payload.inviterName ?? "A teammate"} invited you to ${workspace}.`,
        bodyHtml:
          greeting(name) +
          paragraph(
            `${payload.inviterName ?? "A teammate"} invited you to join ${workspace} on ${BRAND.name}. Accept the invitation to start collaborating on scheduled LinkedIn posts.`,
          ),
        bodyText: [
          name ? `Hi ${name},` : "Hi there,",
          `${payload.inviterName ?? "A teammate"} invited you to join ${workspace} on ${BRAND.name}.`,
        ],
        ctaLabel: "Accept invitation",
        ctaUrl: `${siteUrl()}/invitations`,
      });

    default: {
      const exhaustive: never = template;
      throw new Error(`Unknown email template: ${String(exhaustive)}`);
    }
  }
}

type PreferenceRow = {
  email_post_published: boolean;
  email_post_failed: boolean;
  email_post_reminder: boolean;
  email_token_expiring: boolean;
  email_billing: boolean;
};

const DEFAULT_PREFERENCES: PreferenceRow = {
  email_post_published: true,
  email_post_failed: true,
  email_post_reminder: false,
  email_token_expiring: true,
  email_billing: true,
};

async function loadPreferences(userId: string): Promise<PreferenceRow> {
  const admin = createSupabaseAdminClient();

  const { data } = await admin
    .from("notification_preferences")
    .select("email_post_published, email_post_failed, email_post_reminder, email_token_expiring, email_billing")
    .eq("user_id", userId)
    .maybeSingle();

  return (data as PreferenceRow | null) ?? DEFAULT_PREFERENCES;
}

export type DeliverResult = {
  sent: number;
  skipped: number;
  failed: number;
  recipients: string[];
};

/**
 * Send a template to one workspace member. Returns without throwing: email
 * delivery is best-effort and must never break the workflow that triggered it.
 */
export async function deliverTemplateToUser(input: {
  userId: string;
  template: EmailTemplate;
  payload?: TemplatePayload;
}): Promise<DeliverResult> {
  const admin = createSupabaseAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("email, full_name")
    .eq("id", input.userId)
    .maybeSingle();

  const email = profile?.email as string | undefined;

  if (!email) {
    return { sent: 0, skipped: 1, failed: 0, recipients: [] };
  }

  const preferenceKey = TEMPLATE_PREFERENCE[input.template];

  if (preferenceKey) {
    const preferences = await loadPreferences(input.userId);
    if (!preferences[preferenceKey]) {
      logger.info("email.skipped_by_preference", {
        template: input.template,
        preference: preferenceKey,
      });
      return { sent: 0, skipped: 1, failed: 0, recipients: [] };
    }
  }

  const rendered = renderTemplate(input.template, {
    ...input.payload,
    recipientName: input.payload?.recipientName ?? ((profile?.full_name as string | null) ?? null),
  });

  const result = await sendEmail({
    to: email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    tags: [{ name: "template", value: input.template }],
  });

  return result.sent
    ? { sent: 1, skipped: 0, failed: 0, recipients: [email] }
    : { sent: 0, skipped: 0, failed: 1, recipients: [email] };
}

/**
 * Invitation email.
 *
 * The recipient is not a user yet, so the address is read from the pending
 * membership row — which is why the event carried an invitation id rather than
 * an email address. Returns without throwing when the invitation was revoked or
 * accepted in the meantime (the row is no longer pending).
 */
export async function deliverInvitationEmail(input: {
  invitationId: string;
  workspaceName?: string | null;
  inviterName?: string | null;
  actionUrl?: string | null;
}): Promise<DeliverResult> {
  const admin = createSupabaseAdminClient();

  const { data } = await admin
    .from("workspace_members")
    .select("email, status, invite_expires_at")
    .eq("id", input.invitationId)
    .maybeSingle();

  const row = data as { email: string; status: string; invite_expires_at: string | null } | null;

  if (!row || row.status !== "invited") {
    return { sent: 0, skipped: 1, failed: 0, recipients: [] };
  }

  if (row.invite_expires_at && new Date(row.invite_expires_at).getTime() < Date.now()) {
    return { sent: 0, skipped: 1, failed: 0, recipients: [] };
  }

  const rendered = renderTemplate("team_invitation", {
    workspaceName: input.workspaceName ?? undefined,
    inviterName: input.inviterName ?? undefined,
    actionUrl: input.actionUrl ?? undefined,
  });

  const result = await sendEmail({
    to: row.email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    tags: [{ name: "template", value: "team_invitation" }],
  });

  return result.sent
    ? { sent: 1, skipped: 0, failed: 0, recipients: [row.email] }
    : { sent: 0, skipped: 0, failed: 1, recipients: [row.email] };
}

/** Send a workspace-wide template to every active member (preferences honoured). */
export async function deliverTemplateToWorkspace(input: {
  workspaceId: string;
  template: EmailTemplate;
  payload?: TemplatePayload;
}): Promise<DeliverResult> {
  const admin = createSupabaseAdminClient();

  const { data: members } = await admin
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", input.workspaceId)
    .eq("status", "active");

  const userIds = ((members ?? []) as Array<{ user_id: string }>).map((member) => member.user_id);

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const recipients: string[] = [];

  for (const userId of userIds) {
    const result = await deliverTemplateToUser({ userId, template: input.template, payload: input.payload });
    sent += result.sent;
    skipped += result.skipped;
    failed += result.failed;
    recipients.push(...result.recipients);
  }

  return { sent, skipped, failed, recipients };
}
