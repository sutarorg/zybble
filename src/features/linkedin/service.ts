import { createHash } from "node:crypto";
import { disconnectLinkedInAccount, connectLinkedInAccount, getUsableConnection, markConnectionStatus } from "@/features/linkedin/tokens";
import type { WorkspaceContext } from "@/features/workspaces/access";
import { AppError, IntegrationNotConfiguredError, NotFoundError } from "@/lib/errors";
import { capabilities } from "@/lib/linkedin/config";
import { newAuthorization } from "@/lib/linkedin/oauth";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { LinkedInAccountRow } from "@/lib/supabase/database.types";

/**
 * LinkedIn connection management.
 *
 * The OAuth state lives in the database (`linkedin_oauth_states`), single-use and
 * expiring, so a callback cannot be replayed and CSRF is impossible even if a
 * browser is tricked into opening one. Only the SHA-256 hash of the state is
 * stored; the raw value travels in an httpOnly cookie.
 */

const STATE_TTL_MINUTES = 10;
export const LINKEDIN_STATE_COOKIE = "zybble_linkedin_state";

export type ConnectionView = {
  id: string;
  kind: "member" | "organization";
  displayName: string | null;
  avatarUrl: string | null;
  profileUrn: string;
  status: LinkedInAccountRow["status"];
  scopes: string[];
  canPublish: boolean;
  canReadAnalytics: boolean;
  tokenExpiresAt: string | null;
  lastVerifiedAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  connectedAt: string;
};

export function toConnectionView(row: LinkedInAccountRow): ConnectionView {
  return {
    id: row.id,
    kind: row.kind,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    profileUrn: row.profile_urn,
    status: row.status,
    scopes: row.granted_scopes ?? [],
    canPublish: row.can_publish,
    canReadAnalytics: row.can_read_analytics,
    tokenExpiresAt: row.token_expires_at,
    lastVerifiedAt: row.last_verified_at,
    lastErrorCode: row.last_error_code,
    lastErrorMessage: row.last_error_message,
    connectedAt: row.created_at,
  };
}

export async function listConnections(context: WorkspaceContext): Promise<{
  connections: ConnectionView[];
  capabilities: ReturnType<typeof capabilities>;
}> {
  const admin = createSupabaseAdminClient();

  const { data } = await admin
    .from("linkedin_accounts")
    .select("*")
    .eq("workspace_id", context.workspace.id)
    .order("created_at", { ascending: true });

  return {
    connections: ((data ?? []) as LinkedInAccountRow[]).map(toConnectionView),
    capabilities: capabilities(),
  };
}

/**
 * Begin the OAuth flow.
 *
 * Returns the LinkedIn consent URL plus the raw state, which the route stores in
 * a short-lived httpOnly cookie. The database gets only the hash.
 */
export async function startConnect(context: WorkspaceContext): Promise<{
  authorizationUrl: string;
  state: string;
  scopes: string[];
}> {
  const admin = createSupabaseAdminClient();
  const auth = newAuthorization();

  const { error } = await admin.from("linkedin_oauth_states").insert({
    state_hash: auth.stateHash,
    user_id: context.user.id,
    workspace_id: context.workspace.id,
    redirect_to: "/settings/linkedin",
    expires_at: new Date(Date.now() + STATE_TTL_MINUTES * 60_000).toISOString(),
  });

  if (error) {
    logger.error("linkedin.state_write_failed", { error: error.message });
    throw new AppError("internal_error", "Could not start the LinkedIn connection.");
  }

  return { authorizationUrl: auth.url, state: auth.state, scopes: auth.scopes };
}

/**
 * Complete the OAuth flow.
 *
 * The state is consumed with a conditional UPDATE (`consumed_at is null`), so a
 * replayed callback loses the race and is rejected instead of exchanging a
 * second code.
 */
export async function completeConnect(input: {
  code: string;
  state: string;
  cookieState: string | null;
}): Promise<{ workspaceId: string; accountId: string; created: boolean; redirectTo: string }> {
  const admin = createSupabaseAdminClient();
  const stateHash = createHash("sha256").update(input.state).digest("hex");

  if (!input.cookieState || input.cookieState !== input.state) {
    throw new AppError("validation_failed", "This LinkedIn authorisation request could not be verified.");
  }

  const { data: row, error } = await admin
    .from("linkedin_oauth_states")
    .update({ consumed_at: new Date().toISOString() })
    .eq("state_hash", stateHash)
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("*")
    .maybeSingle();

  if (error || !row) {
    throw new AppError(
      "validation_failed",
      "This LinkedIn authorisation link has expired or was already used. Start again.",
    );
  }

  const state = row as { workspace_id: string; user_id: string };

  try {
    const result = await connectLinkedInAccount({
      workspaceId: state.workspace_id,
      userId: state.user_id,
      code: input.code,
    });

    return {
      workspaceId: state.workspace_id,
      accountId: result.account.id,
      created: result.created,
      redirectTo: "/settings/linkedin",
    };
  } catch (error) {
    // Release the state so the user can retry without waiting for the TTL.
    await admin
      .from("linkedin_oauth_states")
      .update({ consumed_at: null })
      .eq("state_hash", stateHash);

    throw error;
  }
}

export async function disconnect(
  context: WorkspaceContext,
  accountId: string,
): Promise<{ disconnected: true }> {
  const account = await assertAccountInWorkspace(context, accountId);
  await disconnectLinkedInAccount(context.workspace.id, account.id);

  return { disconnected: true };
}

/**
 * Re-verify a connection: one LinkedIn call through the stored credential. A
 * 401/403 flips the account to `reauth_required` and the publish pipeline stops
 * using it, so a revoked permission is visible instead of silently failing
 * later.
 */
export async function recheckConnection(
  context: WorkspaceContext,
  accountId: string,
): Promise<{ status: LinkedInAccountRow["status"]; message: string | null }> {
  await assertAccountInWorkspace(context, accountId);

  try {
    await getUsableConnection(accountId);
    await markConnectionStatus(accountId, "active");
    return { status: "active", message: null };
  } catch (error) {
    if (error instanceof Error && error.name === "LinkedInConnectionError") {
      return { status: "reauth_required", message: error.message };
    }

    const message = error instanceof Error ? error.message : "Could not reach LinkedIn.";

    if (/401|403|unauthorized|forbidden/i.test(message)) {
      await markConnectionStatus(accountId, "reauth_required");
      return { status: "reauth_required", message: "LinkedIn rejected this connection. Reconnect it." };
    }

    return { status: "active", message };
  }
}

export async function assertAccountInWorkspace(
  context: WorkspaceContext,
  accountId: string,
): Promise<LinkedInAccountRow> {
  const admin = createSupabaseAdminClient();

  const { data } = await admin
    .from("linkedin_accounts")
    .select("*")
    .eq("id", accountId)
    .eq("workspace_id", context.workspace.id)
    .maybeSingle();

  if (!data) {
    throw new NotFoundError("That LinkedIn account is not connected to this workspace.");
  }

  return data as LinkedInAccountRow;
}

export function assertLinkedInConfigured(): void {
  if (!env().LINKEDIN_CLIENT_ID || !env().LINKEDIN_CLIENT_SECRET) {
    throw new IntegrationNotConfiguredError("LinkedIn");
  }
}
