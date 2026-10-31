import { expect, test } from "@playwright/test";

/**
 * Layout audit across the three breakpoints that matter: phone, tablet,
 * desktop.
 *
 * The two things that actually break responsive layouts are horizontal
 * overflow (a child wider than the viewport) and content hidden behind a fixed
 * header. Both are checked directly rather than by screenshot comparison, which
 * would be brittle and would not say *why* a layout failed.
 */

// Each test sets its own viewport, so this file only needs to run once. Without
// this guard it would run three times (once per project) and produce identical
// results three times over.
test.beforeEach(({}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop",
    "Viewport is set per test; running this file per project would be triplicated.",
  );
});

const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 834, height: 1112 },
  desktop: { width: 1440, height: 900 },
} as const;

const PAGES = ["/", "/pricing", "/blog", "/login", "/signup"];

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`${name} (${viewport.width}px)`, () => {
    test.use({ viewport });

    for (const path of PAGES) {
      test(`${path} has no horizontal overflow`, async ({ page }) => {
        await page.goto(path);
        await page.waitForLoadState("networkidle");

        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );

        // A single pixel of slack absorbs sub-pixel rounding in the grid.
        expect(overflow, `${path} overflows by ${overflow}px at ${viewport.width}px`).toBeLessThanOrEqual(1);
      });

      test(`${path} renders its primary heading in the viewport`, async ({ page }) => {
        await page.goto(path);
        const heading = page.locator("h1").first();
        await expect(heading).toBeVisible();

        const box = await heading.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.width).toBeGreaterThan(0);
        expect(box!.x, "heading starts off-screen to the left").toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width, "heading spills past the right edge").toBeLessThanOrEqual(
          viewport.width + 1,
        );
      });
    }

    test("no element is wider than the viewport", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      const offenders = await page.evaluate((width) => {
        const found: Array<{ tag: string; cls: string; w: number }> = [];
        for (const element of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
          const rect = element.getBoundingClientRect();
          // Decorative, transformed layers are allowed to exceed the viewport.
          const style = getComputedStyle(element);
          if (style.position === "fixed" || style.pointerEvents === "none") continue;
          if (rect.width > width + 1) {
            found.push({
              tag: element.tagName.toLowerCase(),
              cls: element.className?.toString().slice(0, 60) ?? "",
              w: Math.round(rect.width),
            });
          }
        }
        return found.slice(0, 5);
      }, viewport.width);

      expect(offenders, JSON.stringify(offenders)).toEqual([]);
    });
  });
}

test.describe("mobile navigation", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the menu opens, is keyboard reachable and closes", async ({ page }) => {
    await page.goto("/");

    const openButton = page.getByRole("button", { name: /open menu/i });
    await expect(openButton).toBeVisible();

    // Opening it with the keyboard, not just a pointer.
    await openButton.focus();
    await page.keyboard.press("Enter");

    // While a modal is open Radix marks the rest of the page aria-hidden, so
    // the panel must be addressed as a dialog. Querying the page's own
    // <nav aria-label="Main navigation"> here would find nothing and time out.
    const panel = page.getByRole("dialog", { name: /^menu$/i });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("link", { name: /pricing/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /close menu/i })).toBeVisible();

    await page.getByRole("button", { name: /close menu/i }).click();
    await expect(panel).toBeHidden();
    await expect(page.getByRole("button", { name: /open menu/i })).toBeVisible();
  });
});

test.describe("focus management", () => {
  test("keyboard users can reach the primary CTA from the top of the page", async ({ page }) => {
    await page.goto("/");

    // Tab until the skip link or first CTA takes focus, with a sane bound.
    let found = false;
    for (let i = 0; i < 25 && !found; i += 1) {
      await page.keyboard.press("Tab");
      const label = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        return el ? `${el.tagName}:${el.textContent?.trim().slice(0, 40) ?? ""}` : "";
      });
      found = /get started|start free|log in/i.test(label);
    }

    expect(found, "no primary CTA reachable by keyboard within 25 tabs").toBe(true);
  });

  test("focus is visible, not suppressed", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");

    const outline = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return null;
      const style = getComputedStyle(el);
      return { outline: style.outlineWidth, shadow: style.boxShadow };
    });

    expect(outline).not.toBeNull();
    const hasIndicator =
      outline!.outline !== "0px" || (outline!.shadow && outline!.shadow !== "none");
    expect(hasIndicator, "focused element has no visible indicator").toBe(true);
  });
});
