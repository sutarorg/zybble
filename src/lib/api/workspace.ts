import type { NextRequest } from "next/server";
import { IntegrationNotConfiguredError } from "@/lib/errors";
import {
  requireUser,
  resolveWorkspace,
  type WorkspaceContext,
} from "@/features/workspaces/access";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";
import type { WorkspaceRole } from "@/lib/supabase/database.types";

/**
 * Workspace selection for API routes.
 *
 * Precedence: explicit `?workspaceId=` (or the dynamic segment) → the
 * `zybble_workspace` cookie set by the workspace switcher → the caller's first
 * workspace. Every path ends in `requireWorkspace()`, which re-reads membership
 * from the database (RLS-scoped) and raises NotFound for a non-member instead of
 * Forbidden, so a workspace id never confirms its own existence.
 */

export const WORKSPACE_COOKIE = "zybble_workspace";

export function requestedWorkspaceId(req: NextRequest, params?: Record<string, string>): string | null {
  const fromParams = params?.workspaceId;
  if (fromParams) return fromParams;

  const fromQuery = req.nextUrl.searchParams.get("workspaceId");
  if (fromQuery) return fromQuery;

  return req.cookies.get(WORKSPACE_COOKIE)?.value ?? null;
}

export async function workspaceContext(input: {
  supabase: ServerSupabase | null;
  user: User | null;
  workspaceId: string | null;
  minimumRole?: WorkspaceRole;
}): Promise<WorkspaceContext> {
  if (!input.supabase) {
    throw new IntegrationNotConfiguredError("Supabase");
  }

  const user = await requireUser(input.supabase);

  return resolveWorkspace(input.supabase, user, input.workspaceId, input.minimumRole ?? "viewer");
}
