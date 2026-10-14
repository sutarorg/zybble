import { z } from "zod";
import { requireCreator, requireServiceClient, AuthorizationError } from "@/lib/server/session";
import { buildUploadGrant, createVideo, validateVideoFile } from "@/lib/server/bunny";
import { isBunnyConfigured } from "@/lib/env";
import { clientKey, LIMITS, rateLimit, rateLimitHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  lessonId: z.string().uuid(),
  fileName: z.string().min(1).max(200),
  contentType: z.string().min(1).max(80),
  sizeBytes: z.number().int().positive(),
});

/**
 * Creates a Bunny Stream video object and returns a short-lived, video-scoped
 * pre-signed TUS grant so the browser can upload bytes straight to Bunny.
 *
 * The library API key is never sent to the client. Ownership is verified here:
 * the caller must own the course that owns the lesson.
 */
export async function POST(request: Request) {
  let session;
  try {
    session = await requireCreator();
  } catch (error) {
    return authErrorResponse(error);
  }

  const limit = rateLimit(
    clientKey(request, "video-grant", session.id),
    LIMITS.videoUploadGrant.limit,
    LIMITS.videoUploadGrant.windowMs
  );
  if (!limit.allowed) {
    return Response.json({ error: "Too many upload attempts" }, { status: 429, headers: rateLimitHeaders(limit) });
  }

  if (!isBunnyConfigured()) {
    return Response.json(
      { error: "Video hosting is not configured yet. Course videos cannot be uploaded." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });

  const { lessonId, fileName, contentType, sizeBytes } = parsed.data;
  const invalid = validateVideoFile({ type: contentType, size: sizeBytes });
  if (invalid) return Response.json({ error: invalid }, { status: 400 });

  const service = requireServiceClient();

  // Ownership: the lesson must belong to a course the caller owns.
  const { data: lesson } = await service
    .from("lessons")
    .select("id, title, course_id, courses ( id, creator_id, title )")
    .eq("id", lessonId)
    .maybeSingle();

  const course = (lesson?.courses ?? null) as { id: string; creator_id: string; title: string } | null;
  if (!lesson || !course) return Response.json({ error: "Lesson not found" }, { status: 404 });
  if (course.creator_id !== session.id) {
    return Response.json({ error: "You do not own this course" }, { status: 403 });
  }

  const video = await createVideo(fileName.replace(/\.[a-z0-9]+$/i, "") || lesson.title, undefined);
  const grant = buildUploadGrant(video.guid);

  // Record the pending upload immediately so the lesson never shows a video
  // that was never actually attached.
  await service
    .from("lessons")
    .update({ bunny_video_id: video.guid, bunny_status: "uploading", bunny_playback_ready: false })
    .eq("id", lessonId);

  return Response.json({ ...grant, title: fileName }, { status: 201, headers: rateLimitHeaders(limit) });
}

function authErrorResponse(error: unknown): Response {
  if (error instanceof AuthorizationError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return Response.json({ error: "Authentication required" }, { status: 401 });
}
