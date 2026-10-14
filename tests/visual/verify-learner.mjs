import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import zlib from "node:zlib";
import { execFileSync } from "node:child_process"; import { createRequire } from "node:module";
import { chromium as playwright } from "playwright-core"; import chromium from "@sparticuz/chromium";
const require = createRequire(import.meta.url);
const base = "http://localhost:3000";
const libs = path.join(os.tmpdir(), "zybble-browser-libs");
const packageRoot = path.resolve(path.dirname(require.resolve("@sparticuz/chromium")), "..");
if (process.platform === "linux") { fs.mkdirSync(libs, { recursive: true });
  const archive = path.join(libs, "al2023.tar");
  fs.writeFileSync(archive, zlib.brotliDecompressSync(fs.readFileSync(path.join(packageRoot, "bin/al2023.tar.br"))));
  execFileSync("tar", ["xf", archive, "-C", libs]);
  process.env.LD_LIBRARY_PATH = `${path.join(libs, "lib")}:${process.env.LD_LIBRARY_PATH ?? ""}`; }
const browser = await playwright.launch({ executablePath: await chromium.executablePath(), args: chromium.args.filter((a) => a !== "--single-process"), headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const settle = (ms = 700) => page.waitForTimeout(ms);

await page.goto(`${base}/login`);
await page.getByLabel("Email", { exact: true }).fill("jordan@zybble.example");
await page.getByLabel("Password", { exact: true }).fill("LearnToTeach!2026");
await page.getByRole("button", { name: "Sign in", exact: true }).click();
await page.waitForURL(`${base}/`);
await settle(1200);

/* ---- sidebar + explore menu ---- */
const aside = await page.locator("aside").innerText();
assert.ok(aside.includes("Start teaching") || aside.includes("Go to Studio"), "teaching card present");
assert.ok(!aside.includes("Jordan Ellis"), "account card removed from sidebar");
assert.ok(!/Account/.test(aside), "no account label in sidebar");
await page.getByRole("button", { name: "Account menu", exact: true }).click();
let menu = await page.getByRole("menu").innerText();
assert.ok(!menu.includes("Explore"), "Explore hidden on the Explore page");
assert.ok(menu.includes("Settings"), "Settings in menu");
await page.keyboard.press("Escape");

/* ---- learner workspace ---- */
await page.getByRole("link", { name: "My Learning", exact: true }).first().click();
await page.waitForURL("**/my-learning");
const learnerAside = await page.locator("aside").innerText();
assert.ok(!learnerAside.includes("Jordan Ellis"), "no credentials card in the learner sidebar");
assert.ok(learnerAside.includes("Settings"), "Settings nav item present");
assert.ok(learnerAside.includes("Back to Explore"), "back to explore retained");
await page.locator('header button[aria-label="Account menu"]').click();
menu = await page.getByRole("menu").innerText();
assert.ok(!menu.includes("My Learning"), "My Learning removed from learner menu");
assert.ok(!menu.includes("Wishlist"), "Wishlist removed from learner menu");
assert.ok(menu.includes("Settings"), "Settings added below for learner");
await page.keyboard.press("Escape");

/* ---- enroll in the free course ---- */
await page.getByRole("link", { name: "Back to Explore", exact: true }).first().click();
await page.waitForURL(`${base}/`);
await page.getByRole("link", { name: /Prompt Engineering Foundations/ }).first().click();
await page.waitForURL("**/courses/prompt-engineering-foundations");
await page.getByRole("button", { name: "Enroll for free", exact: true }).click();
await page.waitForURL("**/checkout/**");
await page.getByRole("button", { name: "Complete free enrollment", exact: true }).click();
await page.waitForURL("**/checkout/success**");
await page.getByRole("link", { name: "Start learning", exact: true }).click();
await page.waitForURL("**/my-learning");
await page.getByRole("link", { name: "Overview", exact: true }).click();
await page.waitForURL("**/dashboard");
await page.getByRole("link", { name: /Resume lesson|Start learning|Review course/ }).first().click();
await page.waitForURL("**/learn/**");
await settle(1200);

/* ---- module accordion: only one open ---- */
const headers = page.locator("aside button[aria-expanded]");
const openCount = async () => (await headers.evaluateAll((els) => els.filter((e) => e.getAttribute("aria-expanded") === "true").length));
assert.equal(await openCount(), 1, "exactly one module open on load");
await headers.nth(2).click();
await settle(700);
assert.equal(await openCount(), 1, "one module open after switching");
assert.equal(await headers.nth(2).getAttribute("aria-expanded"), "true", "clicked module is the open one");
/* switching lesson via Previous/Next re-opens the owning module only */
const nextBtn = page.getByRole("main").getByRole("button", { name: "Next lesson", exact: true });
await nextBtn.click();
await settle(700);
assert.equal(await openCount(), 1, "one module open after Next lesson");
const prevBtn = page.getByRole("main").getByRole("button", { name: "Previous", exact: true });
await prevBtn.click();
await settle(700);
assert.equal(await openCount(), 1, "one module open after Previous");

/* ---- complete the course: certificate + review unlock ---- */
for (let i = 0; i < 16; i++) {
  const mark = page.getByRole("main").getByRole("button", { name: "Mark as complete", exact: true });
  if (await mark.count()) { await mark.click(); await settle(320); }
  if (await page.getByRole("dialog").count()) break;
  const next = page.getByRole("main").getByRole("button", { name: "Next lesson", exact: true });
  if (await next.count()) { await next.click(); await settle(450); } else break;
}
await settle(900);
const dialogText = await page.getByRole("dialog").innerText().catch(() => "");
assert.ok(/Course completed/i.test(dialogText), "certificate dialog shown on completion");
const canvasOk = await page.evaluate(async () => {
  const c = document.querySelector('div[role="dialog"] canvas');
  return Boolean(c && c.width === 1920 && c.toDataURL("image/png").length > 5000);
});
assert.ok(canvasOk, "certificate canvas painted");
await page.keyboard.press("Escape");
await settle(900);
const body = await page.locator("main").innerText();
assert.ok(/rate it/i.test(body), "review panel unlocked after completion");
/* publish a review */
await page.getByRole("button", { name: "Write a review", exact: true }).click();
await settle(500);
await page.getByRole("radio", { name: "5 stars" }).click();
await page.locator("#rv-title").fill("Best two hours of prompting practice");
await page.locator("#rv-text").fill("Clear patterns, great exercises, and the debugging lesson alone was worth it. I use the notebook template daily now.");
await page.getByRole("button", { name: "Publish review", exact: true }).click();
await settle(1200);
const after = await page.locator("main").innerText();
assert.ok(after.includes("Best two hours of prompting practice"), "review shows on the player");
/* it appears on the public course page too (client-side navigation only —
   a hard reload intentionally resets this demo session) */
await page.getByRole("link", { name: /My Learning/ }).first().click();
await page.waitForURL("**/my-learning");
await page.getByRole("link", { name: "Overview", exact: true }).click();
await page.waitForURL("**/dashboard");
await page.getByRole("link", { name: "Course details", exact: true }).first().click();
await page.waitForURL("**/courses/**");
await settle(1400);
const coursePage = await page.locator("main").innerText();
assert.ok(coursePage.includes("Best two hours of prompting practice"), "review published to the course page");
assert.ok(coursePage.includes("Your review"), "review labelled as the learner's own");

/* ---- certificate list renders the canvas ---- */
await page.locator("aside").getByRole("link", { name: "My Learning" }).first().click();
await page.waitForURL("**/my-learning");
await page.getByRole("link", { name: /Certificates/ }).first().click();
await page.waitForURL("**/certificates");
await settle(1600);
assert.ok(await page.locator("canvas").first().isVisible(), "certificate canvas visible on /certificates");

assert.deepEqual(errors, [], "no runtime errors");
await browser.close();
console.log("ALL LEARNER CHECKS PASSED");
