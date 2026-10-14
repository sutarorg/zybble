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
const settle = (ms = 800) => page.waitForTimeout(ms);
const shot = async (n, w = 800) => { await settle(w); try { await page.screenshot({ path: `shots/${n}.png`, timeout: 20000 }); console.log("shot:", n); } catch (e) { console.log("SHOT FAIL:", n, String(e).split("\n")[0]); } };

await page.goto(`${base}/login`);
await page.getByLabel("Email", { exact: true }).fill("jordan@zybble.example");
await page.getByLabel("Password", { exact: true }).fill("LearnToTeach!2026");
await page.getByRole("button", { name: "Sign in", exact: true }).click();
await page.waitForURL(`${base}/`);
/* signup as creator for the profile screenshots */
await page.locator("aside").getByRole("link", { name: /Start teaching|Go to Studio/ }).first().click();
await page.waitForURL("**/creator/signup");
await page.getByLabel("Headline", { exact: true }).fill("AI workflow educator");
await page.getByRole("button", { name: "AI Automation", exact: true }).click();
await page.getByRole("button", { name: "Continue", exact: true }).click();
await page.getByRole("checkbox").check();
await page.getByRole("button", { name: "Create creator account", exact: true }).click();
await page.waitForURL("**/creator");
await page.getByRole("button", { name: "Creator account menu" }).click();
await shot("70-creator-menu-icons", 600);
await page.getByRole("menuitem", { name: "Edit instructor profile" }).click();
await page.waitForURL("**/creator/profile");
fs.mkdirSync("shots/tmp", { recursive: true });
/* tiny solid-violet PNG so the avatar upload has a visible image to show */
if (!fs.existsSync("shots/tmp/avatar.png")) {
  const zlib2 = zlib;
  const w = 128, h = 128, raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0;
    for (let x = 0; x < w; x++) {
      const inside = (x - 64) ** 2 + (y - 64) ** 2 < 60 ** 2;
      const o = y * (1 + w * 3) + 1 + x * 3;
      raw[o] = inside ? 124 : 250; raw[o + 1] = inside ? 58 : 250; raw[o + 2] = inside ? 237 : 255;
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const t = Buffer.from(type, "ascii"); const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  fs.writeFileSync("shots/tmp/avatar.png", Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", zlib2.deflateSync(raw)), chunk("IEND", Buffer.alloc(0)),
  ]));
}
await page.locator('input[type="file"]').first().setInputFiles("shots/tmp/avatar.png");
await shot("71-creator-profile-avatar", 1400);
/* country combobox open */
await page.getByLabel("Country").click();
await page.getByLabel("Search countries").fill("swed");
await shot("72-creator-country-search", 700);
await page.getByRole("option", { name: /Sweden/ }).click();
await settle(400);
/* back to the learner side: enroll in the free course, then open the Resources tab */
await page.getByRole("link", { name: "Back to learner experience" }).click().catch(async () => {
  await page.locator("aside").getByRole("link", { name: "Explore" }).first().click();
});
await settle(900);
await page.locator("aside").getByRole("link", { name: /My Learning/ }).first().click();
await page.waitForURL("**/my-learning");
await settle(1000);
await shot("73-my-learning", 600);
await page.getByRole("link", { name: "Back to Explore", exact: true }).first().click();
await page.waitForURL(`${base}/`);
await page.getByRole("link", { name: /Prompt Engineering Foundations/ }).first().click();
await page.waitForURL("**/courses/prompt-engineering-foundations");
await settle(1000);
await page.getByRole("button", { name: "Enroll for free", exact: true }).click();
await page.waitForURL("**/checkout/**");
await page.getByRole("button", { name: "Complete free enrollment", exact: true }).click();
await page.waitForURL("**/checkout/success**");
await page.getByRole("link", { name: "Start learning", exact: true }).click();
await page.waitForURL("**/my-learning");
await settle(1200);
await page.getByRole("link", { name: "Overview", exact: true }).click();
await page.waitForURL("**/dashboard");
await settle(900);
await page.getByRole("link", { name: /Resume lesson|Start learning|Review course/ }).first().click();
await page.waitForURL("**/learn/**");
await settle(1800);
await shot("74-player", 500);
await page.getByRole("tab", { name: /Resources/ }).click().catch(async () => {
  await page.getByRole("button", { name: /Resources/ }).first().click();
});
await shot("75-player-resources", 900);
await browser.close();
console.log("done");
