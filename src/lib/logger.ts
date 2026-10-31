/**
 * Structured logging.
 *
 * Logs are JSON lines with a stable shape so they can be shipped to any log
 * sink. The redactor is deliberately paranoid: any key that looks like a
 * credential is replaced before the record is serialised, and free-text error
 * messages are scrubbed too. Nothing in this module ever receives a token
 * intentionally, but defence in depth beats a leak in an incident review.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const REDACTED = "[redacted]";

const SENSITIVE_KEY = /token|secret|password|authorization|cookie|api[-_]?key|signature|bearer|otp|refresh/i;
const SENSITIVE_VALUE = /\b(ghp_|sk_|whsec_|eyJ[A-Za-z0-9_-]{10,}|[A-Za-z0-9_-]{60,})\b/;

function redactValue(value: unknown, depth = 0): unknown {
  if (depth > 6) return REDACTED;

  if (typeof value === "string") {
    // Very long opaque strings are almost always credentials or JWTs.
    if (value.length > 200) return REDACTED;
    return SENSITIVE_VALUE.test(value) ? REDACTED : value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(entry, depth + 1));
  }

  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      output[key] = SENSITIVE_KEY.test(key) ? REDACTED : redactValue(entry, depth + 1);
    }
    return output;
  }

  return value;
}

export type LogContext = Record<string, unknown>;

function emit(level: LogLevel, event: string, context: LogContext = {}): void {
  const record = {
    level,
    event,
    time: new Date().toISOString(),
    service: "zybble",
    ...(redactValue(context) as LogContext),
  };

  const line = JSON.stringify(record);

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else if (level === "debug" && process.env.NODE_ENV !== "production") console.debug(line);
  else if (level !== "debug") console.log(line);
}

export const logger = {
  debug: (event: string, context?: LogContext) => emit("debug", event, context),
  info: (event: string, context?: LogContext) => emit("info", event, context),
  warn: (event: string, context?: LogContext) => emit("warn", event, context),
  error: (event: string, context?: LogContext) => emit("error", event, context),
};

/** Attach a request id to every log line produced while handling a request. */
export function requestLogger(requestId: string) {
  return {
    debug: (event: string, context?: LogContext) =>
      emit("debug", event, { requestId, ...context }),
    info: (event: string, context?: LogContext) =>
      emit("info", event, { requestId, ...context }),
    warn: (event: string, context?: LogContext) =>
      emit("warn", event, { requestId, ...context }),
    error: (event: string, context?: LogContext) =>
      emit("error", event, { requestId, ...context }),
  };
}
