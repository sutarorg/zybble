import { z } from "zod";
import { markNotificationsRead } from "@/app/(learner)/actions";

export const dynamic = "force-dynamic";

const schema = z.object({ ids: z.array(z.string().uuid()).max(100) });

/** Marks the caller's own notifications as read (RLS scopes the update). */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });

  const result = await markNotificationsRead(parsed.data.ids);
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
