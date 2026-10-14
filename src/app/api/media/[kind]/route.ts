import { getObjectStream } from "@/lib/server/r2";
import { isR2Configured } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const KINDS: Record<string, "thumbnail" | "avatar"> = {
  thumbnails: "thumbnail",
  avatars: "avatar",
};

/**
 * Streams a private R2 image through the app so the bucket never has to be
 * public. Thumbnails and avatars are marketing imagery, not paid content, but
 * they are still served with an explicit content type and no directory listing.
 */
export async function GET(request: Request, context: { params: Promise<{ kind: string }> }) {
  const { kind: kindParam } = await context.params;
  const kind = KINDS[kindParam];
  if (!kind) return Response.json({ error: "Not found" }, { status: 404 });

  if (!isR2Configured()) {
    return Response.json({ error: "Image storage is not configured" }, { status: 503 });
  }

  const key = new URL(request.url).searchParams.get("key");
  if (!key || key.length > 400 || key.includes("..") || key.startsWith("/")) {
    return Response.json({ error: "Invalid key" }, { status: 400 });
  }

  try {
    const object = await getObjectStream(key);
    const body = object.Body as ReadableStream | undefined;
    if (!body) return Response.json({ error: "Not found" }, { status: 404 });

    const contentType = String(object.ContentType ?? "application/octet-stream");
    // Only images may ever be rendered inline from this route.
    const safeType = contentType.startsWith("image/") ? contentType : "application/octet-stream";

    return new Response(body, {
      headers: {
        "Content-Type": safeType,
        "Content-Length": String(object.ContentLength ?? 0),
        "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
      },
    });
  } catch {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
}
