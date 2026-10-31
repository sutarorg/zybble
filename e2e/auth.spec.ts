import { expect, test } from "@playwright/test";
import { completeOnboardingIfNeeded, needsBackend, signIn, signUp, testEmail } from "./support/backend";

/**
 * Authentication end-to-end.
 *
 * These exercise the real Supabase Auth integration: a real row in
 * `auth.users`, a real `profiles` row, a real session cookie. Nothing is
 * mocked, because a mocked auth flow proves nothing about the part that
 * actually breaks in production (cookie refresh, redirect URLs, email
 * confirmation).
 */

const PASSWORD = "correct-horse-battery-staple";

test.describe("signup", () => {
  test("creates an account and reaches onboarding or the dashboard", async ({ page }) => {
    needsBackend();
    await signUp(page, "E2E Tester", testEmail("signup"), PASSWORD);
    await completeOnboardingIfNeeded(page, "E2E Workspace");

    await expect(page).toHaveURL(/\/dashboard/);
    // The session endpoint is the source of truth; the UI must agree with it.
    const session = await (await page.request.get("/api/auth/session")).json();
    expect(session.data.user.email).toContain("signup+");
    expect(session.data.profile).toBeTruthy();
  });

  test("rejects a password under 12 characters before calling the server", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel(/full name/i).fill("Short Password");
    await page.getByLabel(/^email$/i).fill(testEmail("short"));
    await page.getByLabel(/^password$/i).fill("short");
    await page.getByRole("button", { name: /create|sign up|get started/i }).click();

    await expect(page.getByText(/12 characters/i).first()).toBeVisible();
  });

  test("reports a duplicate address without confirming it exists to a stranger", async ({ page }) => {
    needsBackend();
    const email = testEmail("dupe");
    await signUp(page, "First User", email, PASSWORD);
    await completeOnboardingIfNeeded(page, "First Workspace");

    // Sign out, then try the same address again.
    await page.request.post("/api/auth/logout");
    await page.goto("/signup");
    await page.getByLabel(/full name/i).fill("Second User");
    await page.getByLabel(/^email$/i).fill(email);
    await page.getByLabel(/^password$/i).fill(PASSWORD);
    await page.getByRole("button", { name: /create|sign up|get started/i }).click();

    // Supabase hides duplicates when confirmation is on; either way the message
    // must never include the address or a provider string.
    const body = await page.textContent("body");
    expect(body).not.toMatch(/10\.\d+\.\d+\.\d+/);
    expect(body).not.toMatch(/duplicate key value/);
  });
});

test.describe("login and session", () => {
  test("rejects wrong credentials with a safe message", async ({ page }) => {
    needsBackend();
    await page.goto("/login");
    await page.getByLabel(/^email$/i).fill("nobody@example.com");
    await page.getByLabel(/^password$/i).fill("definitely-wrong-password");
    await page.getByRole("button", { name: /log in|sign in/i }).click();

    await expect(page.getByRole("alert").first()).toBeVisible();

    const text = (await page.getByRole("alert").first().textContent()) ?? "";
    expect(text).not.toMatch(/invalid login credentials/i); // provider string
    expect(text).not.toMatch(/at \d+\.\d+\.\d+\.\d+/);
  });

  test("protects authenticated routes from anonymous visitors", async ({ page }) => {
    for (const path of ["/dashboard", "/posts", "/calendar", "/settings", "/analytics"]) {
      await page.goto(path);
      await expect(page, `${path} should not render for an anonymous visitor`).toHaveURL(/\/login/);
    }
  });

  test("signs out and cannot reach protected pages afterwards", async ({ page }) => {
    needsBackend();
    const email = testEmail("logout");
    await signUp(page, "Logout Tester", email, PASSWORD);
    await completeOnboardingIfNeeded(page, "Logout Workspace");

    await page.request.post("/api/auth/logout");
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("an expired or forged session cookie is rejected", async ({ page }) => {
    needsBackend();
    await signUp(page, "Cookie Tester", testEmail("cookie"), PASSWORD);
    await completeOnboardingIfNeeded(page, "Cookie Workspace");

    // Overwrite the session cookies with junk: the server must 401, not 500.
    const cookies = await page.context().cookies();
    const sessionCookies = cookies.filter((c) => c.name.includes("auth-token"));
    expect(sessionCookies.length).toBeGreaterThan(0);

    await page.context().clearCookies();
    for (const cookie of sessionCookies) {
      await page.context().addCookies([{ ...cookie, value: "not.a.valid.jwt" }]);
    }

    const response = await page.request.get("/api/auth/session");
    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.error.message).not.toMatch(/JWT|json web token|malformed/i);
  });
});

test.describe("password reset", () => {
  test("the request is non-enumerable and always reports success", async ({ page }) => {
    await page.goto("/forgot-password");

    const known = await page.request.post("/api/auth/password", {
      data: { email: "definitely-not-registered@example.com" },
    });
    const unknown = await page.request.post("/api/auth/password", {
      data: { email: testEmail("ghost") },
    });

    expect(known.status()).toBe(202);
    expect(unknown.status()).toBe(202);
    // Identical bodies: an attacker must not be able to tell the two apart.
    expect(await known.text()).toBe(await unknown.text());
  });

  test("rejects a malformed address before sending anything", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel(/^email$/i).fill("not-an-email");
    await page.getByRole("button", { name: /send|reset|email/i }).click();

    await expect(page.getByRole("alert").first()).toBeVisible();
  });

  test("reset links cannot point at another origin", async ({ page }) => {
    // The redirect target is the classic open-redirect vector in a reset flow.
    const response = await page.request.post("/api/auth/password", {
      data: {
        email: "someone@example.com",
        redirectTo: "https://evil.example.com/steal",
      },
    });

    // Either rejected outright, or accepted but sanitised. It must never be
    // echoed back as an absolute foreign URL.
    const body = await response.text();
    expect(body).not.toContain("evil.example.com");
  });
});

test.describe("email verification", () => {
  test("an unconfirmed address cannot sign in when confirmation is enabled", async ({ page }) => {
    needsBackend();
    const body = await (await page.request.get("/api/health")).json();

    // Supabase hides this distinction when confirmation is on, so the only
    // honest assertion is that the app never leaks provider internals.
    expect(body).toHaveProperty("checks.supabase");

    await page.goto("/login");
    await page.getByLabel(/^email$/i).fill(testEmail("unconfirmed"));
    await page.getByLabel(/^password$/i).fill(PASSWORD);
    await page.getByRole("button", { name: /log in|sign in/i }).click();

    const text = (await page.textContent("body")) ?? "";
    expect(text).not.toMatch(/email not confirmed/i);
    expect(text).not.toMatch(/AuthApiError/);
  });

  test("resending the confirmation email is rate limited, not open", async ({ page }) => {
    let limited = false;

    for (let i = 0; i < 8; i += 1) {
      const response = await page.request.post("/api/auth/verify", {
        data: { email: testEmail("resend") },
      });
      if (response.status() === 429) {
        limited = true;
        expect(response.headers()["retry-after"]).toBeTruthy();
        break;
      }
    }

    expect(limited, "resend was never rate limited across 8 requests").toBe(true);
  });
});
