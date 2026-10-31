import { defineRoute } from "@/lib/api/http";
import { completeOnboarding } from "@/features/auth/service";
import { onboardingSchema } from "@/lib/validation/auth";
import { requireUser, writeAudit } from "@/features/workspaces/access";

/**
 * POST /api/auth/onboarding — create the first workspace.
 *
 * Workspace creation is a single RPC (`public.create_workspace`) so the
 * workspace, its owner membership, subscription row and usage counter all
 * appear together or not at all.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = defineRoute(
  {
    auth: "required",
    body: onboardingSchema,
    rateLimit: { limit: 10, windowMs: 60_000 },
    scope: "auth:onboarding",
    status: 201,
  },
  async ({ body, supabase, user }) => {
    const currentUser = await requireUser(supabase);

    const result = await completeOnboarding({
      userId: currentUser.id,
      workspaceName: body!.workspaceName,
      timezone: body!.timezone,
      fullName: body!.fullName,
    });

    await writeAudit(supabase!, {
      workspaceId: result.workspace.id,
      actorUserId: currentUser.id,
      action: "workspace.created",
      entityType: "workspace",
      entityId: result.workspace.id,
    });

    void user;
    return result.sessionState;
  },
);
