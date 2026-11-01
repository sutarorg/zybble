import { z } from "zod";
import { defineRoute } from "@/lib/api/http";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { renderContactEmail, sendContactEmail } from "@/features/notifications/contact";
import { siteConfig } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  topic: z.enum(["support", "sales", "feedback", "security", "other"]).default("other"),
  message: z.string().trim().min(10).max(5000),
  // Honeypot: real users never see or fill this field. Bots do. Length is
  // validated loosely here so a filled honeypot reaches the handler, which
  // then pretends success — a 400 would just teach the bot to adapt.
  website: z.string().max(500).optional().default(""),
});

export type ContactInput = z.infer<typeof contactSchema>;

/**
 * POST /api/contact — public contact form.
 *
 * No account required, so this is the most publicly writable endpoint in the
 * product: tightly rate-limited, length-capped, honeypot-protected, and
 * delivered through the same best-effort Resend transport as every other
 * email. Delivery failures are logged server-side and surfaced honestly.
 */
export const POST = defineRoute(
  {
    auth: "none",
    body: contactSchema,
    rateLimit: { limit: 5, windowMs: 10 * 60_000 },
    scope: "public:contact",
  },
  async ({ body }) => {
    // Honeypot filled: pretend success so the bot gains nothing by retrying.
    if (body!.website) {
      return { received: true };
    }

    const destination = env().CONTACT_FORM_TO ?? siteConfig.email.support;
    const rendered = renderContactEmail(body!);
    const result = await sendContactEmail({
      to: destination,
      replyTo: body!.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });

    if (!result.sent) {
      // Unconfigured provider is a deployment problem; provider errors are
      // transient. Either way the visitor gets an honest failure, not a
      // silent drop.
      throw new AppError(
        "external_service_unavailable",
        "We could not send your message just now. Please email us directly — we read everything.",
      );
    }

    return { received: true };
  },
);
