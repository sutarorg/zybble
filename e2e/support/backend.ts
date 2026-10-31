import { test, type Page } from "@playwright/test";

/**
 * Shared helpers for the E2E suite.
 *
 * The suite is deliberately split in two:
 *
 *  * **Surface tests** always run. They need nothing but a built app and prove
 *    the public marketing site, SEO metadata, security headers, responsive
 *    layout and accessibility of pages that are not behind auth.
 *  * **Backend tests** need a configured Supabase project (and, for billing and
 *    LinkedIn, their respective credentials). They skip with a visible reason
 *    when `E2E_REAL_BACKEND` is not set, because a passing run that silently
 *    exercised nothing is worse than an honest skip.
 */

export const realBackend = process.env.E2E_REAL_BACKEND === "1";

/** Skip the current test unless a real backend is configured. */
export function needsBackend(): void {
  test.skip(
    !realBackend,
    "Requires E2E_REAL_BACKEND=1 and a configured Supabase project (see DEPLOYMENT.md).",
  );
}

/** Skip unless the named integration is configured on the server. */
export function needsIntegration(): (page: Page) => Promise<void> {
  return async () => {
    test.skip(!realBackend, "Requires E2E_REAL_BACKEND=1.");
  };
}

/** A unique address per run so repeated runs never collide with old accounts. */
export function testEmail(prefix = "e2e"): string {
  const stamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}+${stamp}${random}@example.com`;
}

/**
 * Read the `integrations` map from `/api/health`.
 *
 * Used to gate tests on what the deployment actually has, rather than on what
 * the test author assumed.
 */
export async function integrations(page: Page): Promise<Record<string, boolean>> {
  const response = await page.request.get("/api/health");
  const body = (await response.json()) as { checks?: Record<string, boolean> };
  return body.checks ?? {};
}

/** Sign in through the real login form. Assumes the account already exists. */
export async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/^email$/i).fill(email);
  await page.getByLabel(/^password$/i).fill(password);
  await page.getByRole("button", { name: /log in|sign in/i }).click();
  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 30_000 });
}

/** Create an account through the real signup form, then land on onboarding. */
export async function signUp(page: Page, name: string, email: string, password: string): Promise<void> {
  await page.goto("/signup");
  await page.getByLabel(/full name/i).fill(name);
  await page.getByLabel(/^email$/i).fill(email);
  await page.getByLabel(/^password$/i).fill(password);
  await page.getByRole("button", { name: /create|sign up|get started/i }).click();
  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 30_000 });
}

/** Complete first-time onboarding if the app routed there. */
export async function completeOnboardingIfNeeded(page: Page, workspaceName: string): Promise<void> {
  if (!page.url().includes("/onboarding")) return;

  await page.getByLabel(/workspace name/i).fill(workspaceName);
  await page.getByRole("button", { name: /create|continue|finish/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}
