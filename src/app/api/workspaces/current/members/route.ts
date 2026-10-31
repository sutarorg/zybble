import { defineRoute } from "@/lib/api/http";
import { listMembers } from "@/features/workspaces/service";
import { workspaceContext } from "@/lib/api/workspace";

/**
 * GET /api/workspaces/current/members — roster of the active workspace.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = defineRoute(
  {
    auth: "required",
    rateLimit: { limit: 120, windowMs: 60_000 },
    scope: "members:list",
  },
  async ({ supabase }) => {
    const context = await workspaceContext({ supabase, user: null, workspaceId: null });

    return {
      members: await listMembers(context),
      role: context.role,
      seats: context.workspace.seats,
    };
  },
);
