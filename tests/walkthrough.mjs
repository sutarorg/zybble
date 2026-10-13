import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import zlib from "node:zlib";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { chromium as playwright } from "playwright-core";
import chromium from "@sparticuz/chromium";

const require = createRequire(import.meta.url);
const base = process.env.E2E_URL ?? "http://localhost:3000";
let browser;
const errors = [];

before(async () => {
  // The npm-packaged browser works without fetching binaries from a CDN.
  // Minimal Linux runners also need the bundled NSS libraries.
  const packageRoot = path.resolve(path.dirname(require.resolve("@sparticuz/chromium")), "..");
  const libs = path.join(os.tmpdir(), "zybble-browser-libs");
  if (process.platform === "linux") {
    fs.mkdirSync(libs, { recursive: true });
    const archive = path.join(libs, "al2023.tar");
    fs.writeFileSync(archive, zlib.brotliDecompressSync(fs.readFileSync(path.join(packageRoot, "bin/al2023.tar.br"))));
    execFileSync("tar", ["xf", archive, "-C", libs]);
    process.env.LD_LIBRARY_PATH = `${path.join(libs, "lib")}:${process.env.LD_LIBRARY_PATH ?? ""}`;
  }
  browser = await playwright.launch({ executablePath: await chromium.executablePath(), args: chromium.args.filter((arg) => arg !== "--single-process"), headless: true });
});
after(async () => { await browser?.close(); assert.deepEqual(errors, [], "No browser runtime errors"); });

async function pageFor(viewport = { width: 1440, height: 1000 }) {
  const page = await browser.newPage({ viewport });
  page.on("pageerror", (error) => errors.push(error.message));
  return page;
}
async function login(page) {
  await page.goto(`${base}/login`);
  await page.getByLabel("Email", { exact: true }).fill("jordan@zybble.example");
  await page.getByLabel("Password", { exact: true }).fill("LearnToTeach!2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(`${base}/`);
  await page.getByRole("link", { name: /Start teaching/ }).waitFor();
}
async function upgrade(page) {
  await page.getByRole("link", { name: /Start teaching/ }).click();
  await page.waitForURL("**/creator/signup");
  assert.equal(await page.locator('aside a[href="/creator"]').count(), 0, "No studio sidebar on signup");
  await page.getByLabel("Headline", { exact: true }).fill("AI workflow educator");
  await page.getByRole("button", { name: "AI Automation", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create creator account", exact: true }).click();
  await page.waitForURL("**/creator");
  await page.getByText("No courses yet", { exact: true }).waitFor();
}

test("invalid credentials are rejected and no account shortcut is exposed", async () => {
  const page = await pageFor();
  await page.goto(`${base}/login`);
  assert.doesNotMatch(await page.locator("body").innerText(), /demo/i);
  await page.getByLabel("Email", { exact: true }).fill("alex@zybble.demo");
  await page.getByLabel("Password", { exact: true }).fill("demo12345");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByText("Incorrect email or password. Please try again.", { exact: true }).waitFor();
  assert.match(page.url(), /\/login$/);
  await page.close();
});

test("learner upgrades in-place, deletion preserves wishlist, refreshing resets everything", async () => {
  const page = await pageFor();
  await page.goto(`${base}/`);
  await page.evaluate(() => {
    localStorage.setItem("zybble.user.v1", JSON.stringify({ id: "old", name: "Alex", role: "creator" }));
    localStorage.setItem("zybble.creator.courses.v1", "[{\"id\":\"old-draft\"}]");
  });
  await page.reload();
  await page.getByRole("link", { name: "Sign in", exact: true }).waitFor();
  assert.equal(await page.locator('aside a').filter({ hasText: "Back to Explore" }).count(), 0);
  await login(page);
  await page.getByRole("button", { name: "Save to wishlist", exact: true }).first().click();
  await upgrade(page);
  assert.equal(await page.locator('aside a').filter({ hasText: "Go to Studio" }).count(), 0);
  await page.getByRole("link", { name: "Back to Explore", exact: true }).click();
  await page.getByRole("link", { name: /Go to Studio/ }).waitFor();
  assert.match(await page.locator("aside").innerText(), /Jordan Ellis/);
  await page.getByRole("link", { name: /Go to Studio/ }).click();
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Delete Creator Account", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
  assert.match(page.url(), /creator\/settings$/);
  await page.getByRole("button", { name: "Delete Creator Account", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete creator account", exact: true }).click();
  await page.waitForURL(`${base}/`);
  await page.getByRole("link", { name: /Start teaching/ }).waitFor();
  await page.getByRole("button", { name: "Account menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "Wishlist", exact: true }).click();
  await page.getByRole("button", { name: "Remove from wishlist", exact: true }).waitFor();
  await page.getByRole("link", { name: "Back to Explore", exact: true }).click();
  await upgrade(page);
  await page.reload();
  await page.waitForURL("**/login");
  await login(page);
  assert.equal(await page.getByRole("link", { name: /Go to Studio/ }).count(), 0);
  assert.equal(await page.getByRole("button", { name: "Remove from wishlist", exact: true }).count(), 0);
  assert.deepEqual(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("zybble.") && k !== "zybble.language.v1")), []);
  await page.close();
});

test("all six language choices change catalog titles, subtitles and controls", async () => {
  const page = await pageFor();
  await page.goto(`${base}/`);
  for (const [native, title, lessons] of [
    ["Español", "Masterclass completa de ChatGPT", "16 lecciones"],
    ["Português", "Masterclass completa de ChatGPT", "16 aulas"],
    ["Français", "Masterclass complète de ChatGPT", "16 leçons"],
    ["Deutsch", "Die komplette ChatGPT-Masterclass", "16 Lektionen"],
    ["日本語", "ChatGPT完全マスタークラス", "16レッスン"],
    ["English", "Complete ChatGPT Masterclass", "16 lessons"],
  ]) {
    await page.locator('header button[aria-label^="Language:"]').click();
    await page.getByRole("menuitem").filter({ hasText: native }).click();
    await page.locator("article").first().getByRole("heading", { name: title, exact: true }).waitFor();
    assert.match(await page.locator("article").first().innerText(), new RegExp(lessons));
  }
  await page.close();
});

test("creator signup is usable at narrow mobile widths and gates guests", async () => {
  const page = await pageFor({ width: 320, height: 740 });
  await page.goto(`${base}/creator/signup`);
  await page.getByRole("link", { name: "Sign in", exact: true }).waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "No horizontal overflow");
  assert.equal(await page.locator('aside a[href="/creator"]').count(), 0);
  await page.close();
});
