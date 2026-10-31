import { defineRoute } from "@/lib/api/http";
import { getUsage } from "@/features/workspaces/service";
import { workspaceContext } from "@/lib/api/workspace";
import { workspaceUpdateSchema } from "@/lib/validation/posts";
import { assertCanManage, writeAudit } from "@/features/workspaces/access";
import { entitlementsFor } from "@/features/billing/entitlements";
import type { WorkspaceRow } from "@/lib/supabase/database.types";

/**
 * /api/workspaces/current — the workspace resolved from the session cookie.
 *
 * The browser never sends an id: the switcher sets it once and every route
 * re-resolves membership, so a forged cookie can only ever select a workspace
 * the caller already belongs to.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = defineRoute(
  {
    auth: "required",
    rateLimit: { limit: 120, windowMs: 60_000 },
    scope: "workspaces:read",
  },
  async ({ supabase }) => {
    const context = await workspaceContext({ supabase, user: null, workspaceId: null });

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
      usage: await getUsage(context),
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
  async ({ supabase, body, requestId }) => {
    const context = await workspaceContext({
      supabase,
      user: null,
      workspaceId: null,
      minimumRole: "admin",
    });

    assertCanManage(context);

    const patch: Partial<WorkspaceRow> = {};
    if (body!.name !== undefined) patch.name = body!.name;
    if (body!.timezone !== undefined) patch.timezone = body!.timezone;

    if (Object.keys(patch).length === 0) {
      throw new Error("Nothing to update.");
    }

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

    return {
      workspace: {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        plan: updated.plan,
        seats: updated.seats,
        timezone: updated.timezone,
        createdAt: updated.created_at,
      },
    };
  },
);
