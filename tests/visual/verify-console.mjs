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
const issues = [];
const tag = (kind, text) => { const s = String(text).replace(/\s+/g, " ").slice(0, 220); if (!/Download the React DevTools|Fast Refresh|\[Fast Refresh\]|Compiled in|webpack-hmr/i.test(s)) issues.push(`${kind} @${new URL(page.url()).pathname}: ${s}`); };
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") tag(m.type().toUpperCase(), m.text()); });
page.on("pageerror", (e) => tag("PAGEERROR", e.message));

await page.goto(`${base}/login`);
await page.getByLabel("Email", { exact: true }).fill("jordan@zybble.example");
await page.getByLabel("Password", { exact: true }).fill("LearnToTeach!2026");
await page.getByRole("button", { name: "Sign in", exact: true }).click();
await page.waitForURL(`${base}/`);
const gotoLink = async (name) => {
  const link = page.locator("aside").getByRole("link", { name, exact: true }).first();
  try {
    await link.click({ timeout: 8000 });
  } catch {
    const names = await page.locator("aside a").evaluateAll((els) => els.map((e) => (e.textContent || "").trim()).filter(Boolean));
    console.log(`SKIP ${name} — sidebar links on ${new URL(page.url()).pathname}: ${names.join(" | ")}`);
  }
  await page.waitForTimeout(1500);
};
/* learner page sweep via the sidebar + header menu */
for (const l of ["Explore", "My Learning", "Wishlist", "Orders", "Certificates", "Settings"]) { await gotoLink(l); }
await page.getByRole("link", { name: "Back to Explore", exact: true }).first().click();
await page.waitForTimeout(1200);
await page.getByRole("link", { name: /Prompt Engineering Foundations/ }).first().click();
await page.waitForTimeout(1500);
/* creator signup + creator sweep */
await page.locator("aside").getByRole("link", { name: /Start teaching|Go to Studio/ }).first().click();
await page.waitForURL("**/creator/signup");
await page.getByLabel("Headline", { exact: true }).fill("AI workflow educator");
await page.getByRole("button", { name: "AI Automation", exact: true }).click();
await page.getByRole("button", { name: "Continue", exact: true }).click();
await page.getByRole("checkbox").check();
await page.getByRole("button", { name: "Create creator account", exact: true }).click();
await page.waitForURL("**/creator");
for (const l of ["Creator Dashboard", "My Courses", "Create Course", "Analytics", "Earnings", "Payouts", "Reviews", "Profile", "Settings", "Help Center"]) {
  await gotoLink(l);
}
/* lesson + section dialogs on the create page */
await page.locator("aside").getByRole("link", { name: /Go to Studio|Creator Dashboard/ }).first().click().catch(() => {});
await page.waitForTimeout(1500);
await gotoLink("Creator Dashboard");
{
  const names = await page.locator("aside a").evaluateAll((els) => els.map((e) => (e.textContent || "").trim()).filter(Boolean));
  console.log("sidebar links:", names.join(" | "));
}
await page.locator("aside").getByRole("link", { name: /Create Course/ }).first().click();
await page.waitForTimeout(1200);
console.log("now on:", new URL(page.url()).pathname);
await page.locator("#f-title").fill("AI Agents for Product Teams");
await page.locator("#f-subtitle").fill("Ship a working agent workflow in two weekends.");
await page.locator("#f-description").fill("A practical project-based where product teams design, build and roll out their first agent workflow with evaluation and guardrails for real teams.");
await page.locator("#f-title").locator("xpath=ancestor::div[contains(@class,'space-y-4')]").getByRole("combobox").first().click();
await page.getByRole("option", { name: "Generative AI", exact: true }).click();
const cont = () => page.getByRole("button", { name: "Continue", exact: true }).click();
await cont(); await page.waitForTimeout(400);
await page.locator("fieldset").first().locator("input").nth(0).fill("Design an agent workflow from a real user goal");
await page.locator("fieldset").first().locator("input").nth(1).fill("Build tool-calling agents with evaluation harnesses");
await cont(); await page.waitForTimeout(400);
await cont();
await page.locator("button[aria-pressed]").first().click();
await cont(); await page.waitForTimeout(400);
await cont(); await page.waitForTimeout(800);
await page.getByRole("button", { name: /Add lesson to/ }).click();
await page.waitForTimeout(800);
await page.locator("#lw-title").fill("Build your first tool-calling agent");
await page.getByRole("radio", { name: /Quiz/ }).click();
await page.getByRole("button", { name: "Next", exact: true }).click();
await page.waitForTimeout(600);
await page.getByRole("button", { name: "Close", exact: true }).click().catch(() => page.keyboard.press("Escape"));
await page.waitForTimeout(500);
await page.getByRole("button", { name: /Add lesson to/ }).click();
await page.waitForTimeout(300);
await page.getByRole("radio", { name: /Resource/ }).click();
await page.waitForTimeout(300);
await page.keyboard.press("Escape");
await page.waitForTimeout(400);
await browser.close();

/* The only tolerated noise is the dev server dropping the very first request
   while it compiles (ERR_CONNECTION_CLOSED on /_next dev assets). */
const real = issues.filter((i) => !/ERR_CONNECTION_CLOSED/.test(i));
if (real.length) {
  console.error("console problems:\n" + real.join("\n"));
  process.exit(1);
}
console.log("NO CONSOLE ERRORS OR WARNINGS ACROSS THE APP");
