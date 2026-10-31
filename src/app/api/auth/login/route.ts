import { defineRoute } from "@/lib/api/http";
import { signIn } from "@/features/auth/service";
import { loginSchema } from "@/lib/validation/auth";
import { writeAudit } from "@/features/workspaces/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** POST /api/auth/login — password grant, IP-rate-limited against brute force. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = defineRoute(
  {
    auth: "none",
    body: loginSchema,
    rateLimit: { limit: 10, windowMs: 5 * 60_000 },
    scope: "auth:login",
  },
  async ({ body, req }) => {
    const state = await signIn({ email: body!.email, password: body!.password });

    const supabase = await createSupabaseServerClient();
    await writeAudit(supabase, {
      action: "auth.login",
      actorType: "user",
      actorUserId: state.user.id,
      entityType: "user",
      entityId: state.user.id,
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: req.headers.get("user-agent"),
    });

    return state;
  },
);
