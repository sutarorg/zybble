import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { logger } from "@/lib/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { LinkedInAccountRow } from "@/lib/supabase/database.types";
import { exchangeAuthorizationCode, fetchMemberProfile, personUrn, refreshAccessToken } from "@/lib/linkedin/oauth";

/**
 * Credential storage for LinkedIn connections.
 *
 * Storage rules:
 *  * tokens are encrypted with AES-256-GCM before the INSERT (src/lib/crypto);
 *  * the additional authenticated data binds a ciphertext to
 *    `<workspaceId>:<accountId>`, so a row copied elsewhere cannot decrypt;
 *  * reads go through the service-role client — the `authenticated` role has no
 *    policy on `linkedin_account_secrets` at all;
 *  * the token value is never logged, returned to a caller, or serialised.
 */

/** Refresh when less than this many days remain on the access token. */
const REFRESH_WINDOW_DAYS = 7;

export class LinkedInConnectionError extends Error {
  readonly reason: "expired" | "revoked" | "reauth_required" | "not_found";

  constructor(reason: LinkedInConnectionError["reason"], message: string) {
    super(message);
    this.name = "LinkedInConnectionError";
    this.reason = reason;
  }
}

export type StoredConnection = {
  account: LinkedInAccountRow;
  accessToken: string;
  expiresAt: Date | null;
  /**
   * Whether a refresh token exists. LinkedIn only issues refresh tokens to
   * approved partners, so this is routinely false — the UI and the expiry
   * warnings are worded around it.
   */
  refreshable: boolean;
};

function aad(workspaceId: string, accountId: string): string {
  return `${workspaceId}:${accountId}`;
}

export function deriveCapabilities(scopes: string[]): {
  canPublish: boolean;
  canReadAnalytics: boolean;
} {
  return {
    canPublish: scopes.includes("w_member_social"),
    canReadAnalytics: scopes.includes("r_member_postAnalytics"),
  };
}

export type ConnectInput = {
  workspaceId: string;
  userId: string;
  code: string;
  redirectTo?: string | null;
};

export type ConnectResult = {
  account: LinkedInAccountRow;
  created: boolean;
};

/**
 * Complete an OAuth handshake: exchange the code, resolve the member, and
 * persist the connection + encrypted credentials.
 */
export async function connectLinkedInAccount(input: ConnectInput): Promise<ConnectResult> {
  const admin = createSupabaseAdminClient();

  const tokens = await exchangeAuthorizationCode(input.code);
  const profile = await fetchMemberProfile(tokens.accessToken);

  const urn = personUrn(profile.sub);
  const scopes = (tokens.scope ?? "").split(" ").filter(Boolean);
  const capabilities = deriveCapabilities(scopes);

  // Re-connecting the same profile updates it in place rather than creating a
  // duplicate row (the unique index would reject one anyway).
  const { data: existing } = await admin
    .from("linkedin_accounts")
    .select("*")
    .eq("workspace_id", input.workspaceId)
    .eq("profile_urn", urn)
    .maybeSingle();

  const accountId = (existing as LinkedInAccountRow | null)?.id ?? crypto.randomUUID();

  const { data: account, error: accountError } = await admin
    .from("linkedin_accounts")
    .upsert(
      {
        id: accountId,
        workspace_id: input.workspaceId,
        kind: "member",
        profile_urn: urn,
        display_name: profile.name ?? profile.givenName ?? "LinkedIn member",
        avatar_url: profile.picture,
        granted_scopes: scopes,
        can_publish: capabilities.canPublish,
        can_read_analytics: capabilities.canReadAnalytics,
        status: "active",
        token_expires_at: tokens.expiresAt.toISOString(),
        last_verified_at: new Date().toISOString(),
        last_error_code: null,
        last_error_message: null,
        expiry_notified_at: null,
        connected_by: input.userId,
        disconnected_at: null,
      },
      { onConflict: "id" },
    )
    .select("*")
    .single();

  if (accountError || !account) {
    logger.error("linkedin.connect_failed", {
      workspaceId: input.workspaceId,
      error: accountError?.message,
    });
    throw new Error(accountError?.message ?? "Could not save the LinkedIn connection.");
  }

  const bound = aad(input.workspaceId, accountId);

  const { error: secretError } = await admin.from("linkedin_account_secrets").upsert({
    account_id: accountId,
    access_token_ciphertext: encryptSecret(tokens.accessToken, bound),
    access_token_key_id: "current",
    refresh_token_ciphertext: tokens.refreshToken
      ? encryptSecret(tokens.refreshToken, bound)
      : null,
    refresh_token_key_id: tokens.refreshToken ? "current" : null,
    refresh_token_expires_at: tokens.refreshTokenExpiresAt?.toISOString() ?? null,
    scope: tokens.scope,
    token_type: "Bearer",
    updated_at: new Date().toISOString(),
  });

  if (secretError) {
    // Roll the metadata row back so we never leave an account without usable
    // credentials that the UI would otherwise present as connected.
    await admin.from("linkedin_accounts").delete().eq("id", accountId);
    logger.error("linkedin.credential_write_failed", { error: secretError.message });
    throw new Error("Could not store the LinkedIn credentials.");
  }

  return { account: account as LinkedInAccountRow, created: !existing };
}

