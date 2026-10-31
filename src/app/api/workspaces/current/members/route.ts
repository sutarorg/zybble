import { defineRoute } from "@/lib/api/http";
import { inviteMember, listMembers } from "@/features/workspaces/service";
import { workspaceContext } from "@/lib/api/workspace";
import { inviteMemberSchema } from "@/lib/validation/posts";
import { assertCanManage, writeAudit } from "@/features/workspaces/access";

/**
 * /api/workspaces/current/members — roster and invitations for the workspace
 * resolved from the session cookie, so the browser never supplies an id.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = defineRoute(
  {
    auth: "required",
    rateLimit: { limit: 120, windowMs: 60_000 },
    scope: "members:list",
  },
  async ({ supabase }) => {
    const context = await workspaceContext({ supabase, user: null, workspaceId: null });

    return {
      members: await listMembers(context),
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
  async ({ supabase, body, requestId }) => {
    const context = await workspaceContext({
      supabase,
      user: null,
      workspaceId: null,
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

    return { member: result.invitation, emailQueued: result.inviteUrl !== null };
  },
);
