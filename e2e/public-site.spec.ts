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

test.describe("free tools, trust pages and personas", () => {
  const NEW_PAGES = [
    { path: "/free-linkedin-tools", heading: /free linkedin tools/i },
    { path: "/tools/linkedin-engagement-rate-calculator", heading: /engagement rate/i },
    { path: "/resources/linkedin-content-calendar-template", heading: /content calendar/i },
    { path: "/tools/linkedin-character-counter", heading: /write to the limit|character/i },
    { path: "/tools/linkedin-keyword-analyzer", heading: /keyword/i },
    { path: "/about", heading: /about|zybble exists/i },
    { path: "/contact", heading: /talk to|contact/i },
    { path: "/security", heading: /security|protect/i },
  ];

  for (const page of NEW_PAGES) {
    test(`${page.path} loads with a single h1 and a canonical`, async ({ page: p }) => {
      const response = await p.goto(page.path);
      expect(response?.status()).toBe(200);

      await expect(p.locator("h1")).toHaveCount(1);
      await expect(p.locator("h1").first()).toContainText(page.heading);

      const canonical = p.locator('link[rel="canonical"]');
      await expect(canonical).toHaveAttribute("href", new RegExp(`${page.path.replace(/\//g, "\\/")}$`));
    });
  }

  test("the engagement calculator computes a rate from inputs", async ({ page }) => {
    await page.goto("/tools/linkedin-engagement-rate-calculator");

    const labels = [
      ["Impressions", "4200"],
      ["Reactions", "85"],
      ["Comments", "14"],
      ["Reposts", "6"],
    ];
    for (const [label, value] of labels) {
      await page
        .locator("label", { hasText: label })
        .first()
        .getByRole("textbox")
        .fill(value);
    }

    // (85 + 14 + 6) / 4200 = 2.5%
    await expect(page.getByText("2.50%")).toBeVisible();
    await expect(page.getByText("(105 ÷ 4,200) × 100")).toBeVisible();
  });

  test("the character counter counts, warns over the limit and copies", async ({ page }) => {
    await page.goto("/tools/linkedin-character-counter");

    await page
      .getByRole("textbox")
      .fill("A".repeat(3050));
    await expect(page.getByText(/over LinkedIn/)).toBeVisible();

    await page.getByRole("button", { name: "Clear" }).click();
    await expect(page.getByText("0", { exact: true }).first()).toBeVisible();
  });

  test("the keyword analyzer reports on a pasted draft", async ({ page }) => {
    await page.goto("/tools/linkedin-keyword-analyzer");

    // First textarea is the keyword list, second is the post draft.
    await page.locator("textarea").nth(0).fill("linkedin analytics");

    // A draft written the way a person would write one: "linkedin analytics"
    // appears twice in ~110 words, i.e. 1.8% density, comfortably under the
    // 3% flag. The previous fixture repeated the phrase 12 times in 48 words
    // (25% density), which analysePost() correctly reports as "Overused" — so
    // it could never have matched "Present". The fixture was wrong, not the
    // tool.
    const realisticDraft =
      "Most founders treat LinkedIn analytics like a scoreboard. It isn't. " +
      "Analytics is a decision tool: when a post outperforms your median, the " +
      "useful question is not how do I repeat this exact post, but what did it " +
      "change about who saw my work. Last quarter I reviewed six months of " +
      "LinkedIn analytics in one sitting. The pattern was uncomfortable - my " +
      "highest-reach posts were not the ones that started conversations. Reach " +
      "flattered the topics I enjoyed writing; engagement rate told the truth " +
      "about what my audience actually needed. So I changed the mix: fewer hot " +
      "takes, more working notes. Nothing about my posting frequency changed - " +
      "only what each post was for.";
    await page.locator("textarea").nth(1).fill(realisticDraft);

    await expect(page.getByText("Keyword report")).toBeVisible();
    await expect(page.getByText("Present", { exact: true }).first()).toBeVisible();

    // Over-optimisation must still be flagged. This is the behaviour the old
    // fixture was actually exercising, so assert it explicitly rather than
    // leaving it covered by accident.
    await page
      .locator("textarea")
      .nth(1)
      .fill("linkedin analytics helps founders. ".repeat(12));
    await expect(page.getByText("Overused", { exact: true }).first()).toBeVisible();
  });

  test("the calendar planner stores entries and offers the CSV download", async ({ page }) => {
    await page.goto("/resources/linkedin-content-calendar-template");

    await page.getByRole("button", { name: "Load example week" }).click();
    await expect(page.getByText("Status & notes")).toBeVisible();

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download CSV" }).click();
    expect((await download).suggestedFilename()).toBe("linkedin-content-calendar.csv");
  });

  test("the homepage surfaces the persona wall and the tools strip", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /built for professionals like you/i })).toBeVisible();
    await expect(page.getByText("Illustrative persona").first()).toBeVisible();
    // The standalone disclaimer paragraph under the wall was removed as
    // redundant (every card carries an "Illustrative persona" badge). The
    // honesty signal still has to live somewhere, so assert the section
    // heading still says these are not customer testimonials.
    await expect(
      page.getByText(/illustrative personas — not customer testimonials/i),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: /useful before you sign up/i })).toBeVisible();
  });

  test("the contact form validates and submits against the API", async ({ page }) => {
    await page.goto("/contact");

    // The form posts to /api/contact, which without a configured email
    // provider responds with an honest failure — the test asserts the
    // contract, not the provider.
    await page.getByLabel("Your name").fill("E2E Visitor");
    await page.getByLabel("Email").fill("e2e@example.com");
    await page.getByLabel("Message").fill("This is an automated end-to-end test message.");
    await page.getByRole("button", { name: /send message/i }).click();

    // Scoped to <main> on purpose. Next.js appends its route announcer — a
    // role="alert" node inside a shadow root on <body> — to every page, so an
    // unscoped getByRole("alert") matches two elements whenever the form
    // reports an error, which is every run without an email provider
    // configured. The announcer is on <body>, so <main> excludes it.
    const feedback = page
      .getByRole("main")
      .getByRole("status")
      .or(page.getByRole("main").getByRole("alert"));

    await expect(feedback).toBeVisible({ timeout: 15_000 });
  });

  test("the reusable CSV template downloads", async ({ page }) => {
    const response = await page.request.get("/downloads/linkedin-content-calendar-template.csv");
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toContain("Publishing date,Content topic,Post format,Status,Notes");
  });
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
    // The sitemap pointer must be the canonical HTTPS origin — an http:// or
    // www URL here leaks a non-canonical host into crawler configuration.
    expect(body).toMatch(/Sitemap: https:\/\/zybble\.com\/sitemap\.xml/);
    for (const path of ["/dashboard", "/settings", "/api/", "/login", "/signup"]) {
      expect(body, `${path} should be disallowed`).toContain(`Disallow: ${path}`);
    }
  });

  test("sitemap.xml is valid XML and lists only public routes", async ({ page }) => {
    const response = await page.request.get("/sitemap.xml");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("xml");

    const body = await response.text();
    expect(body).toContain("<urlset");

    // Never list private or authenticated surfaces — not the app shell, and
    // not the auth pages either, which are robots-disallowed and noindexed.
    for (const path of ["/dashboard", "/settings/billing", "/login", "/signup", "/onboarding"]) {
      expect(body, `${path} must not appear in the sitemap`).not.toContain(path);
    }

    // Every entry must be an absolute HTTPS URL on the canonical host. A
    // mistyped site URL once emitted http:// links; guard against a repeat.
    //
    // Assert on the extracted URL, not the whole <loc> tag. The tag is followed
    // by "</loc>", so a pattern ending in "$" can never match the bare root
    // entry — the check silently covered only child routes and failed on the
    // one entry where a wrong host would matter most.
    const urls = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]!);
    expect(urls.length).toBeGreaterThan(20);
    for (const url of urls) {
      expect(url, url).toMatch(/^https:\/\/zybble\.com(\/|$)/);
    }

    // Every published article must be present.
    for (const slug of ["how-to-find-your-best-time-to-post-on-linkedin", "linkedin-content-roi-b2b"]) {
      expect(body).toContain(`/blog/${slug}</loc>`);
    }
  });

  test("retired category archives permanently redirect to their consolidated archive", async ({ page }) => {
    for (const [from, to] of [
      ["/blog/category/scheduling", "/blog/category/strategy"],
      ["/blog/category/how-to", "/blog/category/tools"],
      ["/blog/category/resources", "/blog/category/tools"],
      ["/blog/category/formats", "/blog/category/writing"],
    ]) {
      const response = await page.request.get(from, { maxRedirects: 0 });
      // Next.js emits 308 for `permanent: true` redirects; 308 is the
      // method-preserving permanent-redirect twin of 301 for crawlers.
      expect([301, 308], from).toContain(response.status());
      expect(response.headers()["location"], from).toContain(to);
    }
  });

  test("unknown routes return a real 404 status", async ({ page }) => {
    const response = await page.request.get("/blog/this-post-does-not-exist");
    expect(response.status()).toBe(404);
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
        // Where and why. For colour contrast axe's failure summary names the
        // measured ratio, both colours and the required threshold, so a CI log
        // is enough to fix the styling — nobody has to re-run axe by hand.
        where: violation.nodes.slice(0, 8).map(
          (node) =>
            `${node.target.join(" ")} — ${(node.failureSummary ?? "")
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean)
              .slice(1, 3)
              .join(" ")
              .slice(0, 220)}`,
        ),
      }));

      expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
    });
  }
});

