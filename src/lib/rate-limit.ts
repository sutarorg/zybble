import { createHash } from "node:crypto";
import { AppError, RateLimitError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/**
 * Rate limiting.
 *
 * Two implementations share one interface:
 *  * `postgresRateLimiter` — the production path. A fixed-window counter held in
 *    `public.rate_limit_counters` and bumped by a SECURITY DEFINER function, so
 *    every Vercel instance shares the same counters without Redis.
 *  * `memoryRateLimiter`  — used in tests and as a fallback if the database is
 *    unavailable, so a Supabase outage degrades to per-instance limiting rather
 *    than an outage of the endpoint.
 *
 * Keys are hashed: raw emails or IP addresses never sit in the counter table.
 */

export type RateLimitDecision = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
};

export type RateLimiter = {
  check(key: string, limit: number, windowMs: number): Promise<RateLimitDecision>;
};

export function hashKey(parts: Array<string | undefined | null>): string {
  return createHash("sha256").update(parts.filter(Boolean).join("|")).digest("hex").slice(0, 40);
}

type SqlQuery = (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;

export function postgresRateLimiter(query: SqlQuery): RateLimiter {
  return {
    async check(key, limit, windowMs) {
      const { rows } = await query(
        `select allowed, remaining, reset_at from public.bump_rate_limit($1, $2, $3)`,
        [key, limit, windowMs],
      );

      const row = rows[0] as
        | { allowed: boolean; remaining: number; reset_at: Date | string }
        | undefined;

      if (!row) {
        // Fail closed on a write failure, open on a missing row (shouldn't happen).
        throw new AppError("internal_error", "Rate limiter unavailable.");
      }

      return {
        allowed: Boolean(row.allowed),
        limit,
        remaining: Number(row.remaining ?? 0),
        resetAt: new Date(row.reset_at),
      };
    },
  };
}

export function memoryRateLimiter(): RateLimiter {
  const counters = new Map<string, { window: number; count: number }>();

  return {
    async check(key, limit, windowMs) {
      const window = Math.floor(Date.now() / windowMs);
      const existing = counters.get(key);
      const count = existing && existing.window === window ? existing.count + 1 : 1;

      counters.set(key, { window, count });

      return {
        allowed: count <= limit,
        limit,
        remaining: Math.max(limit - count, 0),
        resetAt: new Date((window + 1) * windowMs),
      };
    },
  };
}

export function rateLimitHeaders(decision: RateLimitDecision): Record<string, string> {
  return {
    "RateLimit-Limit": String(decision.limit),
    "RateLimit-Remaining": String(decision.remaining),
    "RateLimit-Reset": String(Math.ceil(decision.resetAt.getTime() / 1000)),
  };
}

/** Assert-or-throw convenience used by route handlers. */
export async function enforceRateLimit(
  limiter: RateLimiter,
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitDecision> {
  const decision = await limiter.check(key, limit, windowMs);

  if (!decision.allowed) {
    const retryAfter = Math.max(
      1,
      Math.ceil((decision.resetAt.getTime() - Date.now()) / 1000),
    );
    throw new RateLimitError(retryAfter);
  }

  return decision;
}

/**
 * Presets. Auth endpoints are the most abusable surface in the product, so they
 * get the tightest windows; the remainder are generous enough for normal use
 * while stopping credential stuffing and accidental publish loops.
 */
export const RATE_LIMITS = {
  auth: { limit: 10, windowMs: 5 * 60_000 },
  authRead: { limit: 30, windowMs: 5 * 60_000 },
  oauthStart: { limit: 10, windowMs: 10 * 60_000 },
  publish: { limit: 20, windowMs: 60_000 },
  mediaUpload: { limit: 30, windowMs: 5 * 60_000 },
  billing: { limit: 20, windowMs: 60_000 },
  api: { limit: 120, windowMs: 60_000 },
} as const;

/**
 * Use `primary`, but fall back to `fallback` if it throws.
 *
 * Rate limiting is a protective control, not a feature: if the counters are
 * unreachable the endpoint must keep serving requests with weaker protection,
 * not return 500 to every user. Without this a brief database blip would take
 * the whole product down — which is a worse outcome than a short window of
 * per-instance limiting.
 */
export function fallbackRateLimiter(primary: RateLimiter, fallback: RateLimiter): RateLimiter {
  let warned = false;

  return {
    async check(key, limit, windowMs) {
      try {
        return await primary.check(key, limit, windowMs);
      } catch (error) {
        if (!warned) {
          warned = true;
          logger.error("rate_limit.primary_unavailable", {
            error: error instanceof Error ? error.message : "unknown",
          });
        }
        return fallback.check(key, limit, windowMs);
      }
    },
  };
}
