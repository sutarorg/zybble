import { defineRoute } from "@/lib/api/http";
import { removeMember, updateMemberRole } from "@/features/workspaces/service";
import { workspaceContext } from "@/lib/api/workspace";
import { updateMemberRoleSchema } from "@/lib/validation/posts";
import { assertCanManage, writeAudit } from "@/features/workspaces/access";

/**
 * /api/workspaces/current/members/[memberId]
 *
 * PATCH  — change a role (owner is immutable; the DB guard keeps one owner).
 * DELETE — revoke an invitation or remove a member, then re-sync billed seats.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PATCH = defineRoute(
  {
    auth: "required",
    body: updateMemberRoleSchema,
    rateLimit: { limit: 30, windowMs: 60_000 },
    scope: "members:update",
  },
  async ({ supabase, body, params, requestId }) => {
    const context = await workspaceContext({
      supabase,
      user: null,
      workspaceId: null,
      minimumRole: "admin",
    });

    assertCanManage(context);

    const member = await updateMemberRole(context, params.memberId!, body!.role);

    await writeAudit(supabase!, {
      workspaceId: context.workspace.id,
      actorUserId: context.user.id,
      action: "member.role_updated",
      entityType: "workspace_member",
      entityId: params.memberId!,
      metadata: { role: body!.role },
      requestId,
    });

    return { member };
  },
);

export const DELETE = defineRoute(
  {
    auth: "required",
    rateLimit: { limit: 30, windowMs: 60_000 },
    scope: "members:remove",
  },
  async ({ supabase, params, requestId }) => {
    const context = await workspaceContext({
      supabase,
      user: null,
      workspaceId: null,
      minimumRole: "admin",
    });

    assertCanManage(context);

    const result = await removeMember(context, params.memberId!);

    await writeAudit(supabase!, {
      workspaceId: context.workspace.id,
      actorUserId: context.user.id,
      action: "member.removed",
      entityType: "workspace_member",
      entityId: params.memberId!,
      requestId,
    });

    return result;
  },
);