/**
 * Load a connection and a usable access token.
 *
 * Throws `LinkedInConnectionError` when the token has expired or been revoked
 * and no refresh path exists — the caller turns that into a user-facing
 * "reconnect LinkedIn" state rather than retrying a call that cannot succeed.
 */
export async function getUsableConnection(accountId: string): Promise<StoredConnection> {
  const admin = createSupabaseAdminClient();

  const { data: account, error } = await admin
    .from("linkedin_accounts")
    .select("*")
    .eq("id", accountId)
    .maybeSingle();

  if (error || !account) {
    throw new LinkedInConnectionError("not_found", "LinkedIn connection not found.");
  }

  const accountRow = account as LinkedInAccountRow;

  if (accountRow.status === "revoked") {
    throw new LinkedInConnectionError(
      "revoked",
      "This LinkedIn connection was revoked. Reconnect it to continue.",
    );
  }

  const { data: secret, error: secretError } = await admin
    .from("linkedin_account_secrets")
    .select("*")
    .eq("account_id", accountId)
    .maybeSingle();

  if (secretError || !secret) {
    throw new LinkedInConnectionError(
      "reauth_required",
      "No stored credentials for this connection. Reconnect LinkedIn.",
    );
  }

  const bound = aad(accountRow.workspace_id, accountId);
  let accessToken = decryptSecret(secret.access_token_ciphertext, bound);
  let expiresAt = accountRow.token_expires_at ? new Date(accountRow.token_expires_at) : null;

  const needsRefresh =
    (expiresAt && expiresAt.getTime() - Date.now() < REFRESH_WINDOW_DAYS * 86_400_000) ||
    accountRow.status === "expired" ||
    accountRow.status === "reauth_required";

  if (needsRefresh && secret.refresh_token_ciphertext) {
    const refreshToken = decryptSecret(secret.refresh_token_ciphertext, bound);
    const refreshed = await refreshAccessToken(refreshToken);

    if (refreshed) {
      accessToken = refreshed.accessToken;
      expiresAt = refreshed.expiresAt;

      await admin
        .from("linkedin_account_secrets")
        .update({
          access_token_ciphertext: encryptSecret(refreshed.accessToken, bound),
          refresh_token_ciphertext: refreshed.refreshToken
            ? encryptSecret(refreshed.refreshToken, bound)
            : secret.refresh_token_ciphertext,
          refresh_token_expires_at: refreshed.refreshTokenExpiresAt?.toISOString() ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("account_id", accountId);

      await admin
        .from("linkedin_accounts")
        .update({
          status: "active",
          token_expires_at: refreshed.expiresAt.toISOString(),
          last_verified_at: new Date().toISOString(),
          expiry_notified_at: null,
          last_error_code: null,
          last_error_message: null,
        })
        .eq("id", accountId);

      return {
        account: { ...accountRow, status: "active" },
        accessToken,
        expiresAt,
        refreshable: true,
      };
    }
  }

  if (expiresAt && expiresAt.getTime() <= Date.now()) {
    // No refresh token (the normal case — LinkedIn issues programmatic refresh
    // only to approved partners): the member must re-authorise.
    await admin
      .from("linkedin_accounts")
      .update({
        status: "reauth_required",
        last_error_code: "TOKEN_EXPIRED",
        last_error_message:
          "The LinkedIn access token expired. Reconnect the account to continue publishing.",
      })
      .eq("id", accountId);

    throw new LinkedInConnectionError(
      "reauth_required",
      "Your LinkedIn connection expired. Reconnect it to keep publishing.",
    );
  }

  return {
    account: accountRow,
    accessToken,
    expiresAt,
    refreshable: Boolean(secret.refresh_token_ciphertext),
  };
}

/** Mark a connection revoked (user disconnect, or LinkedIn rejecting the token). */
export async function markConnectionStatus(
  accountId: string,
  status: "active" | "expired" | "revoked" | "reauth_required",
  error?: { code?: string | null; message?: string | null },
): Promise<void> {
  const admin = createSupabaseAdminClient();

  await admin
    .from("linkedin_accounts")
    .update({
      status,
      last_error_code: error?.code ?? null,
      last_error_message: error?.message ?? null,
      ...(status === "revoked" ? { disconnected_at: new Date().toISOString() } : {}),
    })
    .eq("id", accountId);
}

/**
 * Disconnect: drop credentials first, then the metadata row. Ordering matters —
 * a metadata row without credentials is inert, the reverse is not.
 */
export async function disconnectLinkedInAccount(
  workspaceId: string,
  accountId: string,
): Promise<void> {
  const admin = createSupabaseAdminClient();

  const { error: secretError } = await admin
    .from("linkedin_account_secrets")
    .delete()
    .eq("account_id", accountId);

  if (secretError) {
    logger.error("linkedin.disconnect_secret_failed", { error: secretError.message });
    throw new Error("Could not remove the stored LinkedIn credentials.");
  }

  const { error } = await admin
    .from("linkedin_accounts")
    .update({
      status: "revoked",
      disconnected_at: new Date().toISOString(),
      last_verified_at: null,
    })
    .eq("id", accountId)
    .eq("workspace_id", workspaceId);

  if (error) {
    logger.error("linkedin.disconnect_failed", { error: error.message });
    throw new Error("Could not disconnect the LinkedIn account.");
  }
}
