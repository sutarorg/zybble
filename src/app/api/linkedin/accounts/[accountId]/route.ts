import { defineRoute } from "@/lib/api/http";
import { disconnect, recheckConnection } from "@/features/linkedin/service";
import { requestedWorkspaceId, workspaceContext } from "@/lib/api/workspace";
import { assertCanManage, writeAudit } from "@/features/workspaces/access";

/**
 * /api/linkedin/accounts/[accountId]
 *
 * POST   — re-verify the stored credential against LinkedIn (one API call).
 * DELETE — disconnect: credentials are deleted first, then the account row is
 *          marked revoked. Scheduled posts for that account stay in place and
 *          are reported as blocked rather than silently deleted.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = defineRoute(
  {
    auth: "required",
    rateLimit: { limit: 20, windowMs: 60_000 },
    scope: "linkedin:recheck",
  },
  async ({ supabase, req, params }) => {
    const context = await workspaceContext({
      supabase,
      user: null,
      workspaceId: requestedWorkspaceId(req),
      minimumRole: "admin",
    });

    assertCanManage(context);

    return recheckConnection(context, params.accountId!);
  },
);

export const DELETE = defineRoute(
  {
    auth: "required",
    rateLimit: { limit: 20, windowMs: 60_000 },
    scope: "linkedin:disconnect",
  },
  async ({ supabase, req, params, requestId }) => {
    const context = await workspaceContext({
      supabase,
      user: null,
      workspaceId: requestedWorkspaceId(req),
      minimumRole: "admin",
    });

    assertCanManage(context);

    const result = await disconnect(context, params.accountId!);

    await writeAudit(supabase!, {
      workspaceId: context.workspace.id,
      actorUserId: context.user.id,
      action: "linkedin.disconnected",
      entityType: "linkedin_account",
      entityId: params.accountId!,
      requestId,
    });

    return result;
  },
);
