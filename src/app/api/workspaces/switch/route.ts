import { NextResponse } from "next/server";
import { z } from "zod";
import { ok } from "@/lib/api/http";
import { defineRoute } from "@/lib/api/http";
import { listWorkspaces, writeAudit } from "@/features/workspaces/access";
import { WORKSPACE_COOKIE } from "@/lib/api/workspace";
import { NotFoundError } from "@/lib/errors";

/**
 * POST /api/workspaces/switch — remember which workspace the UI is looking at.
 *
 * The id is validated against the caller's real memberships before the cookie is
 * written, and every API route re-resolves membership anyway (`resolveWorkspace`),
 * so a hand-edited cookie can only ever select a workspace the user already
 * belongs to — otherwise it resolves to their first workspace.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const switchSchema = z.object({ workspaceId: z.string().uuid() });

export const POST = defineRoute(
  {
    auth: "required",
    body: switchSchema,
    rateLimit: { limit: 60, windowMs: 60_000 },
    scope: "workspaces:switch",
  },
  async ({ supabase, body, req, user }) => {
    const memberships = await listWorkspaces(supabase!);
    const workspace = memberships.find((row) => row.id === body!.workspaceId);

    if (!workspace) throw new NotFoundError("Workspace not found.");

    await writeAudit(supabase!, {
      workspaceId: workspace.id,
      actorUserId: user!.id,
      action: "workspace.switched",
      entityType: "workspace",
      entityId: workspace.id,
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: req.headers.get("user-agent"),
    });

    const response = ok({
      workspace: { id: workspace.id, name: workspace.name, plan: workspace.plan },
    });

    response.cookies.set(WORKSPACE_COOKIE, workspace.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });

    return response;
  },
);
