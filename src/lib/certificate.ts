import type { Certificate } from "@/types";

/**
 * Certificate renderer.
 *
 * The artwork in `/certificate-template.jpg` is the (AI-generated) parchment
 * texture and ornament motif; every piece of text — learner name, course
 * title, instructor name, date and verification code — is drawn on top of it
 * at runtime, so a single code path produces both the on-screen preview and
 * the downloaded PNG.
 *
 * Everything is drawn on a 16:9 canvas (1920×1080) and scaled by CSS, which
 * keeps the preview and the file byte-for-byte identical in layout.
 */

export const CERT_WIDTH = 1920;
export const CERT_HEIGHT = 1080;

const TEMPLATE_SRC = "/certificate-template.jpg";

const INK = "#18181b";
const INK_SOFT = "#52525b";
const INK_MUTED = "#71717a";
const VIOLET = "#6d28d9";
const VIOLET_LIGHT = "#c4b5fd";
const GOLD = "#c9a227";
const GOLD_LIGHT = "#e7cf7a";
const PRIMARY = "#6366f1";

const DISPLAY = '"Space Grotesk", "Segoe UI", system-ui, sans-serif';
const BODY = 'Inter, "Segoe UI", system-ui, sans-serif';

/* ------------------------------ font loading ------------------------------- */

let fontsReady: Promise<void> | null = null;

/**
 * The layout loads Inter + Space Grotesk from Google Fonts. Canvas cannot use
 * a family until it is actually loaded, so wait for it once per session and
 * fall back to the system stack if the request never resolves.
 */
export function ensureCertificateFonts(): Promise<void> {
  if (fontsReady) return fontsReady;
  const load = async () => {
    if (typeof document === "undefined" || !("fonts" in document)) return;
    const faces = [
      `700 92px ${DISPLAY}`,
      `600 30px ${DISPLAY}`,
      `700 30px ${DISPLAY}`,
      `400 30px ${BODY}`,
      `600 30px ${BODY}`,
    ];
    await Promise.all(faces.map((f) => document.fonts.load(f).catch(() => undefined)));
    await document.fonts.ready.catch(() => undefined);
  };
  fontsReady = Promise.race([load(), new Promise<void>((resolve) => window.setTimeout(resolve, 2500))]);
  return fontsReady;
}

/* ------------------------------- text helpers ------------------------------ */

function measureTracked(ctx: CanvasRenderingContext2D, text: string, tracking: number): number {
  let w = 0;
  for (const ch of text) w += ctx.measureText(ch).width + tracking;
  return Math.max(0, w - (text.length ? tracking : 0));
}

/** Draws `text` centred on `x` with manual letter-spacing (canvas-safe). */
function drawTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  tracking = 0
): void {
  const total = measureTracked(ctx, text, tracking);
  let cx = x - total / 2;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = "left";
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + tracking;
  }
  ctx.textAlign = prevAlign;
}

function setFont(
  ctx: CanvasRenderingContext2D,
  weight: number | string,
  size: number,
  family: string
): void {
  ctx.font = `${weight} ${size}px ${family}`;
}

/** Largest font size (≤ max, ≥ min) at which `text` fits `maxWidth`. */
function fitFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  max: number,
  min: number,
  weight: number | string,
  family: string,
  tracking = 0
): number {
  let size = max;
  for (; size > min; size -= 2) {
    setFont(ctx, weight, size, family);
    if (measureTracked(ctx, text, tracking) <= maxWidth) break;
  }
  return size;
}

/** Greedy word wrap, constrained to `maxLines` (shrinking the font if needed). */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
  max: number,
  min: number,
  weight: number | string,
  family: string,
  tracking = 0
): { lines: string[]; size: number } {
  let size = max;
  for (; size > min; size -= 2) {
    setFont(ctx, weight, size, family);
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (measureTracked(ctx, candidate, tracking) <= maxWidth || !line) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    if (lines.length <= maxLines) return { lines, size };
  }
  setFont(ctx, weight, size, family);
  return { lines: [text], size };
}

/* -------------------------------- decoration ------------------------------- */

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawFrame(ctx: CanvasRenderingContext2D): void {
  // Soft violet wash over the generated parchment so text stays legible.
  const wash = ctx.createLinearGradient(0, 0, CERT_WIDTH, CERT_HEIGHT);
  wash.addColorStop(0, "rgba(255, 253, 248, 0.86)");
  wash.addColorStop(0.5, "rgba(252, 250, 255, 0.80)");
  wash.addColorStop(1, "rgba(255, 250, 245, 0.86)");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, CERT_WIDTH, CERT_HEIGHT);

  // Outer / inner double rule.
  ctx.strokeStyle = PRIMARY;
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = 6;
  roundRect(ctx, 46, 46, CERT_WIDTH - 92, CERT_HEIGHT - 92, 18);
  ctx.stroke();

  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = VIOLET_LIGHT;
  ctx.lineWidth = 1.5;
  roundRect(ctx, 70, 70, CERT_WIDTH - 140, CERT_HEIGHT - 140, 12);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Corner flourishes (gold lozenges).
  const corners: [number, number][] = [
    [70, 70],
    [CERT_WIDTH - 70, 70],
    [70, CERT_HEIGHT - 70],
    [CERT_WIDTH - 70, CERT_HEIGHT - 70],
  ];
  for (const [cx, cy] of corners) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(-13, -13, 26, 26);
    ctx.fillStyle = "rgba(201, 162, 39, 0.22)";
    ctx.fillRect(-13, -13, 26, 26);
    ctx.restore();
  }
}

