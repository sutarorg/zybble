import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { chromium as playwright } from "playwright-core";
import chromium from "@sparticuz/chromium";
const require = createRequire(import.meta.url);
const base = "http://localhost:3000";
const out = "shots";
fs.mkdirSync(out, { recursive: true });
const packageRoot = path.resolve(path.dirname(require.resolve("@sparticuz/chromium")), "..");
const libs = path.join(os.tmpdir(), "zybble-browser-libs");
if (process.platform === "linux") {
  fs.mkdirSync(libs, { recursive: true });
  const archive = path.join(libs, "al2023.tar");
  fs.writeFileSync(archive, zlib.brotliDecompressSync(fs.readFileSync(path.join(packageRoot, "bin/al2023.tar.br"))));
  execFileSync("tar", ["xf", archive, "-C", libs]);
  process.env.LD_LIBRARY_PATH = `${path.join(libs, "lib")}:${process.env.LD_LIBRARY_PATH ?? ""}`;
}
const browser = await playwright.launch({ executablePath: await chromium.executablePath(), args: chromium.args.filter((a) => a !== "--single-process"), headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
const settle = (ms = 900) => page.waitForTimeout(ms);
const shot = async (name, wait = 900) => {
  await settle(wait);
  try {
    await page.screenshot({ path: `${out}/${name}.png`, timeout: 20000, caret: "hide" });
    console.log("shot:", name, "|", page.url());
  } catch (error) {
    console.log("SHOT FAIL:", name, String(error).split("\n")[0]);
  }
};

/* ------------------------------- 1. learner ------------------------------- */
await page.goto(`${base}/login`);
await page.getByLabel("Email", { exact: true }).fill("jordan@zybble.example");
await page.getByLabel("Password", { exact: true }).fill("LearnToTeach!2026");
await page.getByRole("button", { name: "Sign in", exact: true }).click();
await page.waitForURL(`${base}/`);
await page.getByRole("button", { name: "Account menu", exact: true }).click();
await shot("02-explore-menu");
await page.keyboard.press("Escape");

/* learner settings via the avatar menu (client-side nav keeps the session) */
await page.getByRole("button", { name: "Account menu", exact: true }).click();
await page.getByRole("menuitem", { name: "Settings", exact: true }).click();
await page.waitForURL("**/settings");
await shot("03-learner-settings", 1400);

/* learner header dropdown (no My Learning / Wishlist) */
await page.locator('header button[aria-label="Account menu"]').click();
await shot("05-learner-menu", 500);
await page.keyboard.press("Escape");

/* dashboard */
await page.getByRole("link", { name: "Overview", exact: true }).click();
await page.waitForURL("**/dashboard");
await shot("04-learner-dashboard", 1600);

/* enroll in the free course through the real flow */
await page.getByRole("link", { name: "Back to Explore", exact: true }).first().click();
await page.waitForURL(`${base}/`);
await page.getByRole("link", { name: /Prompt Engineering Foundations/ }).first().click();
await page.waitForURL("**/courses/prompt-engineering-foundations");
await shot("20-course-detail", 1200);
await page.getByRole("button", { name: "Enroll for free", exact: true }).click();
await page.waitForURL("**/checkout/**");
await page.getByRole("button", { name: "Complete free enrollment", exact: true }).click();
await page.waitForURL("**/checkout/success**");
await page.getByRole("link", { name: "Start learning", exact: true }).click();
await page.waitForURL("**/my-learning");
await shot("21-my-learning", 1400);

/* open the player from the dashboard "Continue learning" card */
await page.getByRole("link", { name: "Overview", exact: true }).click();
await page.waitForURL("**/dashboard");
await page.getByRole("link", { name: /Resume lesson|Start learning|Review course/ }).first().click();
await page.waitForURL("**/learn/**");
await shot("22-player-open", 1800);
/* switching modules: open one, then another — only one stays open */
const headers = page.locator("aside button[aria-expanded]");
console.log("module headers:", await headers.count());
await headers.nth(1).click();
await shot("23-player-module2", 1500);
await headers.nth(2).click();
await shot("24-player-module3", 1500);

/* complete every lesson from the main column to unlock the certificate */
for (let i = 0; i < 14; i++) {
  const mark = page.getByRole("main").getByRole("button", { name: "Mark as complete", exact: true });
  if (await mark.count()) { await mark.click(); await settle(400); }
  const dialog = page.getByRole("dialog");
  if (await dialog.count()) break;
  const next = page.getByRole("main").getByRole("button", { name: "Next lesson", exact: true });
  if (await next.count()) { await next.click(); await settle(600); } else break;
}
await settle(1200);
await shot("25-certificate-dialog", 2400);
await page.keyboard.press("Escape");
await settle(800);
await shot("26-review-panel", 1200);

/* certificates page */
await page.getByRole("link", { name: "Certificates", exact: true }).click();
await page.waitForURL("**/certificates");
await shot("27-certificates-page", 1800);

/* ------------------------------- 2. creator ------------------------------- */
await page.locator("aside").getByRole("link", { name: /Start teaching|Go to Studio/ }).first().click();
await page.waitForURL("**/creator/signup");
await page.getByLabel("Headline", { exact: true }).fill("AI workflow educator");
await page.getByRole("button", { name: "AI Automation", exact: true }).click();
await page.getByRole("button", { name: "Continue", exact: true }).click();
await page.getByRole("checkbox").check();
await page.getByRole("button", { name: "Create creator account", exact: true }).click();
await page.waitForURL("**/creator");
await shot("30-creator-dashboard", 1500);

await page.getByRole("button", { name: "Creator account menu" }).click();
await shot("31-creator-dropdown", 600);
await page.keyboard.press("Escape");

await page.getByRole("link", { name: "Profile", exact: true }).click();
await page.waitForURL("**/creator/profile");
await shot("32-creator-profile", 1200);
await page.getByLabel("Country").click();
await page.getByLabel("Search countries").fill("por");
await shot("33-country-search", 600);
await page.getByRole("option", { name: /Portugal/ }).click();
await shot("34-country-picked", 700);

/* wizard: content step with the starter section */
await page.getByRole("link", { name: "Create Course", exact: true }).first().click();
await page.waitForURL("**/creator/courses/new");
await shot("35-wizard-step1", 1400);
await browser.close();
console.log("done");
