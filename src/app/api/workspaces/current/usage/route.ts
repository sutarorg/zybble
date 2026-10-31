import { defineRoute } from "@/lib/api/http";
import { getUsage } from "@/features/workspaces/service";
import { workspaceContext } from "@/lib/api/workspace";

/**
 * GET /api/workspaces/current/usage
 *
 * Convenience alias for the active workspace (cookie → first membership). It
 * exists so the client never has to resolve a workspace id before reading
 * usage, and so a stale id in the URL cannot leak another workspace's numbers.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = defineRoute(
  {
    auth: "required",
    rateLimit: { limit: 120, windowMs: 60_000 },
    scope: "workspaces:usage",
  },
  async ({ supabase }) => {
    const context = await workspaceContext({ supabase, user: null, workspaceId: null });
    return getUsage(context);
  },
);
