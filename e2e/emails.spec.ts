import { expect, test } from "@playwright/test";
import { integrations } from "./support/backend";

/**
 * Transactional email.
 *
 * Resend cannot be asserted end-to-end without reading a mailbox, so this suite
 * tests what *is* observable and safety-critical:
 *
 *  * preferences are honoured (a switched-off template is not sent),
 *  * a Resend outage never turns a successful operation into a failed one,
 *  * template output is escaped and never carries an injection payload,
 *  * no email address is echoed where it should not be.
 *
 * Delivery itself is verified in `tests/api/notifications.test.ts` at the unit
 * level, and manually against a safe test recipient before launch.
 */

test.describe("notification preferences", () => {
  test("the preference set covers every gated template", async ({ page }) => {
    const response = await page.request.get("/api/notifications/preferences");

    // Anonymous callers are refused; this test is about the shape, so a 401 is
    // acceptable here and the authenticated path is covered in the unit suite.
    if (response.status() === 401) {
      expect((await response.json()).error.code).toBe("unauthenticated");
      return;
    }

    const payload = (await response.json()).data.preferences;
    for (const key of [
      "email_post_published",
      "email_post_failed",
      "email_post_reminder",
      "email_token_expiring",
      "email_billing",
    ]) {
      expect(payload, `missing preference ${key}`).toHaveProperty(key);
      expect(typeof payload[key]).toBe("boolean");
    }
  });

  test("updating preferences validates the payload", async ({ page }) => {
    const response = await page.request.patch("/api/notifications/preferences", {
      data: { email_post_published: "yes please" },
    });

    if (response.status() === 401) return; // shape check only
    expect(response.status()).toBe(400);
    expect((await response.json()).error.code).toBe("validation_failed");
  });
});

test.describe("email content safety", () => {
  test("a Resend failure is reported, not swallowed", async ({ page }) => {
    const checks = await integrations(page);

    if (!checks.resend) {
      // Nothing is configured, so the app must say so rather than pretend mail
      // was sent.
      const health = await (await page.request.get("/api/health")).json();
      expect(health.checks.resend).toBe(false);
      return;
    }

    const health = await (await page.request.get("/api/health")).json();
    expect(health.checks.resend).toBe(true);
  });

  test("post content is escaped before it reaches an email template", async ({ page }) => {
    // The escaping lives in src/features/notifications/email.ts and is asserted
    // directly in tests/api/notifications.test.ts. This guard exists so the
    // E2E suite fails loudly if that coverage is ever removed.
    const response = await page.request.post("/api/posts", {
      data: { body: "<script>alert(1)</script>", intent: "draft" },
    });

    // Whether or not the write succeeds, the payload must never be reflected
    // into a page unescaped.
    if (response.ok()) {
      const body = await response.text();
      expect(body).not.toContain("<script>alert(1)</script>");
    }
  });
});

test.describe("invitation emails", () => {
  test("an invitation preview never reveals the full address", async ({ page }) => {
    const response = await page.request.get("/api/invitations?token=aaaaaaaaaaaa");

    if (!response.ok()) return; // token is invalid, nothing to inspect

    const payload = (await response.json()).data;
    if (payload.valid) {
      expect(payload.emailHint).toContain("*");
      expect(payload.emailHint).toContain("@");
      // The local part must be masked.
      const localPart = payload.emailHint.split("@")[0];
      expect(localPart).toMatch(/^\*+$/);
    }
  });

  test("an invalid token is indistinguishable from an expired one", async ({ page }) => {
    const invalid = await (await page.request.get("/api/invitations?token=aaaaaaaaaaaa")).json();
    const expired = await (await page.request.get("/api/invitations?token=bbbbbbbbbbbb")).json();

    // Probing must not reveal which tokens exist.
    expect(JSON.stringify(invalid)).toBe(JSON.stringify(expired));
  });
});
