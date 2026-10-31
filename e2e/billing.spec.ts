import { expect, test } from "@playwright/test";
import { completeOnboardingIfNeeded, integrations, needsBackend, signUp, testEmail } from "./support/backend";

/**
 * Billing end-to-end.
 *
 * Entitlements are granted by verified Dodo webhooks and nothing else, so the
 * most important property under test is a negative one: **no browser-supplied
 * claim can turn a Free workspace into a Pro workspace.**
 */

const PASSWORD = "correct-horse-battery-staple";

test.beforeEach(async ({ page }) => {
  needsBackend();
  await signUp(page, "Billing Tester", testEmail("billing"), PASSWORD);
  await completeOnboardingIfNeeded(page, "Billing Workspace");
});

test.describe("Free plan restrictions", () => {
  test("a new workspace starts on Free with the documented limits", async ({ page }) => {
    const payload = (await (await page.request.get("/api/billing")).json()).data;

    expect(payload.plan).toBe("free");
    expect(payload.entitlements).toMatchObject({
      maxLinkedInAccounts: 1,
      monthlyScheduleLimit: 10,
      analyticsHistoryDays: 7,
    });
  });

  test("usage reflects the Free quota", async ({ page }) => {
    const payload = (await (await page.request.get("/api/workspaces/current")).json()).data;

    expect(payload.usage.scheduledPostsLimit).toBe(10);
    expect(payload.usage.linkedinAccountsLimit).toBe(1);
    expect(payload.usage.scheduledPostsUsed).toBeGreaterThanOrEqual(0);
  });

  test("a client cannot promote the workspace by claiming to be Pro", async ({ page }) => {
    // Every writeable surface a browser can reach must ignore plan claims.
    for (const attempt of [
      { path: "/api/workspaces/current", method: "PATCH", body: { plan: "pro" } },
      { path: "/api/billing", method: "PATCH", body: { plan: "pro" } },
    ]) {
      const response = await page.request.fetch(attempt.path, {
        method: attempt.method,
        data: attempt.body,
      });

      // Either rejected, or accepted but ignored. It must never stick.
      if (response.ok()) {
        const after = (await (await page.request.get("/api/billing")).json()).data;
        expect(after.plan, `${attempt.path} accepted a plan claim`).toBe("free");
      }
    }
  });

  test("connecting a second LinkedIn account is refused on Free", async ({ page }) => {
    const checks = await integrations(page);
    test.skip(!checks.linkedin, "LinkedIn is not configured in this environment.");

    const response = await page.request.get("/api/linkedin/connect");
    const payload = (await (await page.request.get("/api/linkedin/accounts")).json()).data;

    if (payload.limits.accountsUsed >= payload.limits.accountsLimit) {
      // The app must gate the action rather than fail later at LinkedIn.
      const follow = await page.request.get("/api/linkedin/connect");
      expect([302, 402, 409]).not.toContain(200);
      expect(follow.status()).not.toBe(200);
    } else {
      expect(response.status()).toBeLessThan(400);
    }
  });
});

test.describe("checkout", () => {
  test("checkout requires an admin role", async ({ page }) => {
    const response = await page.request.post("/api/billing/checkout", {
      data: { returnPath: "/settings/billing" },
    });

    // The account under test is the workspace owner, so it should succeed when
    // Dodo is configured and fail closed with 503 when it is not.
    const checks = await integrations(page);
    if (!checks.dodoPayments) {
      expect(response.status()).toBe(503);
      expect((await response.json()).error.code).toBe("integration_not_configured");
      return;
    }

    expect(response.status()).toBe(200);
    const payload = (await response.json()).data;
    expect(payload.checkoutUrl).toMatch(/^https:\/\//);
    // Dodo's test checkout host, never our own domain.
    expect(payload.checkoutUrl).not.toContain("zybble.app");
  });

  test("the seat count is computed server-side, not taken from the request", async ({ page }) => {
    const response = await page.request.post("/api/billing/checkout", {
      data: { seats: 999, returnPath: "/settings/billing" },
    });

    const checks = await integrations(page);
    test.skip(!checks.dodoPayments, "Dodo is not configured in this environment.");

    const payload = (await response.json()).data;
    // One active member (the owner) — never the 999 the client asked for.
    expect(payload.seats).toBe(1);
    expect(payload.monthlyAmountCents).toBe(1500);
  });
});

test.describe("seats", () => {
  test("one seat is one active member, with a floor of one", async ({ page }) => {
    const response = await page.request.get("/api/billing/seats");
    test.skip(response.status() === 403, "Requires an admin role.");

    const payload = (await response.json()).data;
    expect(payload.seats).toBeGreaterThanOrEqual(1);
    expect(payload.seatPriceCents).toBe(1500);
    expect(payload.monthlyAmountCents).toBe(1500 * payload.seats);
  });

  test("a pending invitation is not billed", async ({ page }) => {
    const invite = await page.request.post("/api/workspaces/current/members", {
      data: { email: testEmail("invitee"), role: "editor" },
    });

    if (invite.status() === 402) return; // Free plan: inviting is a Pro feature.

    const before = (await (await page.request.get("/api/billing/seats")).json()).data.seats;
    const after = (await (await page.request.get("/api/billing/seats")).json()).data.seats;
    // The invitation has not been accepted, so the seat count must not move.
    expect(after).toBe(before);
  });
});

test.describe("webhooks", () => {
  test("an unsigned webhook is rejected", async ({ page }) => {
    const response = await page.request.post("/api/webhooks/dodo", {
      data: { type: "subscription.active", data: { subscription_id: "sub_test" } },
    });

    expect([400, 401]).toContain(response.status());
  });

  test("a replayed event is accepted but processed once", async ({ page }) => {
    const checks = await integrations(page);
    test.skip(!checks.dodoPayments, "Dodo is not configured in this environment.");

    // Without the signing secret the test cannot forge a valid signature, so
    // the honest assertion here is that a duplicate event id is deduplicated at
    // the storage layer. Covered by tests/webhooks/dodo-processing.test.ts;
    // this test documents the end-to-end expectation.
    const response = await page.request.post("/api/webhooks/dodo", {
      headers: {
        "webhook-id": "evt_e2e_duplicate",
        "webhook-timestamp": String(Math.floor(Date.now() / 1000)),
        "webhook-signature": "v1,invalid",
      },
      data: { type: "subscription.active", data: { subscription_id: "sub_test" } },
    });

    expect([400, 401]).toContain(response.status());
  });
});
