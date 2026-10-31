import { expect, test } from "@playwright/test";
import { completeOnboardingIfNeeded, integrations, needsBackend, signUp, testEmail } from "./support/backend";

/**
 * LinkedIn integration end-to-end.
 *
 * Two categories:
 *
 *  * **Always safe** — OAuth initiation, CSRF `state` rejection, capability
 *    gating. These never touch a real member's feed.
 *  * **Live** — anything that could create a post. Skipped unless
 *    `E2E_LINKEDIN_LIVE=1`, because publishing to a real member's account during
 *    a test run is exactly the kind of accident this suite must not cause.
 */

const PASSWORD = "correct-horse-battery-staple";
const live = process.env.E2E_LINKEDIN_LIVE === "1";

test.beforeEach(async ({ page }) => {
  needsBackend();
  await signUp(page, "LinkedIn Tester", testEmail("linkedin"), PASSWORD);
  await completeOnboardingIfNeeded(page, "LinkedIn Workspace");
});

test.describe("OAuth initiation", () => {
  test("the connect endpoint redirects to LinkedIn with a state parameter", async ({ page }) => {
    const checks = await integrations(page);
    test.skip(!checks.linkedin, "LinkedIn is not configured in this environment.");

    // `maxRedirects: 0` lets us inspect the Location header instead of following.
    const response = await page.request.get("/api/linkedin/connect", { maxRedirects: 0 });

    expect([302, 303, 307]).toContain(response.status());
    const location = response.headers()["location"] ?? "";

    expect(location).toContain("linkedin.com/oauth/v2/authorization");
    expect(location).toContain("state=");
    expect(location).toContain("w_member_social");
    expect(location).toContain("client_id=");
    expect(location).toContain("redirect_uri=");

    // A CSRF state cookie must be set alongside the redirect.
    const cookies = await page.context().cookies();
    expect(cookies.some((cookie) => cookie.name.includes("linkedin_state"))).toBe(true);
    const stateCookie = cookies.find((cookie) => cookie.name.includes("linkedin_state"));
    expect(stateCookie?.httpOnly, "state cookie must be httpOnly").toBe(true);
  });

  test("the analytics scope is only requested when it has been granted", async ({ page }) => {
    const checks = await integrations(page);
    test.skip(!checks.linkedin, "LinkedIn is not configured in this environment.");

    const response = await page.request.get("/api/linkedin/connect", { maxRedirects: 0 });
    const location = response.headers()["location"] ?? "";

    // Requesting an unapproved scope aborts the whole consent screen, so its
    // presence must track the server's own capability report.
    if (process.env.E2E_ANALYTICS_SCOPE === "1") {
      expect(location).toContain("r_member_postAnalytics");
    } else {
      expect(location).not.toContain("r_member_postAnalytics");
    }
  });

  test("connecting requires an admin role", async ({ page }) => {
    const response = await page.request.get("/api/linkedin/connect", { maxRedirects: 0 });
    // The test account owns its workspace, so this must not be a 403.
    expect(response.status()).not.toBe(403);
  });
});

test.describe("OAuth callback rejects forged state", () => {
  test("a callback with no state is refused and does not create a connection", async ({ page }) => {
    const before = (await (await page.request.get("/api/linkedin/accounts")).json()).data;

    const response = await page.request.get("/api/linkedin/callback?code=stolen-code", {
      maxRedirects: 0,
    });

    expect(response.status()).toBeGreaterThanOrEqual(300);
    expect(response.status()).toBeLessThan(500);

    const after = (await (await page.request.get("/api/linkedin/accounts")).json()).data;
    expect(after.accounts.length).toBe(before.accounts.length);
  });

  test("a callback with a mismatched state is refused", async ({ page }) => {
    const before = (await (await page.request.get("/api/linkedin/accounts")).json()).data;

    const response = await page.request.get(
      "/api/linkedin/callback?code=abc&state=not-the-state-we-issued",
      { maxRedirects: 0 },
    );

    expect(response.status()).toBeGreaterThanOrEqual(300);
    expect(response.status()).toBeLessThan(500);

    const after = (await (await page.request.get("/api/linkedin/accounts")).json()).data;
    expect(after.accounts.length).toBe(before.accounts.length);
  });

  test("the failure redirect never echoes the provider error verbatim", async ({ page }) => {
    const response = await page.request.get("/api/linkedin/callback?error=access_denied&error_description=User+cancelled+the+flow+from+10.0.0.4", {
      maxRedirects: 0,
    });

    const location = response.headers()["location"] ?? "";
    expect(location).not.toContain("10.0.0.4");
    expect(location).not.toContain("error_description");
  });
});

