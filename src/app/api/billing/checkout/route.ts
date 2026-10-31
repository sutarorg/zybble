import { defineRoute } from "@/lib/api/http";
import { startProCheckout } from "@/features/billing/checkout";
import { requestedWorkspaceId, workspaceContext } from "@/lib/api/workspace";
import { checkoutSchema } from "@/lib/validation/posts";

/**
 * POST /api/billing/checkout
 *
 * Returns the Dodo-hosted checkout URL. The seat count is computed from active
 * workspace members — never from the request — and `metadata.workspace_id` is
 * attached to the session so every webhook can identify the workspace without
 * trusting anything the browser said.
 *
 * No entitlement changes here: the workspace becomes Pro when the verified
 * `subscription.active` webhook lands.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = defineRoute(
  {
    auth: "required",
    body: checkoutSchema,
    rateLimit: { limit: 10, windowMs: 60_000 },
    scope: "billing:checkout",
  },
  async ({ supabase, req, body }) => {
    const context = await workspaceContext({
      supabase,
      user: null,
      workspaceId: requestedWorkspaceId(req),
      minimumRole: "admin",
    });

    return startProCheckout(context, {
      returnPath: body!.returnPath,
    });
  },
);
