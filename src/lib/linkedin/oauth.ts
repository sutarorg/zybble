import { createHash } from "node:crypto";
import { env } from "@/lib/env";
import { randomToken } from "@/lib/crypto";
import { logger } from "@/lib/logger";
import { IntegrationNotConfiguredError } from "@/lib/errors";
import { capabilities, LINKEDIN_ENDPOINTS, redirectUri } from "./config";

/**
 * LinkedIn OAuth 2.0 (3-legged, authorisation code).
 *
 * Security properties this module is responsible for:
 *  * `state` is 32 bytes of CSPRNG output. Only its SHA-256 hash is persisted,
 *    and consuming a state row is a conditional UPDATE, so a replayed callback
 *    cannot exchange a second code (CSRF + replay).
 *  * The state row expires after 10 minutes and is single-use.
 *  * Tokens are exchanged server-side with the client secret; the browser only
 *    ever sees the authorisation code and the redirect.
 *
 * Token lifecycle, per LinkedIn's documentation:
 *  * access tokens are issued with a 60-day lifespan (`expires_in`);
 *  * **programmatic refresh tokens are only issued to approved partners.** We
 *    therefore persist a refresh token when LinkedIn returns one, refresh
 *    silently when we have it, and otherwise flip the connection to
 *    `reauth_required` and ask the user to reconnect — we never pretend a
 *    refresh capability we may not have.
 */

export type AuthorizationRequest = {
  state: string;
  stateHash: string;
  url: string;
  scopes: string[];
};

export function buildAuthorizationUrl(input: {
  state: string;
  scopes: string[];
}): string {
  const clientId = env().LINKEDIN_CLIENT_ID;

  if (!clientId) {
    throw new IntegrationNotConfiguredError("LinkedIn");
  }

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri(),
    state: input.state,
    scope: input.scopes.join(" "),
  });

  return `${LINKEDIN_ENDPOINTS.authorization}?${params.toString()}`;
}

export function newAuthorization(scopes?: string[]): AuthorizationRequest {
  const state = randomToken(32);
  const resolvedScopes = scopes ?? capabilities().scopes;

  return {
    state,
    // Callers persist the hash, never the raw value: a leaked state row must
    // not be usable to forge a callback.
    stateHash: createHash("sha256").update(state).digest("hex"),
    url: buildAuthorizationUrl({ state, scopes: resolvedScopes }),
    scopes: resolvedScopes,
  };
}

export type TokenExchangeResult = {
  accessToken: string;
  expiresInSeconds: number;
  refreshToken: string | null;
  refreshTokenExpiresInSeconds: number | null;
  scope: string | null;
  expiresAt: Date;
  refreshTokenExpiresAt: Date | null;
};

export async function exchangeAuthorizationCode(code: string): Promise<TokenExchangeResult> {
  const configuration = env();

  if (!configuration.LINKEDIN_CLIENT_ID || !configuration.LINKEDIN_CLIENT_SECRET) {
    throw new IntegrationNotConfiguredError("LinkedIn");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: configuration.LINKEDIN_CLIENT_ID,
    client_secret: configuration.LINKEDIN_CLIENT_SECRET,
    redirect_uri: redirectUri(),
  });

  const response = await fetch(LINKEDIN_ENDPOINTS.accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    // Never log the code or the client secret.
    logger.error("linkedin.token_exchange_failed", {
      status: response.status,
      detail: detail.slice(0, 200),
    });
    throw new Error("LinkedIn rejected the authorization code.");
  }

  const payload = (await response.json()) as {
    access_token: string;
    expires_in?: number;
    refresh_token?: string;
    refresh_token_expires_in?: number;
    scope?: string;
  };

  const expiresInSeconds = payload.expires_in ?? 5_184_000; // documented default: 60 days

  return {
    accessToken: payload.access_token,
    expiresInSeconds,
    refreshToken: payload.refresh_token ?? null,
    refreshTokenExpiresInSeconds: payload.refresh_token_expires_in ?? null,
    scope: payload.scope ?? null,
    expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    refreshTokenExpiresAt: payload.refresh_token_expires_in
      ? new Date(Date.now() + payload.refresh_token_expires_in * 1000)
      : null,
  };
}

/**
 * Refresh an access token.
 *
 * Returns `null` when this application has no refresh token for the connection
 * (the common case — LinkedIn grants programmatic refresh to approved partners
 * only). Callers must then mark the connection `reauth_required` and prompt a
 * reconnect rather than retrying forever.
 */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<TokenExchangeResult | null> {
  const configuration = env();

  if (!refreshToken) return null;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: configuration.LINKEDIN_CLIENT_ID ?? "",
    client_secret: configuration.LINKEDIN_CLIENT_SECRET ?? "",
  });

  const response = await fetch(LINKEDIN_ENDPOINTS.accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (response.status === 400 || response.status === 401) {
    logger.warn("linkedin.refresh_rejected", { status: response.status });
    return null;
  }

  if (!response.ok) {
    logger.error("linkedin.refresh_failed", { status: response.status });
    return null;
  }

  const payload = (await response.json()) as {
    access_token: string;
    expires_in?: number;
    refresh_token?: string;
    refresh_token_expires_in?: number;
    scope?: string;
  };

  const expiresInSeconds = payload.expires_in ?? 5_184_000;

  return {
    accessToken: payload.access_token,
    expiresInSeconds,
    refreshToken: payload.refresh_token ?? refreshToken,
    refreshTokenExpiresInSeconds: payload.refresh_token_expires_in ?? null,
    scope: payload.scope ?? null,
    expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    refreshTokenExpiresAt: payload.refresh_token_expires_in
      ? new Date(Date.now() + payload.refresh_token_expires_in * 1000)
      : null,
  };
}

export type LinkedInProfile = {
  /** OIDC subject — the LinkedIn member id used to build the person URN. */
  sub: string;
  name: string | null;
  givenName: string | null;
  familyName: string | null;
  picture: string | null;
  email: string | null;
};

/**
 * Resolve the member behind a token via OpenID Connect.
 * `openid profile email` are requested alongside `w_member_social`.
 */
export async function fetchMemberProfile(accessToken: string): Promise<LinkedInProfile> {
  const response = await fetch(LINKEDIN_ENDPOINTS.userInfo, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Linkedin-Version": env().LINKEDIN_API_VERSION,
    },
  });

  if (!response.ok) {
    logger.error("linkedin.profile_failed", { status: response.status });
    throw new Error("Could not read your LinkedIn profile.");
  }

  const payload = (await response.json()) as {
    sub?: string;
    name?: string;
    given_name?: string;
    family_name?: string;
    picture?: string;
    email?: string;
  };

  if (!payload.sub) {
    throw new Error("LinkedIn did not return a member identifier.");
  }

  return {
    sub: payload.sub,
    name: payload.name ?? null,
    givenName: payload.given_name ?? null,
    familyName: payload.family_name ?? null,
    picture: payload.picture ?? null,
    email: payload.email ?? null,
  };
}

export function personUrn(sub: string): string {
  return `urn:li:person:${sub}`;
}
