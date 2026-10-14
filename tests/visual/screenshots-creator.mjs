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
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
const settle = (ms = 800) => page.waitForTimeout(ms);
const shot = async (name, wait = 900) => {
  await settle(wait);
  try { await page.screenshot({ path: `shots/${name}.png`, timeout: 20000 }); console.log("shot:", name, "|", page.url()); }
  catch (e) { console.log("SHOT FAIL:", name, String(e).split("\n")[0]); }
};

// sign in
await page.goto(`${base}/login`);
await page.getByLabel("Email", { exact: true }).fill("jordan@zybble.example");
await page.getByLabel("Password", { exact: true }).fill("LearnToTeach!2026");
await page.getByRole("button", { name: "Sign in", exact: true }).click();
await page.waitForURL(`${base}/`);

// creator signup
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

// creator profile
await page.getByRole("link", { name: "Profile", exact: true }).click();
await page.waitForURL("**/creator/profile");
await shot("32-creator-profile", 1200);
await page.getByLabel("Country").click();
await shot("33-country-open", 500);
await page.getByLabel("Search countries").fill("por");
await shot("34-country-search", 600);
await page.getByRole("option", { name: /Portugal/ }).click();
await shot("35-country-picked", 700);

// create course wizard
await page.getByRole("link", { name: "Create Course", exact: true }).first().click();
await page.waitForURL("**/creator/courses/new");
await shot("40-wizard-basics", 1400);
await page.locator("#f-title").fill("AI Agents for Product Teams");
await page.locator("#f-subtitle").fill("Ship a working agent workflow in two weekends, from spec to rollout.");
await page.locator("#f-description").fill("A practical, project-based course where product teams design, build and roll out their first AI agent workflow — including evaluation, guardrails and adoption planning for real teams.");
await page.locator("#f-title").locator("xpath=ancestor::div[contains(@class,'space-y-4')]").getByRole("combobox").first().click();
await page.getByRole("option", { name: "Generative AI", exact: true }).click();
await page.getByRole("button", { name: "Continue", exact: true }).click();
await settle(600);
await page.getByRole("button", { name: "Continue", exact: true }).click();  // outcomes invalid -> stays
await shot("41-wizard-outcomes-error", 700);
const outcomeInputs = page.locator("fieldset").first().locator("input");
await outcomeInputs.nth(0).fill("Design an agent workflow from a real user goal");
await outcomeInputs.nth(1).fill("Build tool-calling agents with evaluation harnesses");
await outcomeInputs.nth(2).fill("Roll out agents with guardrails and adoption metrics");
await shot("42-wizard-outcomes", 500);
// drag the third outcome above the second
const handles = page.locator("fieldset").first().locator('button[aria-label^="Drag to reorder"]');
await handles.nth(2).hover();
await page.mouse.down();
const target = page.locator("fieldset").first().locator("input").nth(1);
const box = await target.boundingBox();
await page.mouse.move(box.x + 10, box.y + 5, { steps: 12 });
await page.mouse.up();
await settle(600);
await shot("43-wizard-outcomes-dragged", 400);
console.log("outcome order:", await outcomeInputs.evaluateAll((els) => els.map((e) => e.value)));
await page.getByRole("button", { name: "Continue", exact: true }).click();
await settle(500);
await page.getByRole("button", { name: "Continue", exact: true }).click();  // thumbnail required
await page.locator('button[aria-pressed]').first().click();
await page.getByRole("button", { name: "Continue", exact: true }).click();
await settle(500);
await page.getByRole("button", { name: "Continue", exact: true }).click();  // pricing ok
await shot("44-wizard-content", 1200);
await browser.close();
console.log("done");
