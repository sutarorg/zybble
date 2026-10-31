import { defineRoute } from "@/lib/api/http";
import { countActiveMembers, syncSeats } from "@/features/billing/seats";
import { requestedWorkspaceId, workspaceContext } from "@/lib/api/workspace";
import { PRO_SEAT_PRICE_CENTS, monthlyAmountCents } from "@/features/billing/entitlements";

/**
 * /api/billing/seats
 *
 * Seat definition (shown on the billing screen): **one seat = one active member
 * of the workspace**, minimum one. Pending invitations are not billed; removed
 * members are not billed.
 *
 * GET  — the current count and what it costs.
 * POST — recompute and push it to Dodo (the same job the membership events
 *        enqueue, so a manual retry is always available).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = defineRoute(
  {
    auth: "required",
    rateLimit: { limit: 60, windowMs: 60_000 },
    scope: "billing:seats",
  },
  async ({ supabase, req }) => {
    const context = await workspaceContext({
      supabase,
      user: null,
      workspaceId: requestedWorkspaceId(req),
      minimumRole: "admin",
    });

    const seats = await countActiveMembers(context.workspace.id);

    return {
      seats,
      seatPriceCents: PRO_SEAT_PRICE_CENTS,
      monthlyAmountCents: monthlyAmountCents(seats),
      definition: "One seat = one active member of this workspace (minimum 1).",
    };
  },
);

export const POST = defineRoute(
  {
    auth: "required",
    rateLimit: { limit: 10, windowMs: 60_000 },
    scope: "billing:seats-sync",
  },
  async ({ supabase, req }) => {
    const context = await workspaceContext({
      supabase,
      user: null,
      workspaceId: requestedWorkspaceId(req),
      minimumRole: "admin",
    });

    return syncSeats({ workspaceId: context.workspace.id, actorUserId: context.user.id });
  },
);
