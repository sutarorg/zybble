/**
 * Zybble AI — OpenRouter-backed public course-discovery assistant.
 *
 * Grounding rules (the reason a recommendation can never be invented):
 *  1. The model only ever sees a compact list of **published** courses.
 *  2. It must answer with a JSON object matching a strict schema.
 *  3. Every recommended `slug` is resolved against the database before it is
 *     rendered; a slug the model invented is discarded, not displayed.
 *  4. The API key is server-only.
 */

import "server-only";
import { serverEnv, isOpenRouterConfigured } from "@/lib/env";
import { formatInrOrFree } from "@/lib/money";

export const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
export const REQUEST_TIMEOUT_MS = 12_000;
export const MAX_USER_MESSAGE_CHARS = 500;
export const MAX_HISTORY_MESSAGES = 12;
export const MAX_CATALOG_ITEMS = 60;

export interface GroundedCourse {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  level: string;
  pricePaise: number;
  durationMinutes: number;
  instructor: string;
  lessons: number;
}

export interface AssistantAnswer {
  /** Short natural-language reply. Plain text; rendered as text, never as HTML. */
  text: string;
  /** Slugs the model asked for; validated against the catalog before rendering. */
  recommendedSlugs: string[];
  /** Optional in-app help link. Only `/help`, `/login`, `/my-learning` are allowed. */
  link?: { href: string; label: string };
  error?: "unavailable" | "rate_limited" | "invalid_response";
}

export class AiUnavailableError extends Error {
  readonly reason: AssistantAnswer["error"];
  constructor(reason: AssistantAnswer["error"] = "unavailable") {
    super("Zybble AI is unavailable");
    this.name = "AiUnavailableError";
    this.reason = reason;
  }
}

const ALLOWED_LINK_PATHS = new Set(["/help", "/login", "/signup", "/my-learning", "/dashboard"]);

export function sanitiseLink(link: unknown): { href: string; label: string } | undefined {
  if (!link || typeof link !== "object") return undefined;
  const candidate = link as { href?: unknown; label?: unknown };
  if (typeof candidate.href !== "string" || !ALLOWED_LINK_PATHS.has(candidate.href)) return undefined;
  const label = typeof candidate.label === "string" ? candidate.label.slice(0, 80) : "Learn more";
  return { href: candidate.href, label };
}

/* -------------------------------------------------------------------------- */
/* Catalog grounding                                                           */
/* -------------------------------------------------------------------------- */

/** Compact prompt payload. Deliberately excludes drafts, creators' KYC and money internals. */
export function renderCatalogForPrompt(courses: GroundedCourse[]): string {
  return courses
    .slice(0, MAX_CATALOG_ITEMS)
    .map((course) =>
      [
        `slug: ${course.slug}`,
        `title: ${course.title}`,
        `about: ${course.summary.slice(0, 180)}`,
        `category: ${course.category}`,
        `level: ${course.level}`,
        `price: ${course.pricePaise === 0 ? "free" : `${course.pricePaise / 100} INR`}`,
        `duration_minutes: ${course.durationMinutes}`,
        `lessons: ${course.lessons}`,
        `instructor: ${course.instructor}`,
      ].join("\n")
    )
    .join("\n---\n");
}

/** Resolves model-proposed slugs against the authoritative catalog. */
export function resolveRecommendations(
  slugs: unknown,
  catalog: GroundedCourse[]
): GroundedCourse[] {
  if (!Array.isArray(slugs)) return [];
  const bySlug = new Map(catalog.map((course) => [course.slug, course]));
  const seen = new Set<string>();
  const resolved: GroundedCourse[] = [];
  for (const raw of slugs) {
    if (typeof raw !== "string") continue;
    const course = bySlug.get(raw.trim());
    if (!course || seen.has(course.slug)) continue;
    seen.add(course.slug);
    resolved.push(course);
    if (resolved.length >= 3) break;
  }
  return resolved;
}

/* -------------------------------------------------------------------------- */
/* Model call                                                                  */
/* -------------------------------------------------------------------------- */

