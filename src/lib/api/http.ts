import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import type { ZodTypeAny } from "zod";
import { AppError, RateLimitError, toAppError } from "@/lib/errors";
import { requestLogger } from "@/lib/logger";
import {
  fallbackRateLimiter,
  memoryRateLimiter,
  postgresRateLimiter,
  rateLimitHeaders,
  type RateLimiter,
} from "@/lib/rate-limit";
import { sql } from "@/lib/db/sql";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient, type ServerSupabase } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

/**
 * Route-handler plumbing: one envelope, one error path, one log shape.
 *
 * Every JSON response is either
 *   { ok: true, data }                        or
 *   { ok: false, error: { code, message, details? } }
 *
 * Internal errors are logged with their cause and returned as a generic
 * message — stack traces, provider payloads and secrets never cross the wire.
 */

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure = {
  ok: false;
  error: { code: string; message: string; details?: unknown };
};
export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export function ok<T>(data: T, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json<ApiSuccess<T>>({ ok: true, data }, { status, headers });
}

export function fail(error: AppError, headers: Record<string, string> = {}) {
  return NextResponse.json<ApiFailure>(
    {
      ok: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
    },
    { status: error.status, headers },
  );
}

/**
 * The limiter is resolved lazily on first use.
 *
 * With `DATABASE_URL` set, counters live in Postgres and are therefore shared
 * across every serverless instance (the only correct behaviour on Vercel, where
 * an in-memory map would reset per instance and give an attacker N× the
 * intended budget). Without it — local development, CI, and a database outage —
 * the in-memory limiter keeps the endpoints protected per instance.
 */
let limiter: RateLimiter | null = null;

function currentLimiter(): RateLimiter {
  if (limiter) return limiter;

  limiter = process.env.DATABASE_URL
    ? fallbackRateLimiter(
        postgresRateLimiter(async (text, params) => {
          const { rows } = await sql.query(text, params);
          return { rows: rows as Record<string, unknown>[] };
        }),
        memoryRateLimiter(),
      )
    : memoryRateLimiter();

  return limiter;
}

/** Overrides the limiter. Used by tests, and by operators who run Redis. */
export function setApiRateLimiter(next: RateLimiter): void {
  limiter = next;
}

export type RouteAuth = "required" | "optional" | "none";

export type RouteInput<TBody, TQuery> = {
  req: NextRequest;
  requestId: string;
  user: User | null;
  supabase: ServerSupabase | null;
  body: TBody;
  query: TQuery;
  /** Dynamic segments, awaited once before the handler runs (Next 15+). */
  params: Record<string, string>;
};

/** Second argument Next passes to a dynamic-segment route handler. */
export type RouteContext = { params?: Promise<Record<string, string>> };

export type RouteConfig<TBody extends ZodTypeAny | undefined, TQuery extends ZodTypeAny | undefined> =
  {
    auth?: RouteAuth;
    body?: TBody;
    query?: TQuery;
    rateLimit?: { limit: number; windowMs: number };
    /** Included in the rate-limit key; e.g. "posts:create". */
    scope?: string;
    /** Success status; use 201 for creates and 202 for accepted work. */
    status?: number;
  };

function clientKey(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export function defineRoute<
  TBody extends ZodTypeAny | undefined = undefined,
  TQuery extends ZodTypeAny | undefined = undefined,
  TResult = unknown,
>(
  config: RouteConfig<TBody, TQuery>,
  handler: (
    input: RouteInput<
      TBody extends ZodTypeAny ? (TBody["_output"] | undefined) : undefined,
      TQuery extends ZodTypeAny ? TQuery["_output"] : Record<string, string>
    >,
  ) => Promise<TResult | Response>,
) {
  return async function routeHandler(
    req: NextRequest,
    context?: RouteContext,
  ): Promise<NextResponse> {
    const requestId = req.headers.get("x-request-id") ?? randomUUID();
    const params = (await context?.params) ?? {};
    const log = requestLogger(requestId);
    const started = Date.now();

    try {
      // --- rate limit (before any credential work) -------------------------
      let limitHeaders: Record<string, string> = {};

      if (config.rateLimit) {
        const key = [
          config.scope ?? "api",
          config.auth === "required" ? "user" : "ip",
          clientKey(req),
        ].join(":");

        const decision = await currentLimiter().check(
          key,
          config.rateLimit.limit,
          config.rateLimit.windowMs,
        );
        limitHeaders = rateLimitHeaders(decision);

        if (!decision.allowed) {
          const retryAfter = Math.max(
            1,
            Math.ceil((decision.resetAt.getTime() - Date.now()) / 1000),
          );
          throw new RateLimitError(retryAfter);
        }
      }

      // --- identity --------------------------------------------------------
      let user: User | null = null;
      let supabase: ServerSupabase | null = null;

      if (config.auth !== "none" && isSupabaseConfigured()) {
        supabase = await createSupabaseServerClient();
        const { data, error } = await supabase.auth.getUser();
        if (!error && data.user) user = data.user;
      }

      if (config.auth === "required" && !user) {
        throw new AppError("unauthenticated", "Sign in to continue.");
      }

      // --- input validation -------------------------------------------------
      let body: unknown = undefined;

      if (config.body) {
        const raw = await req.json().catch(() => null);
        const parsed = config.body.safeParse(raw);

        if (!parsed.success) {
          throw new AppError("validation_failed", "The request body was not valid.", {
            details: parsed.error.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message,
            })),
          });
        }

        body = parsed.data;
      }

      const rawQuery = Object.fromEntries(req.nextUrl.searchParams.entries());
      const query = config.query
        ? config.query.parse(rawQuery)
        : (rawQuery as Record<string, string>);

      const result = await handler({
        req,
        requestId,
        user,
        supabase,
        body: body as never,
        query: query as never,
        params,
      });

      // OAuth start/callback handlers own their response (a redirect). They
      // bypass the JSON envelope but keep the request id and limit headers.
      if (result instanceof Response) {
        for (const [name, value] of Object.entries({
          "x-request-id": requestId,
          ...limitHeaders,
        })) {
          result.headers.set(name, value);
        }

        log.info("api.request.completed", {
          path: req.nextUrl.pathname,
          method: req.method,
          status: result.status,
          durationMs: Date.now() - started,
        });

        return result as NextResponse;
      }

      log.info("api.request.completed", {
        path: req.nextUrl.pathname,
        method: req.method,
        status: 200,
        durationMs: Date.now() - started,
      });

      return ok(result, config.status ?? 200, {
        "x-request-id": requestId,
        ...limitHeaders,
      });
    } catch (error) {
      const appError = toAppError(error);

      log.error("api.request.failed", {
        path: req.nextUrl.pathname,
        method: req.method,
        code: appError.code,
        status: appError.status,
        durationMs: Date.now() - started,
        // redacted by the logger; safe to pass the whole error object
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      });

      const headers: Record<string, string> = { "x-request-id": requestId };
      if (appError instanceof RateLimitError) {
        headers["Retry-After"] = String(appError.retryAfterSeconds);
      }

      return fail(appError, headers);
    }
  };
}
