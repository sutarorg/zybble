/**
 * Email verification.
 *
 * Supabase can send its own confirmation email, but only when the project's SMTP
 * is configured — and on a fresh project it is not, so a learner signs up and
 * never hears anything. Zybble therefore generates the confirmation link itself
 * with the service role and delivers it through Resend, the same channel every
 * other transactional email uses. The link is a real GoTrue token hash, so
 * clicking it verifies the address exactly as Supabase's own email would.
 *
 * The token is created server-side and emailed directly. It is never returned to
 * the browser: the caller only learns whether the message went out.
 */

import "server-only";
import { isServiceRoleConfigured, isSupabaseConfigured, siteOrigin } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/server";
import { enqueueEmail, sendEmail } from "@/lib/server/email";

export type VerificationOutcome =
  | { status: "sent" }
  | { status: "queued"; reason: string }
  | { status: "already_verified" }
  | { status: "unavailable"; reason: string };

/**
 * The link a learner clicks. Same route that already handles the PKCE code flow.
 *
 * `type` is GoTrue's own verification type for the token, which the landing
 * route passes back to `verifyOtp` — it is whitelisted there, so this is a hint
 * and not a trust boundary.
 */
export function buildConfirmUrl(tokenHash: string, type = "signup", next = "/dashboard"): string {
  const origin = siteOrigin();
  const url = new URL("/auth/confirm", origin);
  url.searchParams.set("token_hash", tokenHash);
  url.searchParams.set("type", type);
  // Only a same-origin relative path may ride along, so this cannot be turned
  // into an open redirect by whoever triggers the resend.
  url.searchParams.set("next", next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
  return url.toString();
}

/**
 * Parameters for `auth.admin.generateLink`, with the signup `password` omitted.
 *
 * supabase-js types `password` as required for `type: "signup"` because the
 * endpoint also creates users. This code only ever runs for an account that
 * already exists, and GoTrue updates the password when one is supplied — so
 * sending a placeholder here would silently overwrite a learner's password. The
 * cast is deliberate: the field is absent at runtime, not empty.
 */
type SignupLinkParams = { type: "signup"; email: string; options?: { redirectTo?: string } };
type MagicLinkParams = { type: "magiclink"; email: string; options?: { redirectTo?: string } };

/**
 * Generates a fresh confirmation token for an existing, unverified user.
 *
 * Returns `already_verified` when Supabase says the address is confirmed, so the
 * UI can stop offering a resend button instead of sending a link that would do
 * nothing.
 */
export async function generateVerificationLink(
  email: string
): Promise<{ link: string } | { alreadyVerified: true } | { error: string }> {
  if (!isSupabaseConfigured() || !isServiceRoleConfigured()) {
    return { error: "Authentication is not configured" };
  }
  const service = createServiceClient();
  if (!service) return { error: "Authentication is not configured" };

  const generateLink = service.auth.admin.generateLink.bind(service.auth.admin);
  type GenerateLinkParams = Parameters<typeof generateLink>[0];
  const redirectTo = `${siteOrigin()}/auth/confirm`;

  // A signup link is the real email-confirmation token. Magic link is the
  // fallback for projects whose GoTrue build refuses one for an unconfirmed
  // account: it still proves control of the address, and the landing route
  // confirms the email explicitly either way.
  const attempts: Array<SignupLinkParams | MagicLinkParams> = [
    { type: "signup", email, options: { redirectTo } },
    { type: "magiclink", email, options: { redirectTo } },
  ];

  let lastError = "Supabase did not return a verification token";
  for (const params of attempts) {
    const { data, error } = await generateLink(params as GenerateLinkParams);

    if (error) {
      if (/already (been )?(confirmed|verified)|user already confirmed/i.test(error.message)) {
        return { alreadyVerified: true };
      }
      lastError = error.message;
      continue;
    }

    const tokenHash = data?.properties?.hashed_token;
    if (!tokenHash) continue;
    const type = data?.properties?.verification_type || params.type;
    return { link: buildConfirmUrl(tokenHash, type) };
  }

  return { error: lastError };
}

/**
 * Emails the confirmation link.
 *
 * Delivery is attempted immediately through Resend — a signup email that waits
 * for the outbox cron is indistinguishable from no email at all. When Resend is
 * unreachable the message is queued instead, so the scheduled drain still
 * delivers it and nothing is silently dropped. It is never both, so one request
 * cannot produce two emails.
 */
export async function sendVerificationEmail(input: {
  email: string;
  name?: string;
  userId?: string;
}): Promise<VerificationOutcome> {
  const generated = await generateVerificationLink(input.email);
  if ("alreadyVerified" in generated) return { status: "already_verified" };
  if ("error" in generated) {
    console.warn("[verification] could not generate a confirmation link", {
      reason: generated.error.slice(0, 200),
    });
    return { status: "unavailable", reason: generated.error };
  }

  const payload = { name: input.name ?? "there", actionUrl: generated.link };
  const direct = await sendEmail({
    to: input.email,
    template: "verify_email",
    data: payload,
    idempotencyKey: `verify-email:${input.userId ?? input.email}`,
  });

  // `skipped` cannot happen for a verification link — it is transactional and
  // therefore not gated by any preference — but it must not be read as a failure
  // either, or the fallback below would queue a second copy.
  if (direct.skipped) return { status: "sent" };
  if (!direct.error) return { status: "sent" };

  // Resend is down or unconfigured: leave a durable trail for the outbox drain.
  const hour = new Date().toISOString().slice(0, 13);
  const queued = await enqueueEmail({
    to: input.email,
    template: "verify_email",
    payload,
    idempotencyKey: `verify-email:${input.userId ?? input.email}:${hour}`,
  });

  if (queued.queued) {
    console.warn("[verification] Resend unavailable, queued instead", {
      reason: direct.error.slice(0, 200),
    });
    return { status: "queued", reason: direct.error };
  }

  console.error("[verification] could not send or queue the confirmation email", {
    reason: queued.error?.slice(0, 200) ?? direct.error.slice(0, 200),
  });
  return { status: "unavailable", reason: queued.error ?? direct.error };
}
