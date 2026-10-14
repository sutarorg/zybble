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

const SYSTEM_PROMPT = `You are Zybble AI, the course-discovery assistant for Zybble, an AI-course marketplace in India.

Rules you must follow:
- Answer only from the CATALOG below. Every course you mention MUST appear there.
- Recommend at most 3 courses. Copy their "slug" values exactly.
- All prices are Indian Rupees (INR, ₹). Never mention dollars, euros or any other currency.
- If the catalog has no good match, say so and offer to broaden the search.
- You cannot see learner accounts, take payments, issue refunds or contact support.
- For enrollment, billing, refunds, certificates or account questions, point to the Help Center.
- Reply in the same language the visitor used, keeping it under 90 words.
- Return ONLY a JSON object with this exact shape:
  {"text": "...", "recommended_slugs": ["..."], "link": {"href": "/help", "label": "Help Center"}}
  "link" is optional and may only be /help, /login, /signup, /my-learning or /dashboard.`;

export interface OpenRouterOptions {
  messages: ChatMessageInput[];
  catalog: GroundedCourse[];
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

/** Calls OpenRouter and parses the structured answer. Exported for testing. */
export async function askZybbleAi(options: OpenRouterOptions): Promise<AssistantAnswer> {
  if (!isOpenRouterConfigured()) throw new AiUnavailableError("unavailable");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const doFetch = options.fetchImpl ?? fetch;

  const history = options.messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 1000) }));

  const messages = [
    { role: "system", content: `${SYSTEM_PROMPT}\n\nCATALOG:\n${renderCatalogForPrompt(options.catalog) || "(the catalog is currently empty)"}` },
    ...history,
  ];

  try {
    const response = await doFetch(OPENROUTER_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serverEnv.openrouterApiKey}`,
        ...(serverEnv.openrouterSiteUrl ? { "HTTP-Referer": serverEnv.openrouterSiteUrl } : {}),
        "X-Title": serverEnv.openrouterAppName,
      },
      body: JSON.stringify({
        model: serverEnv.openrouterModel,
        messages,
        temperature: 0.3,
        max_tokens: 400,
        response_format: { type: "json_object" },
      }),
      signal: options.signal ?? controller.signal,
    });

    if (response.status === 429) throw new AiUnavailableError("rate_limited");
    if (!response.ok) throw new AiUnavailableError("unavailable");

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new AiUnavailableError("invalid_response");

    return parseAssistantAnswer(content);
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
