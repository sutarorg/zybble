import { defineRoute } from "@/lib/api/http";
import { openBillingPortal } from "@/features/billing/checkout";
import { requestedWorkspaceId, workspaceContext } from "@/lib/api/workspace";

/**
 * POST /api/billing/portal — Dodo's hosted customer portal (cards, invoices,
 * cancellation). The portal link is created server-side from the stored Dodo
 * customer id; the browser never supplies one.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = defineRoute(
  {
    auth: "required",
    rateLimit: { limit: 10, windowMs: 60_000 },
    scope: "billing:portal",
  },
  async ({ supabase, req }) => {
    const context = await workspaceContext({
      supabase,
      user: null,
      workspaceId: requestedWorkspaceId(req),
      minimumRole: "admin",
    });

    return openBillingPortal(context);
  },
);
