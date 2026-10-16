import { z } from "zod";
import { requireServiceClient, getSession, AuthorizationError } from "@/lib/server/session";
import {
  buildObjectKey,
  createPresignedDownloadUrl,
  createPresignedUploadUrl,
  validateUpload,
  type UploadKind,
} from "@/lib/server/r2";
import { isR2Configured } from "@/lib/env";
import { clientKey, LIMITS, rateLimit, rateLimitHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const uploadSchema = z.object({
  kind: z.enum(["thumbnail", "resource", "avatar"]),
  courseId: z.string().uuid().optional(),
  fileName: z.string().min(1).max(200),
  contentType: z.string().min(1).max(120),
  sizeBytes: z.number().int().positive(),
  title: z.string().max(200).optional(),
});

const downloadSchema = z.object({ resourceId: z.string().uuid() });

/**
 * Private object storage.
 *
 * `action: "upload"`   -> pre-signed PUT for the caller's own namespace.
 * `action: "download"` -> pre-signed GET, issued only after verifying that the
 *                         caller either owns the course or holds an active
 *                         entitlement to it.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Authentication required" }, { status: 401 });

  if (!isR2Configured()) {
    return Response.json({ error: "File storage is not configured yet" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const action = (body as { action?: unknown })?.action;

  try {
    if (action === "upload") return await handleUpload(request, body, session);
    if (action === "download") return await handleDownload(request, body, session);
    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("[storage] failed", {
      user: session.id,
      reason: error instanceof Error ? error.message.slice(0, 200) : "unknown",
    });
    return Response.json({ error: "Storage is temporarily unavailable" }, { status: 500 });
  }
}

async function handleUpload(request: Request, body: unknown, session: Awaited<ReturnType<typeof getSession>> & object) {
  const parsed = uploadSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const { kind, courseId, fileName, contentType, sizeBytes, title } = parsed.data;

  const limit = rateLimit(
    clientKey(request, "storage-upload", session.id),
    LIMITS.resourceUpload.limit,
    LIMITS.resourceUpload.windowMs
  );
  if (!limit.allowed) {
    return Response.json({ error: "Too many uploads" }, { status: 429, headers: rateLimitHeaders(limit) });
  }

  const invalid = validateUpload(kind as UploadKind, { type: contentType, size: sizeBytes });
  if (invalid) return Response.json({ error: invalid }, { status: 400 });

  if (kind !== "avatar" && !session.creator) {
    return Response.json({ error: "Only creators can upload course files" }, { status: 403 });
  }

  const service = requireServiceClient();

  if (courseId) {
    const { data: course } = await service.from("courses").select("id, creator_id").eq("id", courseId).maybeSingle();
    if (!course) return Response.json({ error: "Course not found" }, { status: 404 });
    if (course.creator_id !== session.id) {
      return Response.json({ error: "You do not own this course" }, { status: 403 });
    }
  }

  const key = buildObjectKey({
    ownerId: session.id,
    courseId: courseId ?? null,
    kind: kind as UploadKind,
    fileName,
  });

  const url = await createPresignedUploadUrl(key, contentType, sizeBytes);

  // Thumbnails and resources attach straight to their owner record. An avatar
  // deliberately does not: it is confirmed by `updateAvatar` only after the
  // browser's PUT has actually landed, so a failed upload can never leave a
  // profile pointing at an object that does not exist.
  if (kind === "avatar") {
    // Nothing to persist yet — the response carries the key back to the caller.
  } else if (kind === "thumbnail" && courseId) {
    await service.from("courses").update({ thumbnail_key: key }).eq("id", courseId).eq("creator_id", session.id);
  } else if (kind === "resource" && courseId) {
    await service.from("course_resources").insert({
      course_id: courseId,
      title: title ?? fileName,
      object_key: key,
      file_name: fileName,
      content_type: contentType,
      size_bytes: sizeBytes,
    });
  }

  return Response.json({ key, url, expiresInSeconds: 15 * 60 }, { status: 201, headers: rateLimitHeaders(limit) });
}

async function handleDownload(request: Request, body: unknown, session: Awaited<ReturnType<typeof getSession>> & object) {
  const parsed = downloadSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });

  const limit = rateLimit(
    clientKey(request, "storage-download", session.id),
    LIMITS.download.limit,
    LIMITS.download.windowMs
  );
  if (!limit.allowed) {
    return Response.json({ error: "Too many download requests" }, { status: 429, headers: rateLimitHeaders(limit) });
  }

  const service = requireServiceClient();
  const { data: resource } = await service
    .from("course_resources")
    .select("id, course_id, object_key, file_name, courses ( creator_id, status )")
    .eq("id", parsed.data.resourceId)
    .maybeSingle();

  const course = (resource?.courses ?? null) as { creator_id: string; status: string } | null;
  if (!resource || !course) return Response.json({ error: "Resource not found" }, { status: 404 });

  if (course.creator_id !== session.id) {
    // Not the owner: fall through to an entitlement check.
    const { data: entitlement } = await service
      .from("entitlements")
      .select("id")
      .eq("user_id", session.id)
      .eq("course_id", resource.course_id)
      .is("revoked_at", null)
      .maybeSingle();

    if (!entitlement) {
      return Response.json({ error: "You need to enroll to download this file" }, { status: 403 });
    }
  }

  const url = await createPresignedDownloadUrl(resource.object_key, resource.file_name);
  return Response.json({ url, expiresInSeconds: 10 * 60 }, { status: 200, headers: rateLimitHeaders(limit) });
}
