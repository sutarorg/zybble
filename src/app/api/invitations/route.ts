import { z } from "zod";
import { defineRoute } from "@/lib/api/http";
import { acceptInvitation } from "@/features/workspaces/service";
import { requireUser } from "@/features/workspaces/access";

/**
 * GET  /api/invitations?token=… — preview an invitation before signing in
 *      (workspace name, inviter, expiry). Never exposes the token hash.
 * POST /api/invitations         — accept one; the raw token is hashed before it
 *      reaches the database.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const acceptSchema = z.object({
  token: z.string().min(10).max(200),
});

export const GET = defineRoute(
  {
    auth: "optional",
    query: z.object({ token: z.string().min(10).max(200) }),
    rateLimit: { limit: 30, windowMs: 60_000 },
    scope: "invitations:preview",
  },
  async ({ supabase, query }) => {
    const { createHash } = await import("node:crypto");
    const hash = createHash("sha256").update(query.token).digest("hex");

    const { data } = await supabase!
      .from("workspace_members")
      .select("id, email, role, invite_expires_at, invited_at, workspace_id")
      .eq("invite_token_hash", hash)
      .eq("status", "invited")
      .maybeSingle();

    if (!data) {
      return { valid: false as const };
    }

    const row = data as {
      id: string;
      email: string;
      role: string;
      invite_expires_at: string | null;
      invited_at: string | null;
      workspace_id: string;
    };

    const expired = row.invite_expires_at
      ? new Date(row.invite_expires_at).getTime() < Date.now()
      : false;

    const { data: workspace } = await supabase!
      .from("workspaces")
      .select("name")
      .eq("id", row.workspace_id)
      .maybeSingle();

    return {
      valid: !expired,
      expired,
      role: row.role,
      workspaceName: (workspace as { name: string } | null)?.name ?? "a workspace",
      invitedAt: row.invited_at,
      // Only the domain is shown: the full address is a login hint, not a
      // public fact.
      emailHint: row.email.replace(/^[^@]/, "*").replace(/[^@](?=[^@]*@)/g, "*"),
    };
  },
);

export const POST = defineRoute(
  {
    auth: "required",
    body: acceptSchema,
    rateLimit: { limit: 20, windowMs: 60_000 },
    scope: "invitations:accept",
  },
  async ({ supabase, body }) => {
    const user = await requireUser(supabase);
    return acceptInvitation(supabase!, user.id, body!.token);
  },
);
