/**
 * Browser-side API client.
 *
 * Every route in `src/app/api` answers with the same envelope
 * (`{ ok: true, data }` / `{ ok: false, error: { code, message, details } }`),
 * so there is exactly one place that unwraps it. Server error messages are
 * written for humans and are safe to display; stack traces, SQL errors and
 * provider payloads never cross the wire (see `src/lib/api/http.ts`).
 */

export type ApiErrorShape = {
  code: string;
  message: string;
  details?: unknown;
};

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, code: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
  body?: unknown;
  /** AbortSignal for callers that need cancellation. */
  signal?: AbortSignal;
  /** FormData is sent as-is (multipart upload). */
  formData?: FormData;
};

/**
 * Parse a response body that is *probably* our JSON envelope.
 *
 * It is not guaranteed to be. A platform-level rejection is plain text — Vercel
 * answers an oversized upload with `Request Entity Too Large` — and a proxy
 * error is HTML. `JSON.parse` on either throws a raw SyntaxError
 * (`Unexpected token 'R', "Request En"... is not valid JSON`), which is what
 * reached the screen when a large video was uploaded. Returning null keeps the
 * failure on the friendly path below instead.
 */
function parseBody(text: string): unknown {
  if (text.length === 0) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/**
 * A body we could not parse carries no message, so describe the status.
 *
 * 413 is called out because it has a specific, actionable cause here: the
 * request body exceeded the platform's cap rather than anything the app
 * decided.
 */
function statusMessage(status: number): string {
  switch (status) {
    case 413:
      return "That file is too large to send through the server. Uploads now go straight to storage, so please retry — if it still fails, the file may exceed LinkedIn's limit.";
    case 408:
    case 504:
      return "The upload timed out. Check your connection and try again.";
    case 429:
      return "Too many requests. Wait a moment and try again.";
    default:
      return `Request failed (${status}).`;
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers: options.formData
      ? undefined
      : {
          ...(options.body === undefined ? {} : { "content-type": "application/json" }),
        },
    body: options.formData ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
    // Sessions ride on cookies; credentials must be included for cross-origin
    // previews and same-site production alike.
    credentials: "same-origin",
    signal: options.signal,
    cache: "no-store",
  });

  const text = await response.text();
  const payload = parseBody(text);

  if (!response.ok || (payload && typeof payload === "object" && "ok" in payload && !payload.ok)) {
    const error = (payload as { error?: ApiErrorShape } | null)?.error;

    throw new ApiClientError(
      error?.message ?? statusMessage(response.status),
      error?.code ?? "request_failed",
      response.status,
      error?.details,
    );
  }

  return ((payload as { data: T } | null)?.data ?? payload) as T;
}

export function apiGet<T>(path: string, params?: Record<string, string | number | boolean | undefined>, signal?: AbortSignal): Promise<T> {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }

  const query = search.toString();
  return request<T>(query ? `${path}?${query}` : path, { method: "GET", signal });
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: "POST", body: body ?? {} });
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: "PATCH", body: body ?? {} });
}

export function apiDelete<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: "DELETE", ...(body !== undefined ? { body } : {}) });
}

export function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  return request<T>(path, { method: "POST", formData });
}

/**
 * PUT a file straight to a signed storage URL.
 *
 * The bytes deliberately bypass our API: a serverless request body is capped
 * at 4.5 MB, well under the 200 MB video LinkedIn accepts. See
 * 0012_media_direct_upload.sql.
 *
 * The response comes from the storage provider, not our JSON envelope, so this
 * intentionally does not go through `request()`.
 */
export async function apiUploadToSignedUrl(uploadUrl: string, file: File): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: {
      "content-type": file.type || "application/octet-stream",
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");

    throw new ApiClientError(
      `The upload was rejected by storage (${response.status}).${body ? ` ${body.slice(0, 140)}` : ""}`,
      "upload_failed",
      response.status,
    );
  }
}

/** Human message for any thrown value, safe to render. */
export function errorMessage(error: unknown, fallback = "Something went wrong."): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
