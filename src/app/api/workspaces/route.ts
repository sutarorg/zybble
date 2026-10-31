import { defineRoute } from "@/lib/api/http";
import { createWorkspace } from "@/features/workspaces/service";
import { listWorkspaces, requireUser } from "@/features/workspaces/access";
import { entitlementsFor } from "@/features/billing/entitlements";
import { workspaceCreateSchema } from "@/lib/validation/posts";
import { inngest } from "@/inngest/client";

/**
 * GET  /api/workspaces — workspaces the caller belongs to (RLS-scoped).
 * POST /api/workspaces — create one (atomic: workspace + owner + subscription
 *      + usage counter, all inside `public.create_workspace`).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = defineRoute(
  {
    auth: "required",
    rateLimit: { limit: 120, windowMs: 60_000 },
    scope: "workspaces:list",
  },
  async ({ supabase }) => {
    const workspaces = await listWorkspaces(supabase!);
    return {
      workspaces: workspaces.map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        plan: workspace.plan,
        seats: workspace.seats,
        timezone: workspace.timezone,
        createdAt: workspace.created_at,
      })),
    };
  },
);

export const POST = defineRoute(
  {
    auth: "required",
    body: workspaceCreateSchema,
    rateLimit: { limit: 10, windowMs: 60_000 },
    scope: "workspaces:create",
    status: 201,
  },
  async ({ body, supabase }) => {
    await requireUser(supabase);

    const workspace = await createWorkspace(supabase!, {
      name: body!.name,
      timezone: body!.timezone,
    });

    await inngest.send({
      name: "billing/seats.sync",
      data: { workspaceId: workspace.id, actorUserId: null },
    });

    return {
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        plan: workspace.plan,
        seats: workspace.seats,
      },
      entitlements: entitlementsFor(workspace.plan),
    };
  },
);