export interface ChatMessageInput {
  role: "user" | "assistant";
  content: string;
}

/**
 * The wire format is plain text with an optional trailer, not JSON.
 *
 * Reasons: it streams cleanly (the visitor sees words, not `{"text":"…`),
 * and DeepSeek reliably honours it. The trailer is the only part that is
 * machine-read, and it is validated before anything is rendered.
 */
const SYSTEM_PROMPT = `You are Zybble AI, the course-discovery assistant for Zybble, an AI-course marketplace in India.

Rules you must follow:
- Answer only from the CATALOG below. Every course you mention MUST appear there.
- Recommend at most 3 courses. Copy their "slug" values exactly.
- All prices are Indian Rupees (INR, INR symbol ₹). Never mention dollars, euros or any other currency.
- If the catalog has no good match, say so and offer to broaden the search.
- You cannot see learner accounts, take payments, issue refunds or contact support.
- For enrollment, billing, refunds, certificates or account questions, point to the Help Center.
- Reply in the same language the visitor used, keeping it under 90 words.
- Write plain prose. No markdown, no headings, no code fences.

Output format — exactly two parts, nothing else:
1. Your reply to the visitor.
2. An optional final line, only if you are naming courses:
   SLUGS: slug-one, slug-two
Use only slugs copied from the CATALOG. Omit the line entirely if you recommend nothing.`;

export interface OpenRouterOptions {
  messages: ChatMessageInput[];
  catalog: GroundedCourse[];
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

/** Builds the request payload shared by the streaming and one-shot paths. */
function buildRequestBody(options: OpenRouterOptions, stream: boolean): string {
  const history = options.messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 1000) }));

  const messages = [
    {
      role: "system",
      content: `${SYSTEM_PROMPT}\n\nCATALOG:\n${renderCatalogForPrompt(options.catalog) || "(the catalog is currently empty)"}`,
    },
    ...history,
  ];

  return JSON.stringify({
    model: serverEnv.openrouterModel,
    messages,
    stream,
    temperature: 0.4,
    max_tokens: 500,
  });
}

function openRouterHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${serverEnv.openrouterApiKey}`,
    ...(serverEnv.openrouterSiteUrl ? { "HTTP-Referer": serverEnv.openrouterSiteUrl } : {}),
    "X-Title": serverEnv.openrouterAppName,
  };
}

/** Maps an OpenRouter HTTP status onto the honest failure it represents. */
function statusToReason(status: number): AssistantAnswer["error"] {
  if (status === 429 || status === 402) return "rate_limited";
  return "unavailable";
}

/* -------------------------------------------------------------------------- */
/* Streaming                                                                   */
/* -------------------------------------------------------------------------- */

export type AssistantStreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; answer: AssistantAnswer };

/**
 * Incremental SSE reader.
 *
 * Yields `data:` payloads one at a time so the caller can react to each token
 * instead of waiting for the whole body. Handles chunks that split a line.
 */
async function* readSse(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let index: number;
      while ((index = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);
        if (line.startsWith("data:")) yield line.slice(5).trim();
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/** Pulls `choices[0].delta.content` out of an SSE payload. Returns null on `[DONE]`. */
export function readDeltaContent(payload: string): string | null {
  if (!payload || payload === "[DONE]") return null;
  try {
    const parsed = JSON.parse(payload) as {
      choices?: Array<{ delta?: { content?: string | null; reasoning?: string | null } }>;
    };
    // DeepSeek's reasoning trace is never shown to the visitor.
    const content = parsed.choices?.[0]?.delta?.content;
    return typeof content === "string" ? content : "";
  } catch {
    return "";
  }
}

/**
 * Streams the assistant reply.
 *
 * Text is emitted as it arrives. The trailer (`SLUGS:`) is held back until the
 * stream ends, parsed, validated against the catalog, and returned with the
 * final event — so a slug is only ever surfaced once it is known to be real.
 */
export async function* streamZybbleAi(
  options: OpenRouterOptions
): AsyncGenerator<AssistantStreamEvent> {
  if (!isOpenRouterConfigured()) throw new AiUnavailableError("unavailable");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const doFetch = options.fetchImpl ?? fetch;

  try {
    const response = await doFetch(OPENROUTER_ENDPOINT, {
      method: "POST",
      headers: openRouterHeaders(),
      body: buildRequestBody(options, true),
      signal: options.signal ?? controller.signal,
    });

    if (!response.ok || !response.body) {
      throw new AiUnavailableError(statusToReason(response.status));
    }

    let full = "";
    let emitted = 0;

    for await (const payload of readSse(response.body)) {
      const delta = readDeltaContent(payload);
      if (delta === null) break; // [DONE]
      if (!delta) continue;
      full += delta;

      // Hold back the trailer and anything that could still turn into one, so
      // the visitor never sees `SLUGS: prompt-engineering-101`.
      const visible = visiblePrefix(full);
      if (visible.length > emitted) {
        const text = visible.slice(emitted);
        emitted = visible.length;
        if (text) yield { type: "delta", text };
      }
    }

    const answer = parseAssistantContent(full);
    // Anything the trailer filter withheld is by definition not prose.
    const tail = answer.text.slice(emitted);
    if (tail) yield { type: "delta", text: tail };
    yield { type: "done", answer };
  } catch (error) {
    if (error instanceof AiUnavailableError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new AiUnavailableError("unavailable");
    }
    throw new AiUnavailableError("unavailable");
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * How much of a partial reply is safe to show.
 *
 * A trailing `SLUGS:` line is machine output, not prose, so the moment a line
 * looks like it is starting one we stop — and resume if it turns out to be
 * ordinary text after all.
 */
export function visiblePrefix(text: string): string {
  const newline = text.lastIndexOf("\n");
  if (newline === -1) {
    // Single line so far: only withhold it if it is already a trailer.
    return /^\s*(SLUGS|LINK)\s*:/i.test(text) ? "" : text;
  }
  const lastLine = text.slice(newline + 1);
  if (/^\s*(SLUGS|LINK)\s*:/i.test(lastLine)) {
    // Drop the blank space ahead of the trailer along with the trailer itself.
    return text.slice(0, newline + 1).replace(/\s+$/, "");
  }
  // A partially-streamed `SLUG` prefix could still become `SLUGS:`.
  if (/^\s*$/.test(lastLine) || /^\s*(S|SL|SLU|SLUG|SLUGS|L|LI|LIN|LINK)\s*:?\s*$/i.test(lastLine)) {
    return text.slice(0, newline + 1).replace(/\s+$/, "");
  }
  return text;
}

/* -------------------------------------------------------------------------- */
/* One-shot                                                                    */
/* -------------------------------------------------------------------------- */

/** Calls OpenRouter and parses the structured answer. Exported for testing. */
export async function askZybbleAi(options: OpenRouterOptions): Promise<AssistantAnswer> {
  if (!isOpenRouterConfigured()) throw new AiUnavailableError("unavailable");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const doFetch = options.fetchImpl ?? fetch;

  try {
    const response = await doFetch(OPENROUTER_ENDPOINT, {
      method: "POST",
      headers: openRouterHeaders(),
      body: buildRequestBody(options, false),
      signal: options.signal ?? controller.signal,
    });

    if (response.status === 429) throw new AiUnavailableError("rate_limited");
    if (!response.ok) throw new AiUnavailableError("unavailable");

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new AiUnavailableError("invalid_response");

    return parseAssistantContent(content);
  } catch (error) {
    if (error instanceof AiUnavailableError) throw error;
    throw new AiUnavailableError("unavailable");
  } finally {
    clearTimeout(timeout);
  }
}

/** Strictly parses the model's JSON answer. Never renders unvalidated text. */
export function parseAssistantAnswer(content: string): AssistantAnswer {
  let parsed: unknown;
  try {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("no json");
    parsed = JSON.parse(content.slice(start, end + 1));
  } catch {
    throw new AiUnavailableError("invalid_response");
  }
  if (!parsed || typeof parsed !== "object") throw new AiUnavailableError("invalid_response");

  const raw = parsed as { text?: unknown; recommended_slugs?: unknown; link?: unknown };
  const text = typeof raw.text === "string" ? raw.text.trim().slice(0, 900) : "";
  if (!text) throw new AiUnavailableError("invalid_response");

  return {
    text,
    recommendedSlugs: Array.isArray(raw.recommended_slugs)
      ? raw.recommended_slugs.filter((s): s is string => typeof s === "string").slice(0, 3)
      : [],
    link: sanitiseLink(raw.link),
  };
}

/** Matches the machine-read trailer lines a model may append to its reply. */
const TRAILER_LINE = /^\s*(SLUGS|LINK)\s*:\s*(.*)$/i;

/**
 * Parses the plain-text wire format.
 *
 * Everything before the trailer is the reply; `SLUGS:` and `LINK:` are stripped
 * so they can never leak into the conversation as visible text.
 */
export function parsePlainAnswer(content: string): AssistantAnswer {
  const lines = content.replace(/\r/g, "").split("\n");

  let slugs: string[] = [];
  let link: { href: string; label: string } | undefined;

  // Walk backwards, consuming trailer lines until the first line of prose.
  let end = lines.length;
  while (end > 0) {
    const match = TRAILER_LINE.exec(lines[end - 1] ?? "");
    if (!match) break;
    const key = match[1].toUpperCase();
    const value = match[2].trim();
    if (key === "SLUGS") {
      slugs = value
        .split(",")
        .map((slug) => slug.trim())
        .filter(Boolean);
    } else if (!link) {
      const [href, label] = value.split("|").map((part) => part.trim());
      link = sanitiseLink({ href, label: label || undefined });
    }
    end -= 1;
  }

  const text = lines
    .slice(0, end)
    .join("\n")
    .replace(/```/g, "")
    .trim()
    .slice(0, 900);

  if (!text) throw new AiUnavailableError("invalid_response");

  return { text, recommendedSlugs: slugs.slice(0, 3), link };
}

