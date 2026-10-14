import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { formatInr } from "@/lib/money";
import { clientKey, LIMITS, rateLimit, rateLimitHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const querySchema = z.object({ q: z.string().min(1).max(120) });

/**
 * Global search over the published catalog.
 *
 * Reads `published_courses` (a view restricted to `status = 'published'`) and
 * public creator profiles, so drafts, rejected submissions and creator KYC
 * state can never appear in suggestions.
 */
export async function GET(request: Request) {
  const limit = rateLimit(clientKey(request, "search"), LIMITS.search.limit, LIMITS.search.windowMs);
  if (!limit.allowed) {
    return Response.json({ error: "Too many searches. Please slow down." }, { status: 429, headers: rateLimitHeaders(limit) });
  }

  const parsed = querySchema.safeParse({ q: new URL(request.url).searchParams.get("q") ?? "" });
  if (!parsed.success) {
    return Response.json({ courses: [], instructors: [] }, { status: 200, headers: rateLimitHeaders(limit) });
  }

  const term = parsed.data.q.trim();
  const like = `%${term.replace(/[%_]/g, "")}%`;

  if (!isSupabaseConfigured()) {
    return Response.json({ courses: [], instructors: [] }, { status: 200, headers: rateLimitHeaders(limit) });
  }

  const supabase = await createServerClient();
  const [courses, instructors] = await Promise.all([
    supabase
      .from("published_courses")
      .select("id, slug, title, level, price_paise, thumbnail_key, category_slug")
      .or(`title.ilike.${like},description.ilike.${like}`)
      .limit(6),
    supabase
      .from("creator_public_profiles")
      .select("user_id, username, display_name, headline")
      .or(`display_name.ilike.${like},headline.ilike.${like}`)
      .limit(3),
  ]);

  return Response.json(
    {
      courses: (courses.data ?? []).map((row) => {
        const record = row as Record<string, unknown>;
        const pricePaise = Number(record.price_paise ?? 0);
        return {
          id: String(record.id),
          href: `/courses/${record.slug}`,
          title: String(record.title),
          meta: `${pricePaise === 0 ? "Free" : formatInr(pricePaise)} · ${String(record.level ?? "beginner")}`,
          thumbnail: record.thumbnail_key ? `/api/media/thumbnail?key=${encodeURIComponent(String(record.thumbnail_key))}` : "",
        };
      }),
      instructors: (instructors.data ?? []).map((row) => {
        const record = row as Record<string, unknown>;
        const name = String(record.display_name ?? "Zybble creator");
        return {
          id: String(record.user_id),
          href: `/instructors/${record.username}`,
          name,
          headline: String(record.headline ?? ""),
          initials: name.split(" ").map((part) => part[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "Z",
        };
      }),
    },
    { status: 200, headers: rateLimitHeaders(limit) }
  );
}