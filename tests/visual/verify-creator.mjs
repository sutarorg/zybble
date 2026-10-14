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
await page.locator("aside").getByRole("link", { name: /Start teaching|Go to Studio/ }).first().click();
await page.waitForURL("**/creator/signup");
await page.getByLabel("Headline", { exact: true }).fill("AI workflow educator");
await page.getByRole("button", { name: "AI Automation", exact: true }).click();
await page.getByRole("button", { name: "Continue", exact: true }).click();
await page.getByRole("checkbox").check();
await page.getByRole("button", { name: "Create creator account", exact: true }).click();
await page.waitForURL("**/creator");
await settle(1000);

/* ---- creator dropdown: icons + public profile routing ---- */
await page.getByRole("button", { name: "Creator account menu" }).click();
const menu = page.getByRole("menu");
const menuText = await menu.innerText();
for (const label of ["Public profile", "Edit instructor profile", "Studio settings", "Back to learner experience", "Sign out"]) {
  assert.ok(menuText.includes(label), `creator menu has “${label}”`);
}
const icons = await menu.locator("svg").count();
assert.ok(icons >= 5, "every creator menu option carries an icon");
await page.getByRole("menuitem", { name: "Public profile" }).click();
await page.waitForURL("**/instructors/**");
assert.ok(page.url().includes("/instructors/"), "public profile lands on the public instructor page");
const profileText = await page.locator("main, body").first().innerText();
assert.ok(/Jordan Ellis/.test(profileText), "public instructor page shows the creator");
assert.ok(!/Trending topics/i.test(await page.locator("body").innerText()), "no trending topics section");

/* ---- creator profile: no topics, avatar upload, country combobox ---- */
await page.locator("aside").getByRole("link", { name: /Go to Studio|Start teaching/ }).first().click();
await page.waitForURL("**/creator");
await settle(900);
await page.getByRole("button", { name: "Creator account menu" }).click();
await page.getByRole("menuitem", { name: "Edit instructor profile" }).click();
await page.waitForURL("**/creator/profile");
await settle(1000);
const profileBody = await page.locator("main").innerText();
assert.ok(!/Trending topics/i.test(profileBody), "trending topics removed from the profile");
assert.ok(/Profile picture/.test(profileBody), "profile picture uploader present");
assert.ok(/Country/.test(profileBody), "country field present");
/* upload a profile picture by clicking the avatar */
fs.mkdirSync("shots/tmp", { recursive: true });
fs.writeFileSync("shots/tmp/me.png", Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==", "base64"));
await page.locator('input[type="file"][accept*="image/png"]').setInputFiles("shots/tmp/me.png");
await settle(1200);
assert.ok(await page.locator('.avatar img, [data-slot="avatar"] img, img[alt="Jordan Ellis"]').first().count(), "creator avatar image rendered");
/* country: search + pick */
await page.getByLabel("Country").click();
await page.getByLabel("Search countries").fill("swed");
await settle(400);
await page.getByRole("option", { name: /Sweden/ }).click();
await settle(500);
assert.ok((await page.getByLabel("Country").innerText()).includes("Sweden"), "country picked from the list");

/* ---- wizard: content step has the starter section, no Content step ---- */
await page.getByRole("link", { name: "Create Course", exact: true }).first().click();
await page.waitForURL("**/creator/courses/new");
await settle(800);
const steps = await page.locator("nav ol").first().innerText();
const contentSteps = steps.split("\n").filter((l) => l.trim() === "Content");
assert.equal(contentSteps.length, 1, "exactly one Content step (the renamed Curriculum step)");
assert.ok(!steps.includes("Curriculum"), "old Curriculum label gone");
/* walk the wizard until the Content step to confirm the default section */
const cont = () => page.getByRole("button", { name: "Continue", exact: true }).click();
await page.locator("#f-title").fill("AI Agents for Product Teams");
await page.locator("#f-subtitle").fill("Ship a working agent workflow in two weekends, from spec to rollout.");
await page.locator("#f-description").fill(
  "A practical, project-based course where product teams design, build and roll out their first AI agent workflow — including evaluation, guardrails and adoption planning for real teams.",
);
await page.locator("#f-title").locator("xpath=ancestor::div[contains(@class,'space-y-4')]").getByRole("combobox").first().click();
await page.getByRole("option", { name: "Generative AI", exact: true }).click();
await cont();
await settle(500);
const outcomeInputs = page.locator("fieldset").first().locator("input");
await outcomeInputs.nth(0).fill("Design an agent workflow from a real user goal");
await outcomeInputs.nth(1).fill("Build tool-calling agents with evaluation harnesses");
/* drag-reorder outcomes and confirm the order really changed */
await outcomeInputs.nth(2).fill("Roll out agents with guardrails and adoption metrics");
const handles = page.locator("fieldset").first().locator('button[aria-label^="Drag to reorder"]');
const before = await outcomeInputs.evaluateAll((els) => els.map((e) => e.value));
await handles.nth(2).hover();
await page.mouse.down();
const box = await page.locator("fieldset").first().locator("input").nth(1).boundingBox();
await page.mouse.move(box.x + 10, box.y + 5, { steps: 12 });
await page.mouse.up();
await settle(600);
const after = await outcomeInputs.evaluateAll((els) => els.map((e) => e.value));
assert.notDeepEqual(after, before, `outcome blocks reorder by drag (${before.join(" | ")} -> ${after.join(" | ")})`);
await cont();
await settle(500);
await cont(); /* thumbnail */
await page.locator("button[aria-pressed]").first().click();
await cont();
await settle(500);
await cont(); /* pricing -> content */
await settle(1000);
const contentText = await page.locator("main").innerText();
assert.ok(contentText.includes("Getting Started"), "default “Getting Started” section present");
assert.ok(!/Downloadable resource|Reading/.test(contentText), "removed lesson types are gone");
assert.deepEqual(errors, [], "no runtime errors");
await browser.close();
console.log("ALL CREATOR CHECKS PASSED");