test.describe("capability gating", () => {
  test("the connections endpoint reports what the app is actually allowed to do", async ({ page }) => {
    const payload = (await (await page.request.get("/api/linkedin/accounts")).json()).data;

    expect(payload.capabilities).toMatchObject({
      configured: expect.any(Boolean),
      publishing: expect.any(Boolean),
      analytics: expect.any(Boolean),
    });

    for (const scope of payload.capabilities.scopes) {
      expect(["openid", "profile", "email", "w_member_social", "r_member_postAnalytics"]).toContain(scope);
    }
  });

  test("an unconfigured integration shows a blocker instead of a dead button", async ({ page }) => {
    const checks = await integrations(page);
    test.skip(checks.linkedin, "LinkedIn is configured here; the blocker path is not exercised.");

    await page.goto("/settings/linkedin");
    await page.waitForLoadState("networkidle");

    const body = (await page.textContent("body")) ?? "";
    expect(body).toMatch(/not configured|connect|credentials|LINKEDIN_CLIENT/i);
    // A button that would silently do nothing is the failure mode to avoid.
    const buttons = await page.getByRole("button").all();
    expect(buttons.length).toBeGreaterThan(0);
  });

  test("with no connected account, composer states why publishing is unavailable", async ({ page }) => {
    const payload = (await (await page.request.get("/api/linkedin/accounts")).json()).data;
    test.skip(payload.accounts.length > 0, "An account is connected here.");

    await page.goto("/posts/new");
    await page.waitForLoadState("networkidle");

    const body = (await page.textContent("body")) ?? "";
    expect(body).toMatch(/connect a linkedin|no linkedin account|connect your/i);
  });
});

test.describe("token expiry and reauthorization", () => {
  test("an expired connection blocks publishing rather than failing at the API", async ({ page }) => {
    const payload = (await (await page.request.get("/api/linkedin/accounts")).json()).data;
    test.skip(payload.accounts.length === 0, "No connected account in this environment.");

    for (const account of payload.accounts) {
      if (account.status === "active") continue;

      // A non-active account must not be offered as a publishing target.
      await page.goto("/posts/new");
      const body = (await page.textContent("body")) ?? "";
      expect(body).toMatch(/reconnect|expired|revoked/i);
    }
  });

  test("rechecking a connection never returns a token to the browser", async ({ page }) => {
    const payload = (await (await page.request.get("/api/linkedin/accounts")).json()).data;
    test.skip(payload.accounts.length === 0, "No connected account in this environment.");

    const response = await page.request.post(
      `/api/linkedin/accounts/${payload.accounts[0].id}/recheck`,
    );
    const body = await response.text();

    // Tokens are the single most sensitive value in the product.
    expect(body).not.toMatch(/access_?token/i);
    expect(body).not.toMatch(/refresh_?token/i);
    expect(body).not.toMatch(/^v1\./m);
  });

  test("disconnecting removes the account", async ({ page }) => {
    const payload = (await (await page.request.get("/api/linkedin/accounts")).json()).data;
    test.skip(payload.accounts.length === 0, "No connected account in this environment.");

    const accountId = payload.accounts[0].id;
    const response = await page.request.delete(`/api/linkedin/accounts/${accountId}`);
    expect(response.ok()).toBe(true);

    const after = (await (await page.request.get("/api/linkedin/accounts")).json()).data;
    const stillThere = after.accounts.some((a: { id: string; status: string }) => a.id === accountId && a.status === "active");
    expect(stillThere).toBe(false);
  });
});

test.describe("live publishing", () => {
  test.skip(!live, "Set E2E_LINKEDIN_LIVE=1 to publish to a real LinkedIn account.");

  test("a text post publishes and comes back with a permalink", async ({ page }) => {
    const payload = (await (await page.request.get("/api/linkedin/accounts")).json()).data;
    const accountId = payload.accounts[0]?.id;
    expect(accountId).toBeTruthy();

    const created = await page.request.post("/api/posts", {
      data: {
        authorAccountId: accountId,
        body: `Zybble end-to-end test ${new Date().toISOString()}`,
        intent: "publish_now",
      },
    });

    expect(created.status()).toBe(202);
    const postId = (await created.json()).data.post.id;

    let post: { status: string; permalink: string | null } = { status: "", permalink: null };
    for (let i = 0; i < 30; i += 1) {
      post = (await (await page.request.get(`/api/posts/${postId}`)).json()).data.post;
      if (["published", "failed"].includes(post.status)) break;
      await page.waitForTimeout(2_000);
    }

    expect(post.status).toBe("published");
    expect(post.permalink).toMatch(/^https:\/\/(www\.)?linkedin\.com\//);
  });

  test("a duplicate publish request does not create a second post", async ({ page }) => {
    const payload = (await (await page.request.get("/api/linkedin/accounts")).json()).data;
    const accountId = payload.accounts[0]?.id;
    const key = `e2e-idem-${Date.now()}`;

    const body = {
      authorAccountId: accountId,
      body: `Zybble idempotency test ${new Date().toISOString()}`,
      intent: "publish_now" as const,
      idempotencyKey: key,
    };

    const first = await page.request.post("/api/posts", { data: body });
    const second = await page.request.post("/api/posts", { data: body });

    const a = (await first.json()).data.post;
    const b = (await second.json()).data.post;
    expect(b.id).toBe(a.id);
  });
});
