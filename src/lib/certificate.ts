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

/**
 * Laurel branch: a curved stem with tapered leaves, mirrored by `side`
 * (−1 = left, 1 = right). Used inside the medallion for a classic seal look.
 */
function drawLaurelBranch(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  side: -1 | 1
): void {
  const start = side === -1 ? Math.PI * 0.72 : Math.PI * 0.28;
  const end = side === -1 ? Math.PI * 1.28 : Math.PI * -0.28;
  ctx.save();
  ctx.strokeStyle = "rgba(91, 67, 5, 0.8)";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, start, end, side === -1);
  ctx.stroke();

  const steps = 6;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const angle = start + (end - start) * t * 0.92;
    const px = cx + Math.cos(angle) * radius;
    const py = cy + Math.sin(angle) * radius;
    const outward = angle + (side === -1 ? Math.PI / 2 : -Math.PI / 2);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(outward + side * 0.5);
    const leaf = ctx.createLinearGradient(0, 0, 0, -10);
    leaf.addColorStop(0, "rgba(169, 129, 26, 0.95)");
    leaf.addColorStop(1, "rgba(233, 209, 126, 0.95)");
    ctx.fillStyle = leaf;
    ctx.beginPath();
    ctx.ellipse(0, -5, 3.1, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/** Ring of tiny beads — the milled edge of a struck medallion. */
function drawBeadedRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  count: number,
  color: string
): void {
  ctx.save();
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, 1.7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * The completion medallion: cast-gold disc with a milled edge, beaded ring,
 * laurel wreath, engraved "Z" monogram, star and ribbon tails.
 */
function drawSeal(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  ctx.save();

  /* Ribbon tails (behind the disc) */
  const ribbon = ctx.createLinearGradient(cx - 46, cy, cx + 46, cy + 108);
  ribbon.addColorStop(0, "#7c3aed");
  ribbon.addColorStop(0.5, "#5b21b6");
  ribbon.addColorStop(1, "#4c1d95");
  ctx.fillStyle = ribbon;
  // left tail
  ctx.beginPath();
  ctx.moveTo(cx - 40, cy + 34);
  ctx.lineTo(cx - 58, cy + 112);
  ctx.lineTo(cx - 22, cy + 96);
  ctx.lineTo(cx - 6, cy + 48);
  ctx.closePath();
  ctx.fill();
  // right tail
  ctx.beginPath();
  ctx.moveTo(cx + 40, cy + 34);
  ctx.lineTo(cx + 58, cy + 112);
  ctx.lineTo(cx + 22, cy + 96);
  ctx.lineTo(cx + 6, cy + 48);
  ctx.closePath();
  ctx.fill();
  // ribbon shading kept subtle so the gold stays the hero
  ctx.strokeStyle = "rgba(24, 24, 27, 0.18)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 40, cy + 34);
  ctx.lineTo(cx - 58, cy + 112);
  ctx.moveTo(cx + 40, cy + 34);
  ctx.lineTo(cx + 58, cy + 112);
  ctx.stroke();

  /* Soft drop shadow under the disc */
  ctx.save();
  ctx.shadowColor = "rgba(120, 84, 10, 0.35)";
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 6;

  /* Outer milled rim */
  const rim = ctx.createLinearGradient(cx - 62, cy - 62, cx + 62, cy + 62);
  rim.addColorStop(0, "#f6e7ae");
  rim.addColorStop(0.35, "#d8b64a");
  rim.addColorStop(0.7, "#b8912a");
  rim.addColorStop(1, "#8d6b12");
  ctx.beginPath();
  ctx.arc(cx, cy, 72, 0, Math.PI * 2);
  ctx.fillStyle = rim;
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(cx, cy, 72, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(91, 67, 5, 0.55)";
  ctx.lineWidth = 1.6;
  ctx.stroke();

  /* Beaded edge */
  drawBeadedRing(ctx, cx, cy, 66, 52, "rgba(255, 249, 224, 0.85)");

  /* Inner field */
  const field = ctx.createRadialGradient(cx - 16, cy - 22, 7, cx, cy, 58);
  field.addColorStop(0, "#fdf3cd");
  field.addColorStop(0.55, "#e8cf7f");
  field.addColorStop(1, "#c2a03a");
  ctx.beginPath();
  ctx.arc(cx, cy, 58, 0, Math.PI * 2);
  ctx.fillStyle = field;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, 58, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(120, 90, 12, 0.45)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  /* Laurel wreath */
  drawLaurelBranch(ctx, cx, cy, 44, -1);
  drawLaurelBranch(ctx, cx, cy, 44, 1);

  /* Star above the monogram */
  ctx.save();
  ctx.translate(cx, cy - 32);
  ctx.fillStyle = "#8a6712";
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 10.5 : 4.6;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  /* Engraved monogram */
  ctx.save();
  ctx.translate(cx, cy - 2);
  setFont(ctx, 700, 50, DISPLAY);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255, 252, 240, 0.75)";
  ctx.fillText("Z", 1.4, 1.6);
  ctx.fillStyle = "#6b4d06";
  ctx.fillText("Z", 0, 0);
  ctx.restore();

  /* Wordmark inside the seal */
  ctx.save();
  setFont(ctx, 700, 11.5, BODY);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(107, 77, 6, 0.9)";
  drawTracked(ctx, "CERTIFIED", cx, cy + 42, 3);
  ctx.restore();

  /* Top fold where the ribbons meet the disc */
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - 18, cy - 56);
  ctx.lineTo(cx + 18, cy - 56);
  ctx.lineTo(cx + 11, cy - 74);
  ctx.lineTo(cx - 11, cy - 74);
  ctx.closePath();
  const fold = ctx.createLinearGradient(cx, cy - 74, cx, cy - 56);
  fold.addColorStop(0, "#a87f1c");
  fold.addColorStop(1, "#e8cf7f");
  ctx.fillStyle = fold;
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

/**
 * The Zybble brand lockup (rounded-square mark + wordmark), drawn centred on
 * `cx`. Mirrors `<ZybbleMark />` from the app shell so the certificate carries
 * the same identity learners see in the product.
 */
function drawBrandLockup(ctx: CanvasRenderingContext2D, cx: number, centerY: number): void {
  const size = 46;
  const gap = 16;

  ctx.save();
  setFont(ctx, 700, 30, DISPLAY);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const wordWidth = measureTracked(ctx, "Zybble", 0);
  const totalWidth = size + gap + wordWidth;
  const markX = cx - totalWidth / 2;
  const markY = centerY - size / 2;

  /* Violet tile */
  const tile = ctx.createLinearGradient(markX, markY, markX + size, markY + size);
  tile.addColorStop(0, "#8b5cf6");
  tile.addColorStop(1, "#6d28d9");
  ctx.save();
  ctx.shadowColor = "rgba(109, 40, 217, 0.28)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = tile;
  roundRect(ctx, markX, markY, size, size, 14);
  ctx.fill();
  ctx.restore();

  /* Specular highlight + hairline border */
  const gloss = ctx.createLinearGradient(markX, markY, markX, markY + size);
  gloss.addColorStop(0, "rgba(255,255,255,0.24)");
  gloss.addColorStop(0.55, "rgba(255,255,255,0)");
  ctx.fillStyle = gloss;
  roundRect(ctx, markX, markY, size, size, 14);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1;
  roundRect(ctx, markX + 0.5, markY + 0.5, size - 1, size - 1, 13.5);
  ctx.stroke();

  /* "Z" glyph — the same path the product mark uses, scaled from a 24pt grid */
  const pad = 11;
  const scale = (size - pad * 2) / 24;
  ctx.save();
  ctx.translate(markX + pad, markY + pad);
  ctx.scale(scale, scale);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2.6;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(6, 5.5);
  ctx.lineTo(18, 5.5);
  ctx.lineTo(9.5, 18.5);
  ctx.lineTo(18, 18.5);
  ctx.stroke();
  ctx.restore();

  /* Wordmark */
  ctx.fillStyle = INK;
  drawTrackedAsLeft(ctx, "Zybble", markX + size + gap, centerY + 1, 0);

  /* Underline flourish that ties the lockup to the certificate */
  const flourishY = centerY + size / 2 + 9;
  const halfWidth = Math.max(120, totalWidth / 2 + 34);
  const line = ctx.createLinearGradient(cx - halfWidth, flourishY, cx + halfWidth, flourishY);
  line.addColorStop(0, "rgba(201, 162, 39, 0)");
  line.addColorStop(0.5, "rgba(201, 162, 39, 0.85)");
  line.addColorStop(1, "rgba(201, 162, 39, 0)");
  ctx.strokeStyle = line;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(cx - halfWidth, flourishY);
  ctx.lineTo(cx + halfWidth, flourishY);
  ctx.stroke();

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

  /* Wordmark lockup at the top — the real Zybble mark, drawn as vectors. */
  drawBrandLockup(ctx, cx, 104);

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

  drawSeal(ctx, cx, 852);

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
