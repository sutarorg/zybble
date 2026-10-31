/**
 * Application error taxonomy.
 *
 * Every error that can reach a user carries:
 *  * `code`    — a stable machine-readable identifier for the client;
 *  * `message` — a safe, actionable sentence (never an exception dump);
 *  * `status`  — the HTTP status to answer with.
 *
 * Internals (stack traces, provider payloads, SQL errors) are logged server-side
 * only and never serialised into a response.
 */

export type ErrorCode =
  | "bad_request"
  | "validation_failed"
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "entitlement_required"
  | "external_service_unavailable"
  | "integration_not_configured"
  | "internal_error";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  readonly details?: unknown;
  readonly cause?: unknown;

  constructor(
    code: ErrorCode,
    message: string,
    options: {
      status?: number;
      retryable?: boolean;
      details?: unknown;
      cause?: unknown;
    } = {},
  ) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.status = options.status ?? statusForCode(code);
    this.retryable = options.retryable ?? false;
    this.details = options.details;
    this.cause = options.cause;
  }
}

function statusForCode(code: ErrorCode): number {
  switch (code) {
    case "bad_request":
    case "validation_failed":
      return 400;
    case "unauthenticated":
      return 401;
    case "forbidden":
      return 403;
    case "not_found":
      return 404;
    case "conflict":
      return 409;
    case "rate_limited":
      return 429;
    case "entitlement_required":
      return 402;
    case "external_service_unavailable":
      return 503;
    case "integration_not_configured":
      return 503;
    default:
      return 500;
  }
}

export class ValidationError extends AppError {
  constructor(message = "The request was not valid.", details?: unknown) {
    super("validation_failed", message, { details });
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = "Sign in to continue.") {
    super("unauthenticated", message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have access to this resource.") {
    super("forbidden", message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "That resource does not exist.") {
    super("not_found", message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super("conflict", message, { details });
  }
}

export class RateLimitError extends AppError {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number, message = "Too many requests. Try again shortly.") {
    super("rate_limited", message, {
      retryable: true,
      details: { retryAfterSeconds },
    });
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** The feature exists but the workspace's plan does not include it. */
export class EntitlementError extends AppError {
  constructor(message: string, details?: unknown) {
    super("entitlement_required", message, { details });
  }
}

/** An upstream (LinkedIn, Dodo, Resend, Supabase) failed. */
export class ExternalServiceError extends AppError {
  constructor(
    service: string,
    message: string,
    options: { retryable?: boolean; status?: number; cause?: unknown; details?: unknown } = {},
  ) {
    super("external_service_unavailable", message, {
      retryable: options.retryable ?? true,
      status: options.status,
      cause: options.cause,
      details: { service, ...(options.details ?? {}) },
    });
  }
}

/** A required credential is missing, so the capability is genuinely off. */
export class IntegrationNotConfiguredError extends AppError {
  constructor(integration: string) {
    super(
      "integration_not_configured",
      `${integration} is not configured on this deployment.`,
      { details: { integration } },
    );
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/** Convert anything thrown into an AppError without leaking internals. */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error;

  return new AppError(
    "internal_error",
    "Something went wrong on our side. The failure has been logged.",
    { cause: error },
  );
}
