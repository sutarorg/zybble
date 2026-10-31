import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright end-to-end configuration.
 *
 * Design notes:
 *
 *  * Tests run against `next build && next start`, not `next dev`. Dev mode
 *    compiles on demand and renders differently (extra error overlays, no
 *    prerendered HTML), which makes E2E results unrepresentative.
 *  * `reuseExistingServer` keeps local iteration fast; CI always starts fresh.
 *  * Three projects: desktop Chromium, mobile Chromium (viewport + touch) and
 *    tablet. Firefox/WebKit are deliberately not in the default matrix — they
 *    add minutes to every CI run for very little signal on an app whose
 *    rendering comes from Chromium-tested CSS. Add them when a
 *    browser-specific bug appears.
 *
 * Environment:
 *
 *  * Tests that need a real backend (auth, LinkedIn, billing) read
 *    `E2E_REAL_BACKEND=1`. Without it they skip rather than fail, so the suite
 *    is honest about what it proved: a green run with no backend configured
 *    proves the public surface only.
 */

const port = Number(process.env.PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./.playwright/test-results",

  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 45_000,
  expect: { timeout: 10_000 },

  reporter: process.env.CI
    ? [["github"], ["html", { open: "never", outputFolder: ".playwright/report" }]]
    : [["list"], ["html", { open: "never", outputFolder: ".playwright/report" }]],

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Never let a test leave cookies behind for the next one.
    contextOptions: { reducedMotion: "reduce" },
  },

  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "tablet",
      // Galaxy Tab S4 is one of the few tablet descriptors that runs on
      // Chromium. The iPad descriptors default to WebKit, which CI does not
      // install — using one here made every tablet test fail with "browser not
      // found" rather than testing anything.
      use: { ...devices["Galaxy Tab S4"] },
    },
  ],

  webServer: {
    command: "npm run build && npm run start -- --hostname 127.0.0.1 --port " + port,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