/**
 * The Inngest endpoint.
 *
 * `/api/inngest` is the only endpoint an external service calls into, which
 * makes it the one endpoint that can be broken by configuration alone rather
 * than by a code change — and therefore the one a normal CI run would never
 * notice. It broke exactly that way: the SDK was pinned to cloud mode without a
 * signing key, answered `500 {"code":"internal_server_error"}` to every method,
 * and the Inngest dashboard reported only "the URL is unreachable".
 *
 * The assertion is deliberately about the *shape* of the answer rather than a
 * status code, because two different configurations are legitimate here: a dev
 * server answers 200, and a correctly configured production endpoint answers
 * 401 to an unsigned probe. What is never acceptable is an opaque 500.
 */
test.describe("Inngest endpoint reachability", () => {
  test("answers Inngest's methods instead of failing opaquely", async ({ page }) => {
    for (const method of ["GET", "PUT"] as const) {
      const response = await page.request.fetch("/api/inngest", { method });
      const status = response.status();

      // 200  dev mode (no signing key required)
      // 401  cloud mode, signing key present, this unsigned probe is rejected
      // 503  cloud mode, signing key missing — the endpoint says so by name
      expect([200, 401, 503], `${method} /api/inngest returned ${status}`).toContain(status);

      // Never the SDK's opaque failure, which is what Inngest reports as an
      // unreachable URL with no usable cause.
      expect(status, `${method} /api/inngest failed opaquely`).not.toBe(500);
    }
  });

  test("says which variable is missing when it cannot serve", async ({ page }) => {
    const response = await page.request.get("/api/inngest");

    if (response.status() !== 503) {
      // Configured (or in dev mode). Nothing to assert about the message.
      return;
    }

    const body = await response.json();
    expect(body.error.details.variable).toBe("INNGEST_SIGNING_KEY");
    expect(body.error.message).toContain("INNGEST_SIGNING_KEY");
  });

  test("health separates sending events from serving requests", async ({ page }) => {
    const body = await (await page.request.get("/api/health")).json();

    // A deployment can send events while its serve endpoint is broken, or the
    // reverse. Reporting them as one flag is how a broken endpoint passed a
    // health check.
    expect(typeof body.checks.inngestEvents).toBe("boolean");
    expect(typeof body.checks.inngestServe).toBe("boolean");
  });
});
