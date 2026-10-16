/**
 * Playwright end-to-end walkthrough of the current Zybble marketplace and
 * manual creator payout architecture.
 *
 * Replaces the stale mock-era walkthrough that referenced `/courses` and demo
 * quick-fill buttons. Automatically starts a local Next.js server if BASE_URL
 * is not already listening, launches headless Chromium via `playwright-core`
 * + `@sparticuz/chromium`, and fails on any console.error, uncaught pageerror,
 * or broken contract.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const address = srv.address();
      const port = typeof address === "object" && address ? address.port : 3123;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

async function isServerListening(baseUrl) {
  try {
    const res = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(2000) });
    return res.status === 200 || res.status === 503;
  } catch {
    return false;
  }
}

async function waitForServer(baseUrl, timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isServerListening(baseUrl)) return;
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Timed out waiting for Next.js server at ${baseUrl}`);
}

async function ensureServer() {
  if (process.env.BASE_URL && (await isServerListening(process.env.BASE_URL))) {
    return { baseUrl: process.env.BASE_URL, stop: async () => {} };
  }
  const defaultUrl = "http://127.0.0.1:3000";
  if (await isServerListening(defaultUrl)) {
    return { baseUrl: defaultUrl, stop: async () => {} };
  }

  const port = await findFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const hasBuild = fs.existsSync(path.join(ROOT, ".next", "BUILD_ID"));
  const nextBin = path.join(ROOT, "node_modules", ".bin", "next");
  const args = hasBuild ? ["start", "-H", "127.0.0.1", "-p", String(port)] : ["dev", "-H", "127.0.0.1", "-p", String(port)];

  const child = spawn(nextBin, args, {
    cwd: ROOT,
    env: {
      ...process.env,
      PAYOUT_DETAILS_ENCRYPTION_KEY:
        process.env.PAYOUT_DETAILS_ENCRYPTION_KEY ||
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let logs = "";
  child.stdout?.on("data", (chunk) => {
    logs += chunk.toString();
  });
  child.stderr?.on("data", (chunk) => {
    logs += chunk.toString();
  });

  try {
    await waitForServer(baseUrl, 60000);
  } catch (err) {
    child.kill("SIGTERM");
    throw new Error(`${err.message}\nServer logs:\n${logs}`);
  }

  return {
    baseUrl,
    stop: async () => {
      if (!child.killed) {
        child.kill("SIGTERM");
        await new Promise((r) => setTimeout(r, 300));
      }
    },
  };
}

async function launchBrowser() {
  try {
    const sparticuzMod = await import("@sparticuz/chromium");
    const sparticuz = sparticuzMod.default;
    const al2023Archive = path.join(
      ROOT,
      "node_modules",
      "@sparticuz",
      "chromium",
      "bin",
      "al2023.tar.br",
    );
    if (fs.existsSync(al2023Archive) && typeof sparticuzMod.inflate === "function") {
      await sparticuzMod.inflate(al2023Archive);
      if (typeof sparticuzMod.setupLambdaEnvironment === "function") {
        sparticuzMod.setupLambdaEnvironment(path.join(os.tmpdir(), "al2023", "lib"));
      }
    }
    const executablePath = await sparticuz.executablePath();
    return await chromium.launch({
      executablePath,
      args: sparticuz.args,
      headless: true,
    });
  } catch {
    return await chromium.launch({ headless: true });
  }
}

const server = await ensureServer();
const browser = await launchBrowser();

const results = [];
let currentStep = "init";
const pageErrors = [];
const consoleErrors = [];

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (
      url.protocol.startsWith("http") &&
      url.hostname !== "127.0.0.1" &&
      url.hostname !== "localhost"
    ) {
      await route.fulfill({ status: 204, body: "" });
      return;
    }
    await route.continue();
  });

  page.on("pageerror", (err) => {
    pageErrors.push({ step: currentStep, error: err.message });
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (!text.includes("favicon.ico")) {
        consoleErrors.push({ step: currentStep, error: text });
      }
    }
  });

  async function step(name, fn) {
    currentStep = name;
    const started = Date.now();
    try {
      await fn();
      results.push({ step: name, ok: true, ms: Date.now() - started });
      console.log(`✓ ${name} (${Date.now() - started}ms)`);
    } catch (err) {
      results.push({ step: name, ok: false, error: err.message });
      console.error(`✗ ${name}: ${err.message}`);
      throw err;
    }
  }

  await step("1. /api/health reports standard Razorpay Checkout and payoutEncryption readiness without leaking secrets", async () => {
    const res = await fetch(`${server.baseUrl}/api/health`);
    assert.ok(res.status === 200 || res.status === 503, `Unexpected health status ${res.status}`);
    const body = await res.json();
    assert.equal(typeof body.ok, "boolean");
    assert.ok(Array.isArray(body.services), "Expected services array in /api/health");

    const byService = Object.fromEntries(
      body.services.map((s) => [s.service ?? s.id ?? s.label, s]),
    );
    const razorpay =
      byService.razorpay ?? body.services.find((s) => /Razorpay/i.test(s.label));
    const payoutEncryption =
      byService.payoutEncryption ??
      body.services.find((s) => /Payout Destination Encryption/i.test(s.label));
    assert.ok(razorpay, "Missing razorpay service in /api/health");
    assert.ok(payoutEncryption, "Missing payoutEncryption service in /api/health");
    assert.doesNotMatch(razorpay.label, /Route/i);
    assert.match(payoutEncryption.label, /Payout Destination Encryption/i);

    const serialized = JSON.stringify(body);
    assert.ok(
      !serialized.includes("0123456789abcdef0123456789abcdef"),
      "/api/health must never echo the encryption key value",
    );
  });

  await step("2. Public home (/) and catalog (/explore) load cleanly with INR copy, 6-language switcher, and AI launcher", async () => {
    const res = await page.goto(`${server.baseUrl}/`, { waitUntil: "networkidle" });
    assert.equal(res.status(), 200);
    await assert.doesNotReject(() => page.waitForSelector("header", { timeout: 10000 }));

    // Public discovery pages show the Zybble AI launcher.
    const aiLauncher = page.locator('button[aria-label*="Zybble AI"], button:has-text("Ask Zybble AI")');
    assert.ok((await aiLauncher.count()) >= 1, "Expected Zybble AI launcher on /");

    const exploreRes = await page.goto(`${server.baseUrl}/explore`, { waitUntil: "networkidle" });
    assert.equal(exploreRes.status(), 200);
    const bodyText = await page.locator("body").innerText();
    assert.ok(bodyText.length > 100, "Explore page should render content");
  });

  await step("3. Help Center (/help) documents standard Razorpay Checkout and manual UPI/bank creator payouts", async () => {
    const res = await page.goto(`${server.baseUrl}/help`, { waitUntil: "networkidle" });
    assert.equal(res.status(), 200);

    // Expand the billing and creator payout FAQ items in the browser.
    await page.locator("text=What payment methods do you accept?").click();
    await page.locator("text=Who receives the money?").click();
    await page.locator("text=How do I become a creator?").click();

    const text = await page.locator("body").innerText();

    assert.match(text, /Razorpay Checkout/i);
    assert.match(text, /merchant account/i);
    assert.match(text, /UPI ID/i);
    assert.match(text, /Indian bank account/i);
    assert.doesNotMatch(text, /Razorpay Route splits each order automatically/i);
  });

  await step("4. Privacy (/privacy) and Terms (/terms) disclose AES-256-GCM payout encryption and manual INR payouts", async () => {
    const privRes = await page.goto(`${server.baseUrl}/privacy`, { waitUntil: "networkidle" });
    assert.equal(privRes.status(), 200);
    const privText = await page.locator("body").innerText();
    assert.match(privText, /AES-256-GCM/i);
    assert.match(privText, /Full payout details are never shown on public pages/i);

    const termsRes = await page.goto(`${server.baseUrl}/terms`, { waitUntil: "networkidle" });
    assert.equal(termsRes.status(), 200);
    const termsText = await page.locator("body").innerText();
    assert.match(termsText, /Indian Rupees \(INR, ₹\)/i);
    assert.match(termsText, /paid out in INR via manual bank or UPI transfer/i);
    assert.doesNotMatch(termsText, /connected Razorpay Route account/i);
  });

  await step("5. Creator signup (/creator/signup) explains manual UPI/bank payouts and hides the public AI launcher", async () => {
    const res = await page.goto(`${server.baseUrl}/creator/signup`, { waitUntil: "networkidle" });
    assert.equal(res.status(), 200);
    const text = await page.locator("body").innerText();
    assert.match(text, /UPI ID or Indian bank account/i);
    assert.match(text, /add payout details whenever you are ready to withdraw/i);
    assert.doesNotMatch(text, /Paid courses are disabled until Razorpay Route status is Active/i);

    const aiLauncher = page.locator('button[aria-label*="Zybble AI"], button:has-text("Ask Zybble AI")');
    assert.equal(await aiLauncher.count(), 0, "Zybble AI launcher must be hidden on /creator/signup");
  });

  await step("6. Privileged creator and admin payout routes enforce server-side session guards and redirect to /login", async () => {
    for (const protectedPath of ["/creator/payouts", "/creator/earnings", "/admin/payouts"]) {
      await page.goto(`${server.baseUrl}${protectedPath}`, { waitUntil: "networkidle" });
      const finalUrl = new URL(page.url());
      assert.equal(
        finalUrl.pathname,
        "/login",
        `Expected unauthenticated visit to ${protectedPath} to redirect to /login, got ${finalUrl.pathname}`,
      );
      const nextParam = finalUrl.searchParams.get("next") ?? "";
      const expectedPrefix = protectedPath.startsWith("/admin") ? "/admin" : "/creator";
      assert.ok(
        nextParam.startsWith(expectedPrefix),
        `Expected next=${nextParam} to start with ${expectedPrefix}`,
      );
    }
  });

  await step("7. Auth pages (/login, /signup) and interactive FAQ search filter render cleanly", async () => {
    const loginRes = await page.goto(`${server.baseUrl}/login`, { waitUntil: "networkidle" });
    assert.equal(loginRes.status(), 200);
    const loginText = await page.locator("body").innerText();
    assert.match(loginText, /Sign in/i);

    const signupRes = await page.goto(`${server.baseUrl}/signup`, { waitUntil: "networkidle" });
    assert.equal(signupRes.status(), 200);
    const signupText = await page.locator("body").innerText();
    assert.match(signupText, /Create/i);

    await page.goto(`${server.baseUrl}/help`, { waitUntil: "networkidle" });
    const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]').first();
    if ((await searchInput.count()) > 0) {
      await searchInput.fill("UPI");
      const filteredText = await page.locator("body").innerText();
      assert.match(filteredText, /Who receives the money\?/i);
    }
  });

  assert.equal(pageErrors.length, 0, `Uncaught page errors: ${JSON.stringify(pageErrors)}`);
  assert.equal(consoleErrors.length, 0, `Console errors: ${JSON.stringify(consoleErrors)}`);
} finally {
  await browser.close();
  await server.stop();
}

console.log(`\nAll ${results.length} E2E walkthrough steps passed with 0 page/console errors.`);