function drawSeal(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  ctx.save();
  // Ribbons
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.moveTo(cx - 16, cy + 34);
  ctx.lineTo(cx - 40, cy + 96);
  ctx.lineTo(cx - 8, cy + 78);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + 16, cy + 34);
  ctx.lineTo(cx + 40, cy + 96);
  ctx.lineTo(cx + 8, cy + 78);
  ctx.closePath();
  ctx.fill();

  // Medallion
  const g = ctx.createLinearGradient(cx - 52, cy - 52, cx + 52, cy + 52);
  g.addColorStop(0, GOLD_LIGHT);
  g.addColorStop(0.45, GOLD);
  g.addColorStop(1, "#a8801a");
  ctx.beginPath();
  ctx.arc(cx, cy, 52, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(255,255,255,0.65)";
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 41, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  setFont(ctx, 700, 26, DISPLAY);
  ctx.fillStyle = "#5b4305";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText("Z", cx, cy - 2);
  setFont(ctx, 600, 11, BODY);
  ctx.fillText("CERTIFIED", cx, cy + 22);
  ctx.restore();
}

/* --------------------------------- content --------------------------------- */

export function formatCertificateDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export function formatCertificateDuration(minutes: number): string {
  if (!minutes || minutes < 1) return "";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

export function certificateFileName(certificate: Certificate): string {
  const slug =
    certificate.courseSlug ||
    certificate.courseTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  return `Zybble-Certificate-${slug || "course"}.png`;
}

let templatePromise: Promise<HTMLImageElement | null> | null = null;

/** Loads (and caches) the generated parchment artwork. Never throws. */
export function loadTemplateImage(): Promise<HTMLImageElement | null> {
  if (templatePromise) return templatePromise;
  const load = async (): Promise<HTMLImageElement | null> => {
    if (typeof window === "undefined") return null;
    try {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.src = TEMPLATE_SRC;
      if (img.decode) {
        await img.decode();
      } else {
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("certificate template failed to load"));
        });
      }
      return img;
    } catch {
      return null;
    }
  };
  templatePromise = load();
  return templatePromise;
}

/**
 * Paints the certificate onto a 2D context sized CERT_WIDTH × CERT_HEIGHT.
 * `template` may be pre-loaded to avoid re-decoding the artwork per frame.
 */
