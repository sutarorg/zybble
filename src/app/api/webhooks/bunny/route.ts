import { serverEnv } from "@/lib/env";
import { requireServiceClient } from "@/lib/server/session";
import { mapBunnyStatus, verifyBunnyWebhookSignature, type BunnyWebhookEvent } from "@/lib/server/bunny";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Bunny Stream webhook receiver.
 *
 * Signing secret is the library's Read-Only API key. Only the exact raw body is
 * signed, and the comparison is constant time. A video is never treated as
 * playable until Bunny reports `Finished` (3) or `Resolution finished` (4).
 */
export async function POST(request: Request) {
  if (!serverEnv.bunnyApiKey) {
    return Response.json({ error: "Bunny is not configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  const valid = verifyBunnyWebhookSignature({
    rawBody,
    signature: request.headers.get("x-bunnystream-signature"),
    version: request.headers.get("x-bunnystream-signature-version"),
    algorithm: request.headers.get("x-bunnystream-signature-algorithm"),
    secret: serverEnv.bunnyApiKey,
  });

  if (!valid) return Response.json({ error: "invalid signature" }, { status: 401 });

  let event: BunnyWebhookEvent;
  try {
    event = JSON.parse(rawBody) as BunnyWebhookEvent;
  } catch {
    return Response.json({ error: "invalid payload" }, { status: 400 });
  }
  if (!event?.VideoGuid) return Response.json({ error: "missing video id" }, { status: 400 });

  const state = mapBunnyStatus(event.Status);
  const service = requireServiceClient();

  const { data: lesson } = await service
    .from("lessons")
    .select("id, course_id")
    .eq("bunny_video_id", event.VideoGuid)
    .maybeSingle();

  if (!lesson) {
    // Unknown video (deleted lesson, or another environment's library).
    return Response.json({ status: "ignored" }, { status: 200 });
  }

  await service
    .from("lessons")
    .update({ bunny_status: state, bunny_playback_ready: state === "ready" })
    .eq("id", lesson.id);

  if (state === "error") {
    await service.from("notifications").insert({
      user_id: (await service.from("courses").select("creator_id").eq("id", lesson.course_id).maybeSingle()).data
        ?.creator_id as string,
      kind: "system",
      title: "Video processing failed",
      body: "One of your lesson videos could not be encoded. Please re-upload it.",
      href: "/creator/courses",
    });
  }

  return Response.json({ status: "ok" });
}
