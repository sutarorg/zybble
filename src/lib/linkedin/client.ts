import { ExternalServiceError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { linkedinHeaders, linkedinVersion } from "./config";

/**
 * Thin typed client for LinkedIn's REST API.
 *
 * Responsibilities beyond "make a request":
 *  * attach the two mandatory version headers,
 *  * translate LinkedIn's error vocabulary into actionable product errors
 *    (expired token, revoked permission, rate limit, outage),
 *  * distinguish retryable failures (5xx, timeouts, 429) from terminal ones
 *    (401/403/validation), so Inngest retries only what can succeed,
 *  * never log a token.
 */

export type LinkedInErrorShape = {
  status: number;
  code?: string;
  message?: string;
  serviceErrorCode?: number;
};

export class LinkedInApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly serviceErrorCode: number | undefined;
  readonly retryable: boolean;
  readonly kind:
    | "unauthorized"
    | "forbidden"
    | "not_found"
    | "rate_limited"
    | "validation"
    | "server_error"
    | "network"
    | "unknown";

  constructor(input: LinkedInErrorShape & { kind?: LinkedInApiError["kind"] }) {
    super(input.message ?? `LinkedIn request failed with status ${input.status}`);
    this.name = "LinkedInApiError";
    this.status = input.status;
    this.code = input.code;
    this.serviceErrorCode = input.serviceErrorCode;
    this.kind = input.kind ?? classify(input.status, input.code);
    this.retryable = this.kind === "rate_limited" || this.kind === "server_error" || this.kind === "network";
  }

  /**
   * A plain-language explanation shown to the user when the post fails.
   * Deliberately specific: "LinkedIn revoked Zybble's access" tells the user to
   * reconnect, which is the only action that fixes it.
   */
  userMessage(): string {
    switch (this.kind) {
      case "unauthorized":
        return "LinkedIn rejected the connection. Reconnect your LinkedIn account to resume publishing.";
      case "forbidden":
        return this.code === "ACCESS_DENIED"
          ? "LinkedIn declined this action: the connected account is missing a permission. Reconnect and approve every requested permission."
          : "LinkedIn declined this action for the connected account.";
      case "rate_limited":
        return "LinkedIn is rate limiting this account. Zybble will retry automatically.";
      case "not_found":
        return "LinkedIn could not find that post. It may have been deleted on LinkedIn.";
      case "validation":
        return `LinkedIn rejected the post content: ${this.message}`;
      case "server_error":
      case "network":
        return "LinkedIn is temporarily unavailable. Zybble will retry automatically.";
      default:
        return "Publishing to LinkedIn failed for an unexpected reason. The failure has been logged.";
    }
  }
}

function classify(status: number, code?: string): LinkedInApiError["kind"] {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limited";
  if (status >= 400 && status < 500) return "validation";
  if (status >= 500) return "server_error";
  if (code === "NETWORK") return "network";
  return "unknown";
}

async function parseError(response: Response): Promise<LinkedInErrorShape> {
  let payload: { message?: string; code?: string; serviceErrorCode?: number } = {};

  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    // Non-JSON error bodies (HTML from an edge proxy) are common during outages.
  }

  return {
    status: response.status,
    code: payload.code,
    message: payload.message ?? response.statusText,
    serviceErrorCode: payload.serviceErrorCode,
  };
}

export type LinkedInRequestOptions = {
  accessToken: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  /** Query string already URL-encoded by the caller. */
  query?: string;
  /** Upload endpoints are on www.linkedin.com, not api.linkedin.com. */
  absoluteUrl?: string;
  /** Raw binary body (media uploads). */
  binary?: Buffer | Uint8Array;
  contentType?: string;
  timeoutMs?: number;
  retries?: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type LinkedInResponse<T> = {
  data: T;
  headers: Headers;
  status: number;
};

/**
 * Call LinkedIn. Retries only genuinely transient failures, with exponential
 * backoff plus jitter so a fleet of retries does not stampede.
 */
export async function linkedinRequestWithHeaders<T>(
  path: string,
  options: LinkedInRequestOptions,
): Promise<LinkedInResponse<T>> {
  const {
    accessToken,
    method = "GET",
    body,
    query,
    absoluteUrl,
    binary,
    contentType,
    timeoutMs = 20_000,
    retries = 2,
  } = options;

  const url = absoluteUrl ?? `${path}${query ? `?${query}` : ""}`;

  let lastError: LinkedInApiError | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers: Record<string, string> = {
        ...linkedinHeaders(accessToken),
        ...(contentType ? { "Content-Type": contentType } : {}),
      };

      if (body !== undefined && !contentType) {
        headers["Content-Type"] = "application/json";
      }

      const response = await fetch(url, {
        method,
        headers,
        body: binary
          ? new Uint8Array(binary)
          : body !== undefined
            ? JSON.stringify(body)
            : undefined,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        const shape = await parseError(response);
        const error = new LinkedInApiError(shape);

        logger.warn("linkedin.request_failed", {
          url: url.split("?")[0],
          status: error.status,
          code: error.code,
          kind: error.kind,
          version: linkedinVersion(),
        });

        if (error.retryable && attempt < retries) {
          lastError = error;
          await sleep(backoff(attempt));
          continue;
        }

        throw error;
      }

      // 204 (and some 201s) carry no body.
      if (response.status === 204) {
        return { data: undefined as T, headers: response.headers, status: response.status };
      }

      const text = await response.text();
      const data = (text ? (JSON.parse(text) as T) : (undefined as T)) as T;

      return { data, headers: response.headers, status: response.status };
    } catch (error) {
      clearTimeout(timer);

      if (error instanceof LinkedInApiError) throw error;

      const aborted = error instanceof Error && error.name === "AbortError";
      const networkError = new LinkedInApiError({
        status: 0,
        code: aborted ? "TIMEOUT" : "NETWORK",
        message: aborted ? "LinkedIn request timed out" : "LinkedIn was unreachable",
        kind: "network",
      });

      if (attempt < retries) {
        lastError = networkError;
        await sleep(backoff(attempt));
        continue;
      }

      throw networkError;
    }
  }

  throw lastError ?? new LinkedInApiError({ status: 0, message: "LinkedIn request failed" });
}

/** Convenience wrapper when only the parsed body matters. */
export async function linkedinRequest<T>(
  path: string,
  options: LinkedInRequestOptions,
): Promise<T> {
  const { data } = await linkedinRequestWithHeaders<T>(path, options);
  return data;
}

function backoff(attempt: number): number {
  const base = Math.min(1_000 * 2 ** attempt, 8_000);
  return base + Math.random() * 500;
}

/**
 * Wrapper used by callers that want an ExternalServiceError (API layer) rather
 * than the LinkedIn-specific type (job layer, which inspects `.kind`).
 */
export async function linkedinRequestOrThrow<T>(
  path: string,
  options: LinkedInRequestOptions,
): Promise<T> {
  try {
    return await linkedinRequest<T>(path, options);
  } catch (error) {
    if (error instanceof LinkedInApiError) {
      throw new ExternalServiceError("linkedin", error.userMessage(), {
        retryable: error.retryable,
        cause: error,
        details: { kind: error.kind, status: error.status, code: error.code },
      });
    }
    throw error;
  }
}

/** `x-restli-id` carries the created post URN on a 201. */
export function restliIdFrom(headers: Headers): string | null {
  return headers.get("x-restli-id");
}
