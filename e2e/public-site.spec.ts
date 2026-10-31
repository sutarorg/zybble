import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { realBackend } from "./support/backend";

/**
 * Public surface. These tests need nothing but a built app, so they run on
 * every push — including in environments with no external credentials.
 */

const PUBLIC_PAGES = [
  { path: "/", heading: /linkedin/i },
  { path: "/pricing", heading: /pricing|plan/i },
  { path: "/linkedin-scheduler", heading: /schedul/i },
  { path: "/linkedin-analytics", heading: /analytic/i },
  { path: "/blog", heading: /blog|writing|insight/i },
  { path: "/privacy", heading: /privacy/i },
  { path: "/terms", heading: /terms/i },
];

test.describe("public pages render", () => {
  for (const page of PUBLIC_PAGES) {
    test(`${page.path} loads with a single h1`, async ({ page: p }) => {
      const response = await p.goto(page.path);
      expect(response?.status()).toBe(200);

      await expect(p.locator("h1").first()).toBeVisible();
      // One h1 per page is a design-system rule, not just an SEO nicety.
      await expect(p.locator("h1")).toHaveCount(1);
    });
  }
});

test.describe("no dead links", () => {
  test("every marketing navigation link resolves", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: /main navigation/i }).first();
    const links = await nav.getByRole("link").evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("href")).filter(Boolean),
    );

    expect(links.length).toBeGreaterThan(0);

    for (const href of links as string[]) {
      if (!href.startsWith("/")) continue; // external links are out of scope
      const response = await page.request.get(href);
      expect(response.status(), `${href} is dead`).toBeLessThan(400);
    }
  });

  test("footer links resolve", async ({ page }) => {
    await page.goto("/");
    const links = await page
      .getByRole("contentinfo")
      .getByRole("link")
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("href")).filter((href) => href?.startsWith("/")),
      );

    expect(links.length).toBeGreaterThan(0);

    for (const href of links as string[]) {
      const response = await page.request.get(href);
      expect(response.status(), `${href} is dead`).toBeLessThan(400);
    }
  });
});

test.describe("SEO and indexing", () => {
  test("public pages are indexable and carry a canonical URL", async ({ page }) => {
    await page.goto("/pricing");

    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveAttribute("href", /\/pricing$/);

    const robots = page.locator('meta[name="robots"]');
    if ((await robots.count()) > 0) {
      await expect(robots).not.toHaveAttribute("content", /noindex/);
    }
  });

  test("authenticated pages are never indexable", async ({ page }) => {
    const response = await page.goto("/dashboard");

    // Unauthenticated visitors are redirected; either way the page must not be
    // presented as indexable content.
    if (response && response.status() >= 300 && response.status() < 400) {
      const headers = await page.request.get("/dashboard").then((r) => r.headers());
      expect(headers["x-robots-tag"] ?? "").toContain("noindex");
      return;
    }

    const robots = page.locator('meta[name="robots"]');
    await expect(robots).toHaveAttribute("content", /noindex/);
  });

  test("auth pages are noindex", async ({ page }) => {
    for (const path of ["/login", "/signup", "/forgot-password", "/reset-password"]) {
      await page.goto(path);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    }
  });

  test("robots.txt exists, lists the sitemap and disallows private paths", async ({ page }) => {
    const response = await page.request.get("/robots.txt");
    expect(response.status()).toBe(200);

    const body = await response.text();
    expect(body).toContain("Sitemap:");
    for (const path of ["/dashboard", "/settings", "/api/"]) {
      expect(body, `${path} should be disallowed`).toContain(`Disallow: ${path}`);
    }
  });

  test("sitemap.xml is valid XML and lists only public routes", async ({ page }) => {
    const response = await page.request.get("/sitemap.xml");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("xml");

    const body = await response.text();
    expect(body).toContain("<urlset");
    expect(body).not.toContain("/dashboard");
    expect(body).not.toContain("/settings/billing");
  });
});

test.describe("security headers", () => {
  test("every response carries the baseline hardening headers", async ({ page }) => {
    const response = await page.request.get("/");
    const headers = response.headers();

    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(headers["permissions-policy"]).toContain("camera=()");
  });

  test("API responses are never cached", async ({ page }) => {
    const response = await page.request.get("/api/health");
    expect(response.headers()["cache-control"]).toContain("no-store");
  });

  test("the X-Powered-By header is not advertised", async ({ page }) => {
    const response = await page.request.get("/");
    expect(response.headers()["x-powered-by"]).toBeUndefined();
  });
});

test.describe("health endpoint", () => {
  test("reports configuration without leaking secrets", async ({ page }) => {
    const response = await page.request.get("/api/health");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty("checks");
    expect(body).toHaveProperty("analyticsScopeEnabled");

    // The whole point of this endpoint is a boolean per integration — never a
    // key, a URL or a connection string.
    const serialised = JSON.stringify(body);
    expect(serialised).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/); // JWT
    expect(serialised).not.toMatch(/postgres(ql)?:\/\//);
    expect(serialised).not.toMatch(/whsec_/);
  });

  test("tells the truth about whether Supabase is configured", async ({ page }) => {
    const body = await (await page.request.get("/api/health")).json();
    expect(body.checks.supabase).toBe(realBackend ? true : false);
  });
});

test.describe("accessibility of public pages", () => {
  for (const path of ["/", "/pricing", "/blog", "/privacy"]) {
    test(`${path} has no automatically detectable WCAG violations`, async ({ page }) => {
      await page.goto(path);
      // Let reveal animations and lazy content settle so axe sees the final DOM.
      await page.waitForLoadState("networkidle");

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();

      const violations = results.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.length,
        help: violation.help,
      }));

      expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
    });
  }
});
