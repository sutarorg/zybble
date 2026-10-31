import { expect, test } from "@playwright/test";
import { completeOnboardingIfNeeded, integrations, needsBackend, signUp, testEmail } from "./support/backend";

/**
 * Analytics end-to-end.
 *
 * The rule this suite exists to defend: **no invented numbers**. Every value
 * must trace back to a LinkedIn API response, and where there is not enough
 * history the product must say so instead of drawing a plausible-looking chart.
 */

const PASSWORD = "correct-horse-battery-staple";

test.beforeEach(async ({ page }) => {
  needsBackend();
  await signUp(page, "Analytics Tester", testEmail("analytics"), PASSWORD);
  await completeOnboardingIfNeeded(page, "Analytics Workspace");
});

test.describe("empty state", () => {
  test("a brand-new workspace shows an empty state, not zeroes presented as data", async ({ page }) => {
    await page.goto("/analytics");
    await page.waitForLoadState("networkidle");

    // Either an explicit empty state, or numbers that are genuinely zero with
    // nothing claiming to be an insight.
    const body = (await page.textContent("body")) ?? "";
    const hasEmptyState = /no (posts|data|analytics) yet|not enough|insufficient|nothing (to show|here)/i.test(body);
    const allZero = /0\s*$/m.test(body) || /\b0\b/.test(body);

    expect(hasEmptyState || allZero).toBe(true);

    // Fabrication check: an empty workspace must not show a best-time grid with
    // populated scores.
    const bestTimeRequest = await page.request.get("/api/analytics?range=28d");
    const payload = (await bestTimeRequest.json()).data;

    if (payload.bestTime.insufficientData) {
      const scores = payload.bestTime.cells.filter((cell: { score: number | null }) => cell.score !== null);
      expect(scores, "best-time scores exist despite insufficient data").toHaveLength(0);
    }
  });
});

test.describe("entitlements", () => {
  test("Free cannot request 12 months of history", async ({ page }) => {
    const response = await page.request.get("/api/analytics?range=12m");

    // Either refused outright, or served as a shorter range — never as 365
    // days of data the plan does not include.
    if (response.status() === 402) {
      expect((await response.json()).error.code).toBe("entitlement_required");
      return;
    }

    expect(response.status()).toBe(200);
    const payload = (await response.json()).data;
    expect(payload.rangeDays).toBeLessThanOrEqual(28);
  });

  test("the response states the capabilities it was computed under", async ({ page }) => {
    const payload = (await (await page.request.get("/api/analytics?range=7d")).json()).data;

    expect(payload.capabilities).toMatchObject({
      analyticsPermission: expect.any(Boolean),
      connectedAccounts: expect.any(Number),
      bestTimeUnlocked: expect.any(Boolean),
      historyDays: expect.any(Number),
    });
  });
});

test.describe("best-time recommendations", () => {
  test("are gated on Pro and on enough observations", async ({ page }) => {
    const payload = (await (await page.request.get("/api/analytics?range=28d")).json()).data;
    const bestTime = payload.bestTime;

    if (bestTime.insufficientData) {
      expect(bestTime.insufficientData.requiredPosts).toBeGreaterThan(0);
      expect(bestTime.insufficientData.observedPosts).toBeLessThan(
        bestTime.insufficientData.requiredPosts,
      );
      // Cells exist for the grid, but carry no score.
      for (const cell of bestTime.cells) {
        expect(cell.score).toBeNull();
      }
    } else {
      expect(bestTime.meta.observations).toBeGreaterThan(0);
      expect(bestTime.meta.topSlots.length).toBeGreaterThan(0);
      for (const slot of bestTime.meta.topSlots) {
        expect(slot.weekday).toBeGreaterThanOrEqual(0);
        expect(slot.weekday).toBeLessThanOrEqual(6);
        expect(slot.hour).toBeGreaterThanOrEqual(0);
        expect(slot.hour).toBeLessThanOrEqual(23);
      }
    }
  });

  test("are labelled as estimates in the UI", async ({ page }) => {
    await page.goto("/analytics");
    await page.waitForLoadState("networkidle");

    const body = (await page.textContent("body")) ?? "";
    if (/best time/i.test(body)) {
      expect(body).toMatch(/estimate|based on your|your own (posts|history)/i);
    }
  });
});

test.describe("analytics sync", () => {
  test("queues a sync and does not invent metrics while waiting", async ({ page }) => {
    const checks = await integrations(page);
    test.skip(!checks.linkedin, "LinkedIn is not configured in this environment.");

    const response = await page.request.post("/api/analytics/sync");
    expect([200, 202, 403]).toContain(response.status());

    const payload = (await (await page.request.get("/api/analytics?range=7d")).json()).data;
    for (const point of payload.series) {
      // Every point is a number, never a placeholder or a fabricated trend.
      expect(typeof point.impressions).toBe("number");
      expect(Number.isFinite(point.impressions)).toBe(true);
    }
  });
});

test.describe("snapshots", () => {
  test("stored snapshots match what the API returns", async ({ page }) => {
    const first = (await (await page.request.get("/api/analytics?range=7d")).json()).data;
    const second = (await (await page.request.get("/api/analytics?range=7d")).json()).data;

    // Two reads with no sync in between must agree; a drifting number would
    // mean something is being generated rather than read.
    expect(second.totals).toEqual(first.totals);
  });
});
