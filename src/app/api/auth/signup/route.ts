import { defineRoute } from "@/lib/api/http";
import { signUp } from "@/features/auth/service";
import { signupSchema } from "@/lib/validation/auth";
import { writeAudit } from "@/features/workspaces/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * POST /api/auth/signup
 *
 * Rate limited hard by IP: unauthenticated account creation is the classic
 * abuse vector. Onboarding (workspace creation) happens afterwards, once the
 * session exists.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = defineRoute(
  {
    auth: "none",
    body: signupSchema,
    rateLimit: { limit: 5, windowMs: 15 * 60_000 },
    scope: "auth:signup",
    status: 201,
  },
  async ({ body, req }) => {
    const result = await signUp({
      email: body!.email,
      password: body!.password,
      fullName: body!.fullName,
      timezone: body!.timezone,
      redirectTo: body!.redirectTo,
    });

    if (result.sessionState) {
      const supabase = await createSupabaseServerClient();
      await writeAudit(supabase, {
        action: "auth.signup",
        actorType: "user",
        actorUserId: result.userId,
        entityType: "user",
        entityId: result.userId,
        metadata: { emailDomain: body!.email.split("@")[1] ?? null },
        ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        userAgent: req.headers.get("user-agent"),
      });
    }

    return result;
  },
);
