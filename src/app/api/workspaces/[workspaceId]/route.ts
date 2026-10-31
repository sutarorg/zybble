import { defineRoute } from "@/lib/api/http";
import { deleteWorkspace, getUsage } from "@/features/workspaces/service";
import { workspaceContext } from "@/lib/api/workspace";
import { workspaceUpdateSchema } from "@/lib/validation/posts";
import { assertCanManage, writeAudit } from "@/features/workspaces/access";
import { entitlementsFor } from "@/features/billing/entitlements";
import type { WorkspaceRow } from "@/lib/supabase/database.types";

/**
 * /api/workspaces/[workspaceId] — read, rename or delete a workspace.
 *
 * Deletion is asynchronous (a durable job) because it cancels billing, removes
 * storage objects and purges every dependent row.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = defineRoute(
  {
    auth: "required",
    rateLimit: { limit: 120, windowMs: 60_000 },
    scope: "workspaces:read",
  },
  async ({ supabase, params }) => {
    const context = await workspaceContext({
      supabase,
      user: null,
      workspaceId: params.workspaceId ?? null,
    });

    const usage = await getUsage(context);

    return {
      workspace: {
        id: context.workspace.id,
        name: context.workspace.name,
        slug: context.workspace.slug,
        plan: context.workspace.plan,
        seats: context.workspace.seats,
        timezone: context.workspace.timezone,
        createdAt: context.workspace.created_at,
      },
      role: context.role,
      entitlements: entitlementsFor(context.workspace.plan),
      usage,
    };
  },
);

export const PATCH = defineRoute(
  {
    auth: "required",
    body: workspaceUpdateSchema,
    rateLimit: { limit: 30, windowMs: 60_000 },
    scope: "workspaces:update",
  },
  async ({ supabase, body, params, requestId }) => {
    const context = await workspaceContext({
      supabase,
      user: null,
      workspaceId: params.workspaceId ?? null,
      minimumRole: "admin",
    });

    assertCanManage(context);

    const patch: Partial<WorkspaceRow> = {};
    if (body!.name !== undefined) patch.name = body!.name;
    if (body!.timezone !== undefined) patch.timezone = body!.timezone;

    const { data: updated, error } = await supabase!
      .from("workspaces")
      .update(patch)
      .eq("id", context.workspace.id)
      .select("*")
      .maybeSingle();

    if (error || !updated) {
      throw new Error("Could not update the workspace.");
    }

    await writeAudit(supabase!, {
      workspaceId: context.workspace.id,
      actorUserId: context.user.id,
      action: "workspace.updated",
      entityType: "workspace",
      entityId: context.workspace.id,
      metadata: { fields: Object.keys(patch) },
      requestId,
    });

    return { workspace: updated };
  },
);

export const DELETE = defineRoute(
  {
    auth: "required",
    rateLimit: { limit: 5, windowMs: 60_000 },
    scope: "workspaces:delete",
  },
  async ({ supabase, params }) => {
    const context = await workspaceContext({
      supabase,
      user: null,
      workspaceId: params.workspaceId ?? null,
      minimumRole: "owner",
    });

    return deleteWorkspace(context);
  },
);
