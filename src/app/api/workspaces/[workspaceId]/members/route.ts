import { defineRoute } from "@/lib/api/http";
import { inviteMember, listMembers } from "@/features/workspaces/service";
import { workspaceContext } from "@/lib/api/workspace";
import { inviteMemberSchema } from "@/lib/validation/posts";
import { assertCanManage, writeAudit } from "@/features/workspaces/access";

/**
 * /api/workspaces/[workspaceId]/members
 *
 * GET  — the roster, including pending invitations.
 * POST — invite by email. Pro only beyond the owner: the entitlement is checked
 *        here and enforced again by the seat-sync job, which bills active
 *        members.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = defineRoute(
  {
    auth: "required",
    rateLimit: { limit: 120, windowMs: 60_000 },
    scope: "members:list",
  },
  async ({ supabase, params }) => {
    const context = await workspaceContext({
      supabase,
      user: null,
      workspaceId: params.workspaceId ?? null,
    });

    const members = await listMembers(context);

    return {
      members,
      role: context.role,
      seats: context.workspace.seats,
    };
  },
);

export const POST = defineRoute(
  {
    auth: "required",
    body: inviteMemberSchema,
    rateLimit: { limit: 20, windowMs: 60_000 },
    scope: "members:invite",
    status: 201,
  },
  async ({ supabase, body, params, requestId }) => {
    const context = await workspaceContext({
      supabase,
      user: null,
      workspaceId: params.workspaceId ?? null,
      minimumRole: "admin",
    });

    assertCanManage(context);

    const result = await inviteMember(context, { email: body!.email, role: body!.role });

    await writeAudit(supabase!, {
      workspaceId: context.workspace.id,
      actorUserId: context.user.id,
      action: "member.invited",
      entityType: "workspace_member",
      entityId: result.invitation.id,
      metadata: { role: body!.role },
      requestId,
    });

    return result;
  },
);
