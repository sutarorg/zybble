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
  const payload = text.length > 0 ? (JSON.parse(text) as unknown) : null;

  if (!response.ok || (payload && typeof payload === "object" && "ok" in payload && !payload.ok)) {
    const error = (payload as { error?: ApiErrorShape } | null)?.error;

    throw new ApiClientError(
      error?.message ?? `Request failed (${response.status}).`,
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

export function apiDelete<T>(path: string): Promise<T> {
  return request<T>(path, { method: "DELETE" });
}

export function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  return request<T>(path, { method: "POST", formData });
}

/** Human message for any thrown value, safe to render. */
export function errorMessage(error: unknown, fallback = "Something went wrong."): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
