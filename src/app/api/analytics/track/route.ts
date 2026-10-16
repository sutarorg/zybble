import { z } from "zod";
import { isServiceRoleConfigured, isSupabaseConfigured } from "@/lib/env";
import { clientKey, LIMITS, rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { getSession } from "@/lib/server/session";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const eventSchema = z.object({
  courseId: z.string().uuid(),
  kind: z.enum(["impression", "view", "watch"]),
  lessonId: z.string().uuid().optional(),
  /** Whole seconds credited by one playback heartbeat. */
  seconds: z.number().int().min(1).max(900).optional(),
  source: z.string().trim().max(40).optional(),
});

const bodySchema = z.object({
  events: z.array(eventSchema).min(1).max(40),
});

/**
 * Catalog engagement beacons behind creator analytics.
 *
 * The browser is untrusted here exactly as it is everywhere else in Zybble, so
 * every event is re-checked before it is stored:
 *
 *   - the course must exist **and be published** — a draft cannot collect reach,
 *     and a guessed uuid cannot pollute somebody else's numbers;
 *   - a `watch` event must carry a signed-in session and a lesson that really
 *     belongs to that course, because playback is authorised per request;
 *   - seconds are capped per event, so one beacon cannot claim a year of viewing.
 *
 * Writes go through the service role because `course_events` is granted to no
 * browser role at all; the checks above *are* the authorisation. Failures return
 * 204 rather than an error: dropping telemetry is acceptable, and a noisy
 * response would only teach a caller which ids exist.
 */
export async function POST(request: Request) {
  if (!isSupabaseConfigured() || !isServiceRoleConfigured()) {
    return new Response(null, { status: 204 });
  }

  const limit = rateLimit(clientKey(request, "analytics"), LIMITS.analytics.limit, LIMITS.analytics.windowMs);
  if (!limit.allowed) return new Response(null, { status: 204, headers: rateLimitHeaders(limit) });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 204 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return new Response(null, { status: 204 });

  const session = await getSession();
  const service = createServiceClient();
  if (!service) return new Response(null, { status: 204 });

  // Watch time belongs to a learner session; impressions and views are public.
  const events = parsed.data.events.filter((event) => event.kind !== "watch" || Boolean(session));
  if (events.length === 0) return new Response(null, { status: 204 });

  const courseIds = [...new Set(events.map((event) => event.courseId))];
  const { data: courses } = await service
    .from("courses")
    .select("id, status")
    .in("id", courseIds);
  const published = new Set(
    ((courses ?? []) as Array<{ id: string; status: string }>)
      .filter((course) => course.status === "published")
      .map((course) => course.id)
  );
  if (published.size === 0) return new Response(null, { status: 204 });

  // A lesson id is only accepted for the course it actually belongs to.
  const lessonIds = [
    ...new Set(events.filter((event) => event.lessonId).map((event) => event.lessonId as string)),
  ];
  const lessonCourse = new Map<string, string>();
  if (lessonIds.length > 0) {
    const { data: lessons } = await service.from("lessons").select("id, course_id").in("id", lessonIds);
    for (const lesson of (lessons ?? []) as Array<{ id: string; course_id: string }>) {
      lessonCourse.set(lesson.id, lesson.course_id);
    }
  }

  const rows = events.flatMap((event) => {
    if (!published.has(event.courseId)) return [];
    const isWatch = event.kind === "watch";

    if (isWatch) {
      if (!event.lessonId || !event.seconds) return [];
      if (lessonCourse.get(event.lessonId) !== event.courseId) return [];
    }

    return [
      {
        course_id: event.courseId,
        kind: event.kind,
        actor_id: session?.id ?? null,
        lesson_id: isWatch ? event.lessonId : null,
        seconds: isWatch ? Math.min(900, Math.max(1, Math.round(event.seconds ?? 0))) : 0,
        source: (event.source ?? null) as string | null,
      },
    ];
  });

  if (rows.length === 0) return new Response(null, { status: 204 });

  const { error } = await service.from("course_events").insert(rows);
  if (error) {
    console.error("[analytics] could not record events", { reason: error.message.slice(0, 200) });
  }

  return new Response(null, { status: 204, headers: rateLimitHeaders(limit) });
}
