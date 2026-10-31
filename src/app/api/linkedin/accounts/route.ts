import { defineRoute } from "@/lib/api/http";
import { listConnections } from "@/features/linkedin/service";
import { workspaceContext } from "@/lib/api/workspace";

/**
 * GET /api/linkedin/accounts
 *
 * Returns the workspace's connections plus the capability set the app is
 * actually allowed to request right now: `w_member_social` for publishing and,
 * only when Community Management API access has been granted and
 * `LINKEDIN_ANALYTICS_SCOPE_ENABLED=true`, `r_member_postAnalytics`.
 *
 * No capability is ever implied — if the scope was not granted, the UI shows a
 * gated state with the reason.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = defineRoute(
  {
    auth: "required",
    rateLimit: { limit: 120, windowMs: 60_000 },
    scope: "linkedin:list",
  },
  async ({ supabase, req }) => {
    const { requestedWorkspaceId } = await import("@/lib/api/workspace");

    const context = await workspaceContext({
      supabase,
      user: null,
      workspaceId: requestedWorkspaceId(req),
    });

    return listConnections(context);
  },
);
