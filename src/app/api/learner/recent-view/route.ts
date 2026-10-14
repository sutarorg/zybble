import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/server/session";

export const dynamic = "force-dynamic";

const schema = z.object({ courseId: z.string().uuid() });

/** Records a published course in the signed-in learner's recent history. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return new Response(null, { status: 204 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });

  const supabase = await createServerClient();
  // Only published courses can appear in history, and RLS scopes the row to
  // the caller.
  const { data: course } = await supabase.from("courses").select("status").eq("id", parsed.data.courseId).maybeSingle();
  if (course?.status !== "published") return new Response(null, { status: 204 });

  await supabase
    .from("recent_course_views")
    .upsert(
      { user_id: session.id, course_id: parsed.data.courseId, viewed_at: new Date().toISOString() },
      { onConflict: "user_id,course_id" }
    );

  return new Response(null, { status: 204 });
}
