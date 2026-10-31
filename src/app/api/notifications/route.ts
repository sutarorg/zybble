import { z } from "zod";
import { defineRoute } from "@/lib/api/http";
import { requestedWorkspaceId, workspaceContext } from "@/lib/api/workspace";

/**
 * /api/notifications
 *
 * GET  — the workspace feed: notices addressed to the caller plus workspace-wide
 *        ones (RLS filters both).
 * PATCH — mark read. `all: true` clears the feed; otherwise `ids` is honoured.
 *         Updates are RLS-scoped to rows the user can already see.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const markReadSchema = z.object({
  ids: z.array(z.string().uuid()).max(200).optional(),
  all: z.boolean().default(false),
});

export const GET = defineRoute(
  {
    auth: "required",
    query: z.object({
      limit: z.coerce.number().int().min(1).max(100).default(30),
      unreadOnly: z
        .enum(["true", "false"])
        .default("false")
        .transform((value) => value === "true"),
    }),
    rateLimit: { limit: 120, windowMs: 60_000 },
    scope: "notifications:list",
  },
  async ({ supabase, req, query, user }) => {
    const context = await workspaceContext({
      supabase,
      user: null,
      workspaceId: requestedWorkspaceId(req),
    });

    let builder = supabase!
      .from("notifications")
      .select("*")
      .eq("workspace_id", context.workspace.id)
      .order("created_at", { ascending: false })
      .limit(query.limit);

    if (query.unreadOnly) builder = builder.is("read_at", null);

    const { data, error } = await builder;

    if (error) throw new Error("Could not load notifications.");

    // Workspace-wide rows (user_id null) are visible to everyone; the rest are
    // the caller's. Both cases are already covered by RLS — this is belt and
    // braces so a future policy change cannot leak another member's notices.
    const rows = ((data ?? []) as Array<Record<string, unknown>>).filter((row) => {
      const target = row.user_id as string | null;
      return target === null || target === user!.id;
    });

    return {
      notifications: rows.map((row) => ({
        id: row.id as string,
        kind: row.kind as string,
        title: row.title as string,
        body: row.body as string,
        severity: row.severity as string,
        actionUrl: row.action_url as string | null,
        createdAt: row.created_at as string,
        readAt: row.read_at as string | null,
      })),
    };
  },
);

export const PATCH = defineRoute(
  {
    auth: "required",
    body: markReadSchema,
    rateLimit: { limit: 60, windowMs: 60_000 },
    scope: "notifications:update",
  },
  async ({ supabase, req, body }) => {
    const context = await workspaceContext({
      supabase,
      user: null,
      workspaceId: requestedWorkspaceId(req),
    });

    const readAt = new Date().toISOString();

    let builder = supabase!
      .from("notifications")
      .update({ read_at: readAt })
      .eq("workspace_id", context.workspace.id)
      .is("read_at", null);

    if (!body!.all) {
      if (!body!.ids || body!.ids.length === 0) {
        return { updated: 0 };
      }
      builder = builder.in("id", body!.ids);
    }

    const { data, error } = await builder.select("id");

    if (error) throw new Error("Could not update notifications.");

    return { updated: data?.length ?? 0, readAt };
  },
);
