import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { isOpenRouterConfigured } from "@/lib/env";
import {
  AiUnavailableError,
  MAX_USER_MESSAGE_CHARS,
  askZybbleAi,
  fallbackAnswer,
  resolveRecommendations,
  toRecommendation,
  type ChatMessageInput,
  type GroundedCourse,
} from "@/lib/server/ai";
import { clientKey, LIMITS, rateLimit, rateLimitHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const requestSchema = z.object({
  sessionId: z.string().min(8).max(80),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(2000),
      })
    )
    .min(1)
    .max(12),
  category: z.string().max(64).optional(),
});

/**
 * Public Zybble AI endpoint.
 *
 * Grounding is enforced here rather than in the prompt: the model only ever
 * receives published course rows, and every slug it returns is resolved against
 * the same database read before it is sent to the browser. A hallucinated slug
 * is dropped, never rendered.
 */
export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "chat"), LIMITS.chat.limit, LIMITS.chat.windowMs);
  if (!limit.allowed) {
    return Response.json(
      { error: "Too many messages. Please slow down." },
      { status: 429, headers: rateLimitHeaders(limit) }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const messages: ChatMessageInput[] = parsed.data.messages.slice(-12);
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUserMessage || lastUserMessage.content.length > MAX_USER_MESSAGE_CHARS) {
    return Response.json({ error: "Message is too long" }, { status: 400 });
  }

  const catalog = await loadGroundedCatalog(parsed.data.category);

  if (!isOpenRouterConfigured()) {
    return Response.json(
      { ...fallbackAnswer("unavailable", catalog.length), recommendations: [] },
      { status: 200, headers: rateLimitHeaders(limit) }
    );
  }

  try {
    const answer = await askZybbleAi({ messages, catalog });
    const recommendations = resolveRecommendations(answer.recommendedSlugs, catalog);
    return Response.json(
      { text: answer.text, link: answer.link, recommendations: recommendations.map(toRecommendation) },
      { status: 200, headers: rateLimitHeaders(limit) }
    );
  } catch (error) {
    const reason = error instanceof AiUnavailableError ? error.reason : "unavailable";
    return Response.json(
      { ...fallbackAnswer(reason, catalog.length), recommendations: [] },
      { status: 200, headers: rateLimitHeaders(limit) }
    );
  }
}

/**
 * Reads only published courses. `published_courses` is a view restricted to
 * `status = 'published'`, so drafts, rejected courses and creator KYC can never
 * reach the model.
 */
async function loadGroundedCatalog(categorySlug?: string): Promise<GroundedCourse[]> {
  const supabase = await createServerClient();
  let query = supabase
    .from("published_courses")
    .select(
      "id, slug, title, description, category_slug, level, price_paise, duration_minutes, lessons_count, creator_display_name"
    )
    .limit(60);
  if (categorySlug) query = query.eq("category_slug", categorySlug);

  const { data, error } = await query;
  if (error || !data) return [];

  return (data as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    summary: String(row.description ?? ""),
    category: String(row.category_slug ?? ""),
    level: String(row.level ?? "beginner"),
    pricePaise: Number(row.price_paise ?? 0),
    durationMinutes: Number(row.duration_minutes ?? 0),
    lessons: Number(row.lessons_count ?? 0),
    instructor: String(row.creator_display_name ?? "Zybble creator"),
  }));
}
