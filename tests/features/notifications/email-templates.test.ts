import { describe, expect, it } from "vitest";
import {
  renderTemplate,
  TEMPLATE_PREFERENCE,
  type EmailTemplate,
} from "@/features/notifications/email";

const TEMPLATES = Object.keys(TEMPLATE_PREFERENCE) as EmailTemplate[];

/**
 * Every internal path an email is allowed to link to.
 *
 * Email templates cannot be typechecked against the router, so a link to a
 * route that was renamed or never built renders as a 404 in a message the
 * recipient cannot report easily. These are the real app routes; anything else
 * in a rendered template fails the suite.
 */
const VALID_PREFIXES = [
  "/dashboard",
  "/calendar",
  "/posts",
  "/analytics",
  "/settings",
  "/invitations",
  "/login",
  "/signup",
  "/onboarding",
];

function internalLinks(html: string): string[] {
  const links: string[] = [];
  const pattern = /href="https?:\/\/[^/]+(\/[^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const path = match[1]!;
    // Skip the logo and other static assets.
    if (/\.(png|jpe?g|svg|ico|css|woff2?)$/i.test(path)) continue;
    links.push(path);
  }
  return links;
}

describe("transactional email templates", () => {
  it("defines a preference mapping for every template", () => {
    expect(TEMPLATES.length).toBeGreaterThan(0);
  });

  for (const template of TEMPLATES) {
    describe(template, () => {
      const payload = {
        recipientName: "Ada",
        workspaceName: "Acme Consulting",
        postTitle: "A post about posting",
        failureReason: "token_expired",
        scheduledAt: "Tue 9:30",
        accountName: "Ada Okafor",
        seats: 3,
        inviterName: "Tejas",
      };

      it("renders a subject, an HTML body and a plain-text alternative", () => {
        const rendered = renderTemplate(template, payload);

        expect(rendered.subject.length).toBeGreaterThan(0);
        expect(rendered.html).toContain("<!doctype html>");
        // A missing text part is the fastest way to land in a spam folder.
        expect(rendered.text.length).toBeGreaterThan(0);
      });

      it("carries the brand logo and the brand accent colour", () => {
        const rendered = renderTemplate(template, payload);

        expect(rendered.html).toContain("/brand/logo.png");
        expect(rendered.html).toContain("#2563eb"); // brand-600
      });

      it("only links to routes that exist", () => {
        const rendered = renderTemplate(template, payload);

        for (const path of internalLinks(rendered.html)) {
          // Compare on the path alone: a fragment such as
          // /settings#ws-notifications is still the /settings route.
          const route = path.split(/[?#]/)[0]!;
          const known = VALID_PREFIXES.some(
            (prefix) => route === prefix || route.startsWith(`${prefix}/`),
          );
          expect(known, `${template} links to unknown route "${path}"`).toBe(true);
        }
      });
    });
  }
});
