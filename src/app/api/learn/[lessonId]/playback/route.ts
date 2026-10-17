import { z } from "zod";
import { getSession, requireServiceClient } from "@/lib/server/session";
import { buildPlaybackUrl } from "@/lib/server/bunny";
import { isBunnyConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({ lessonId: z.string().uuid() });

/**
 * Authorised lesson playback.
 *
 * Access is granted when **either**:
 *   - the caller holds an active entitlement to the course, or
 *   - the lesson is flagged as a free preview on a published course.
 *
 * A guessed lesson URL is not enough: both the entitlement and the preview flag
 * are checked against the database on every request, and the returned link is
 * short-lived and token-signed.
 */
export async function POST(request: Request, context: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await context.params;
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in to watch this lesson" }, { status: 401 });

  if (!isBunnyConfigured()) {
    return Response.json({ error: "Video hosting is not configured yet" }, { status: 503 });
  }

  const parsed = schema.safeParse({ lessonId });
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });

  const service = requireServiceClient();
  const { data: lesson } = await service
    .from("lessons")
    .select("id, title, is_preview, bunny_video_id, bunny_status, bunny_playback_ready, course_id, courses ( title, status, creator_id )")
    .eq("id", lessonId)
    .maybeSingle();

  const course = (lesson?.courses ?? null) as { title: string; status: string; creator_id?: string } | null;
  if (!lesson || !course) return Response.json({ error: "Lesson not found" }, { status: 404 });

  const isPreview = Boolean(lesson.is_preview) && course.status === "published";
  const isOwnerOrStaff =
    course.creator_id === session.id || session.role === "admin" || session.role === "moderator";

  if (!isPreview && !isOwnerOrStaff) {
    const { data: entitlement } = await service
      .from("entitlements")
      .select("id")
      .eq("user_id", session.id)
      .eq("course_id", lesson.course_id)
      .is("revoked_at", null)
      .maybeSingle();
    if (!entitlement) {
      return Response.json({ error: "You have not enrolled in this course" }, { status: 403 });
    }
  }

  if (!lesson.bunny_video_id) return Response.json({ error: "This lesson has no video yet" }, { status: 404 });
  if (!lesson.bunny_playback_ready || lesson.bunny_status !== "ready") {
    return Response.json(
      { error: "This video is still processing", status: lesson.bunny_status ?? "processing" },
      { status: 409 }
    );
  }

  const { url, expires } = buildPlaybackUrl(lesson.bunny_video_id);
  return Response.json({ url, expires, title: lesson.title, courseTitle: course.title });
}