export function paintCertificate(
  ctx: CanvasRenderingContext2D,
  certificate: Certificate,
  template: HTMLImageElement | null
): void {
  ctx.clearRect(0, 0, CERT_WIDTH, CERT_HEIGHT);

  // Parchment base, then the generated texture, then the frame on top.
  ctx.fillStyle = "#fdfbf7";
  ctx.fillRect(0, 0, CERT_WIDTH, CERT_HEIGHT);
  if (template && template.width) {
    ctx.save();
    ctx.globalAlpha = 0.95;
    // cover-fit
    const scale = Math.max(CERT_WIDTH / template.width, CERT_HEIGHT / template.height);
    const w = template.width * scale;
    const h = template.height * scale;
    ctx.drawImage(template, (CERT_WIDTH - w) / 2, (CERT_HEIGHT - h) / 2, w, h);
    ctx.restore();
  }
  drawFrame(ctx);

  const cx = CERT_WIDTH / 2;
  const studentName = (certificate.studentName || "Zybble Learner").trim();
  const courseTitle = (certificate.courseTitle || "Zybble Course").trim();
  const instructorName = (certificate.instructorName || "Zybble Instructor").trim();

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "center";

  /* Eyebrow */
  setFont(ctx, 700, 30, DISPLAY);
  ctx.fillStyle = PRIMARY;
  drawTracked(ctx, "CERTIFICATE OF COMPLETION", cx, 214, 12);

  /* Divider with a lozenge */
  ctx.strokeStyle = VIOLET;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - 150, 252);
  ctx.lineTo(cx - 22, 252);
  ctx.moveTo(cx + 22, 252);
  ctx.lineTo(cx + 150, 252);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.save();
  ctx.translate(cx, 252);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = GOLD;
  ctx.fillRect(-6, -6, 12, 12);
  ctx.restore();

  /* "This is to certify that" */
  setFont(ctx, 500, 24, BODY);
  ctx.fillStyle = INK_MUTED;
  drawTracked(ctx, "This is to certify that", cx, 328, 4);

  /* Learner name */
  const nameSize = fitFontSize(ctx, studentName, 1320, 92, 34, 700, DISPLAY, 1);
  setFont(ctx, 700, nameSize, DISPLAY);
  ctx.fillStyle = INK;
  drawTracked(ctx, studentName, cx, 428, 1);

  ctx.strokeStyle = "#d4d4d8";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - 300, 458);
  ctx.lineTo(cx + 300, 458);
  ctx.stroke();

  /* Completion line */
  setFont(ctx, 400, 30, BODY);
  ctx.fillStyle = INK_SOFT;
  drawTracked(ctx, "has successfully completed the Zybble course", cx, 528, 1);

  /* Course title (up to two lines, auto-shrunk) */
  const title = wrapText(ctx, courseTitle, 1400, 2, 62, 30, 700, DISPLAY, 0);
  setFont(ctx, 700, title.size, DISPLAY);
  ctx.fillStyle = VIOLET;
  const titleTop = title.lines.length > 1 ? 604 : 616;
  title.lines.forEach((line, i) => {
    drawTracked(ctx, line, cx, titleTop + i * (title.size + 12), 0);
  });

  /* Course meta */
  const metaBase = titleTop + (title.lines.length - 1) * (title.size + 12) + 56;
  const bits = [
    certificate.lessonsCount > 0
      ? `${certificate.lessonsCount} lesson${certificate.lessonsCount === 1 ? "" : "s"}`
      : "",
    formatCertificateDuration(certificate.durationMinutes),
  ].filter(Boolean);
  if (bits.length) {
    setFont(ctx, 400, 24, BODY);
    ctx.fillStyle = INK_MUTED;
    drawTracked(ctx, bits.join("  ·  "), cx, metaBase, 1);
  }

  /* Zybble Logo at top */
  setFont(ctx, 700, 24, DISPLAY);
  ctx.fillStyle = PRIMARY;
  ctx.textAlign = "center";
  ctx.fillText("Zybble", cx, 100);
  
  // Zybble logo icon
  ctx.save();
  ctx.translate(cx - 40, 70);
  ctx.strokeStyle = PRIMARY;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(15, 20);
  ctx.lineTo(30, 0);
  ctx.stroke();
  ctx.restore();

  /* Footer: instructor (left) · seal (centre) · date (right) */
  const ruleY = 856;
  ctx.strokeStyle = "#d4d4d8";
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.moveTo(180, ruleY);
  ctx.lineTo(560, ruleY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(CERT_WIDTH - 560, ruleY);
  ctx.lineTo(CERT_WIDTH - 180, ruleY);
  ctx.stroke();

  ctx.textAlign = "left";
  setFont(ctx, 600, 17, BODY);
  ctx.fillStyle = VIOLET;
  drawTrackedAsLeft(ctx, "INSTRUCTOR", 180, 892, 5);
  const instrSize = fitFontSize(ctx, instructorName, 360, 30, 18, 600, BODY, 0);
  setFont(ctx, 600, instrSize, BODY);
  ctx.fillStyle = "#27272a";
  ctx.fillText(instructorName, 180, 936);

  ctx.textAlign = "right";
  setFont(ctx, 600, 17, BODY);
  ctx.fillStyle = VIOLET;
  const issuedLabel = "DATE ISSUED";
  const issuedWidth = measureTracked(ctx, issuedLabel, 5);
  drawTracked(ctx, issuedLabel, CERT_WIDTH - 180 - issuedWidth / 2, 892, 5);
  ctx.textAlign = "right";
  setFont(ctx, 600, 28, BODY);
  ctx.fillStyle = "#27272a";
  ctx.fillText(formatCertificateDate(certificate.issuedAt), CERT_WIDTH - 180, 936);

  drawSeal(ctx, cx, 862);

  /* Verification code */
  ctx.textAlign = "center";
  setFont(ctx, 500, 19, BODY);
  ctx.fillStyle = "#a1a1aa";
  drawTracked(ctx, `Certificate ID  ${certificate.id}`, cx, 996, 2);
}

/** Left-aligned tracked text (used for the footer labels). */
function drawTrackedAsLeft(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  tracking = 0
): void {
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + tracking;
  }
}

/* --------------------------------- outputs --------------------------------- */

export async function renderCertificateToCanvas(
  certificate: Certificate
): Promise<HTMLCanvasElement> {
  await ensureCertificateFonts();
  const canvas = document.createElement("canvas");
  canvas.width = CERT_WIDTH;
  canvas.height = CERT_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported in this browser");
  const template = await loadTemplateImage();
  paintCertificate(ctx, certificate, template);
  return canvas;
}

/** Renders the certificate and triggers a PNG download. */
export async function downloadCertificate(certificate: Certificate): Promise<void> {
  const canvas = await renderCertificateToCanvas(certificate);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png")
  );
  if (!blob) throw new Error("Could not export the certificate");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = certificateFileName(certificate);
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give Safari/Firefox a beat before revoking.
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}
