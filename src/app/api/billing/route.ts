import { defineRoute } from "@/lib/api/http";
import { getBillingState } from "@/features/billing/checkout";
import { entitlementsFor } from "@/features/billing/entitlements";
import { requestedWorkspaceId, workspaceContext } from "@/lib/api/workspace";

/**
 * GET /api/billing — the workspace's subscription as *we* record it.
 *
 * The authoritative source is `public.subscriptions`, written only by verified
 * Dodo webhooks and the reconciler. Nothing here reads a client claim.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = defineRoute(
  {
    auth: "required",
    rateLimit: { limit: 60, windowMs: 60_000 },
    scope: "billing:read",
  },
  async ({ supabase, req }) => {
    const context = await workspaceContext({
      supabase,
      user: null,
      workspaceId: requestedWorkspaceId(req),
      minimumRole: "admin",
    });

    const state = await getBillingState(context);

    return {
      ...state,
      entitlements: entitlementsFor(context.workspace.plan),
      role: context.role,
    };
  },
);
