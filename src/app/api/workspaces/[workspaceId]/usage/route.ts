import { defineRoute } from "@/lib/api/http";
import { getUsage } from "@/features/workspaces/service";
import { workspaceContext } from "@/lib/api/workspace";

/**
 * GET /api/workspaces/[workspaceId]/usage
 *
 * Reads the same `usage_counters` row the scheduling trigger maintains, so the
 * number shown to the user can never disagree with the number that blocks a
 * schedule.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = defineRoute(
  {
    auth: "required",
    rateLimit: { limit: 120, windowMs: 60_000 },
    scope: "workspaces:usage",
  },
  async ({ supabase, params }) => {
    const context = await workspaceContext({
      supabase,
      user: null,
      workspaceId: params.workspaceId ?? null,
    });

    return getUsage(context);
  },
);