/**
 * Parses whatever the model returned.
 *
 * The JSON shape is still accepted (older prompts, other providers); anything
 * else is read as plain text. Both paths validate before they return.
 */
export function parseAssistantContent(content: string): AssistantAnswer {
  const trimmed = content.trim();
  if (trimmed.startsWith("{")) {
    try {
      return parseAssistantAnswer(trimmed);
    } catch {
      // Fall through — a partial or malformed object is still readable as text.
    }
  }
  return parsePlainAnswer(trimmed);
}

/** Human fallback used when the model is unavailable — still grounded, never invented. */
export function fallbackAnswer(reason: AssistantAnswer["error"], catalogCount: number): AssistantAnswer {
  if (reason === "rate_limited") {
    return {
      text: "Zybble AI is busy right now. Please try again in a moment, or browse the catalog directly.",
      recommendedSlugs: [],
      link: { href: "/help", label: "Help Center" },
      error: "rate_limited",
    };
  }
  if (catalogCount === 0) {
    return {
      text: "There are no published courses in the Zybble catalog yet. Please check back soon — creators are preparing new AI courses.",
      recommendedSlugs: [],
      link: { href: "/help", label: "Help Center" },
      error: "unavailable",
    };
  }
  return {
    text: "Zybble AI is temporarily unavailable. You can still browse the full catalog and filter it by level, duration and price.",
    recommendedSlugs: [],
    link: { href: "/help", label: "Help Center" },
    error: "unavailable",
  };
}

/** Formats a grounded course for the client, with INR already applied. */
export function toRecommendation(course: GroundedCourse) {
  return {
    id: course.id,
    slug: course.slug,
    title: course.title,
    instructor: course.instructor,
    category: course.category,
    level: course.level,
    durationMinutes: course.durationMinutes,
    lessonsCount: course.lessons,
    priceLabel: formatInrOrFree(course.pricePaise),
  };
}
