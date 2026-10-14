import { z } from "zod";
import { requireCreator, requireServiceClient, AuthorizationError } from "@/lib/server/session";
import { fetchVideo, mapBunnyStatus } from "@/lib/server/bunny";
import { isBunnyConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({ lessonId: z.string().uuid() });

/**
 * Returns the real Bunny encoding state for a lesson. A video is only reported
 * playable when Bunny itself reports `Finished` / `Resolution finished`.
 */
export async function POST(request: Request) {
  let session;
  try {
    session = await requireCreator();
  } catch (error) {
    return error instanceof AuthorizationError
      ? Response.json({ error: error.message }, { status: error.status })
      : Response.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!isBunnyConfigured()) {
    return Response.json({ error: "Video hosting is not configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });

  const service = requireServiceClient();
  const { data: lesson } = await service
    .from("lessons")
    .select("id, bunny_video_id, bunny_status, course_id, courses ( creator_id )")
    .eq("id", parsed.data.lessonId)
    .maybeSingle();

  const course = (lesson?.courses ?? null) as { creator_id: string } | null;
  if (!lesson || !course) return Response.json({ error: "Lesson not found" }, { status: 404 });
  if (course.creator_id !== session.id) {
    return Response.json({ error: "You do not own this course" }, { status: 403 });
  }
  if (!lesson.bunny_video_id) {
    return Response.json({ status: "uploading", ready: false, durationSeconds: null });
  }

  try {
    const video = await fetchVideo(lesson.bunny_video_id);
    const state = mapBunnyStatus(video.status);
    const ready = state === "ready";

    await service
      .from("lessons")
      .update({
        bunny_status: state,
        bunny_playback_ready: ready,
        bunny_duration_seconds: video.duration ? Math.round(video.duration) : null,
      })
      .eq("id", lesson.id);

    return Response.json({ status: state, ready, durationSeconds: video.duration ?? null });
  } catch {
    return Response.json({ error: "Video provider is temporarily unreachable" }, { status: 503 });
  }
}
