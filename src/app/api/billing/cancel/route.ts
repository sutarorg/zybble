import { z } from "zod";
import { defineRoute } from "@/lib/api/http";
import { requestCancellation } from "@/features/billing/checkout";
import { requestedWorkspaceId, workspaceContext } from "@/lib/api/workspace";

/**
 * POST /api/billing/cancel
 *
 * Requests cancellation at period end (default): the workspace keeps Pro until
 * the paid period closes, then `effectivePlan()` drops it to Free automatically.
 * The local row is updated by the webhook, not here — so "cancelled" in the UI
 * always reflects what Dodo confirmed.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cancelSchema = z
  .object({ immediately: z.boolean().default(false) })
  .default({ immediately: false });

export const POST = defineRoute(
  {
    auth: "required",
    body: cancelSchema,
    rateLimit: { limit: 10, windowMs: 60_000 },
    scope: "billing:cancel",
  },
  async ({ supabase, req, body }) => {
    const context = await workspaceContext({
      supabase,
      user: null,
      workspaceId: requestedWorkspaceId(req),
      minimumRole: "admin",
    });

    return requestCancellation(context, { immediately: body?.immediately ?? false });
  },
);
