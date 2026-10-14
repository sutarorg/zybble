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
// tiny fake media files so the upload steps have something to chew on
fs.mkdirSync("shots/tmp", { recursive: true });
fs.writeFileSync("shots/tmp/lesson-1-intro.mp4", Buffer.alloc(3 * 1024 * 1024, 7));
fs.writeFileSync("shots/tmp/prompt-library.pdf", Buffer.alloc(240 * 1024, 3));
const browser = await playwright.launch({ executablePath: await chromium.executablePath(), args: chromium.args.filter((a) => a !== "--single-process"), headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
const settle = (ms = 800) => page.waitForTimeout(ms);
const shot = async (name, wait = 700) => {
  await settle(wait);
  try { await page.screenshot({ path: `shots/${name}.png`, timeout: 20000 }); console.log("shot:", name, "|", page.url()); }
  catch (e) { console.log("SHOT FAIL:", name, String(e).split("\n")[0]); }
};

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
await page.getByRole("link", { name: "Create Course", exact: true }).first().click();
await page.waitForURL("**/creator/courses/new");
await page.locator("#f-title").fill("AI Agents for Product Teams");
await page.locator("#f-subtitle").fill("Ship a working agent workflow in two weekends, from spec to rollout.");
await page.locator("#f-description").fill("A practical, project-based course where product teams design, build and roll out their first AI agent workflow — including evaluation, guardrails and adoption planning for real teams.");
await page.locator("#f-title").locator("xpath=ancestor::div[contains(@class,'space-y-4')]").getByRole("combobox").first().click();
await page.getByRole("option", { name: "Generative AI", exact: true }).click();
await page.getByRole("button", { name: "Continue", exact: true }).click();
await settle(500);
const outcomeInputs = page.locator("fieldset").first().locator("input");
await outcomeInputs.nth(0).fill("Design an agent workflow from a real user goal");
await outcomeInputs.nth(1).fill("Build tool-calling agents with evaluation harnesses");
await page.getByRole("button", { name: "Continue", exact: true }).click();
await settle(500);
await page.getByRole("button", { name: "Continue", exact: true }).click();  // thumbnail
await page.locator('button[aria-pressed]').first().click();
await page.getByRole("button", { name: "Continue", exact: true }).click();
await settle(500);
await page.getByRole("button", { name: "Continue", exact: true }).click();  // pricing -> content
await settle(900);

/* ------------------------- 1. video lesson ------------------------- */
await page.getByRole("button", { name: /Add lesson to/ }).click();
await shot("50-lesson-details", 700);
await page.locator("#lw-title").fill("Build your first tool-calling agent");
await shot("51-lesson-details-filled", 400);
await page.getByRole("button", { name: "Next", exact: true }).click();
await shot("52-lesson-upload-empty", 700);
await page.locator('input[type="file"][accept="video/*"]').setInputFiles("shots/tmp/lesson-1-intro.mp4");
await shot("53-lesson-uploading", 300);
await shot("54-lesson-uploaded", 3000);
await page.getByRole("button", { name: "Add lesson", exact: true }).click();
await shot("55-video-lesson-added", 900);

/* ------------------------- 2. quiz lesson -------------------------- */
await page.getByRole("button", { name: /Add lesson to/ }).click();
await page.locator("#lw-title").fill("Check your understanding");
await page.getByRole("radio", { name: /Quiz/ }).click();
await page.getByRole("button", { name: "Next", exact: true }).click();
await shot("56-quiz-empty", 600);
await page.getByRole("button", { name: "Add question", exact: true }).click();
await page.getByRole("textbox", { name: "Question 1" }).fill("Which loop pattern best fits a research agent?");
await page.getByRole("textbox", { name: "Answer 1" }).fill("Plan → act → observe, repeat");
await page.getByRole("textbox", { name: "Answer 2" }).fill("One giant prompt, no tools");
await page.getByRole("button", { name: "Add answer", exact: true }).click();
await page.getByRole("textbox", { name: "Answer 3" }).fill("Rerun the same prompt until it works");
await page.getByRole("radio", { name: "Mark option 1 as correct" }).click();
await shot("57-quiz-built", 600);
await page.getByRole("button", { name: "Add lesson", exact: true }).click();
await shot("58-quiz-added", 900);

/* ------------------------ 3. resource lesson ----------------------- */
await page.getByRole("button", { name: /Add lesson to/ }).click();
await page.getByRole("radio", { name: /Resource/ }).click();
await page.locator("#lw-title").fill("Prompt library (PDF download)");
await page.getByRole("button", { name: "Next", exact: true }).click();
await shot("59-resource-empty", 500);
await page.locator('input[type="file"]').last().setInputFiles("shots/tmp/prompt-library.pdf");
await shot("60-resource-detected", 900);
await page.getByRole("button", { name: "Add lesson", exact: true }).click();
await shot("61-curriculum-full", 1000);

/* -------------------------- preview step --------------------------- */
await page.getByRole("button", { name: "Continue", exact: true }).click();
await shot("62-preview-landing", 1500);
await page.getByRole("button", { name: "Curriculum", exact: true }).click();
await shot("63-preview-curriculum", 900);
await page.getByRole("button", { name: "Course card", exact: true }).click();
await shot("64-preview-card", 700);
await page.getByRole("button", { name: "Continue", exact: true }).click();
await shot("65-submit", 900);
await browser.close();
console.log("done");
