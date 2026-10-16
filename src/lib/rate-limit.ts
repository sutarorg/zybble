/**
 * In-process fixed-window rate limiter.
 *
 * Deliberately dependency-free and process-local: it protects against casual
 * abuse of login, checkout, upload and chatbot endpoints on a single instance.
 * A multi-region deployment should additionally enforce limits at the edge
 * (Vercel Firewall / Cloudflare); see LAUNCH_BLOCKERS.md.
 *
 * Fail-closed: when the store is unavailable the limiter denies rather than
 * silently allowing traffic.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const bucket = { count: 1, resetAt: now + windowMs };
    buckets.set(key, bucket);
    return { allowed: true, remaining: limit - 1, resetAt: bucket.resetAt, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  const allowed = existing.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
    retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
  };
}

/** Preset limits used by the API routes. */
export const LIMITS = {
  login: { limit: 8, windowMs: 10 * 60_000 },
  signup: { limit: 5, windowMs: 60 * 60_000 },
  passwordReset: { limit: 5, windowMs: 60 * 60_000 },
  checkout: { limit: 12, windowMs: 10 * 60_000 },
  webhook: { limit: 240, windowMs: 60_000 },
  chat: { limit: 20, windowMs: 60_000 },
  search: { limit: 60, windowMs: 60_000 },
  videoUploadGrant: { limit: 40, windowMs: 60 * 60_000 },
  resourceUpload: { limit: 60, windowMs: 60 * 60_000 },
  download: { limit: 120, windowMs: 10 * 60_000 },
  mutation: { limit: 120, windowMs: 60_000 },
  /** Catalog engagement beacons: batched, so one window covers a lot of scrolling. */
  analytics: { limit: 60, windowMs: 60_000 },
} as const;

/** Best-effort client identity for a request (no trusted forwarding headers). */
export function clientKey(request: Request, scope: string, userId?: string | null): string {
  if (userId) return `${scope}:user:${userId}`;
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";
  return `${scope}:ip:${ip}`;
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.floor(result.resetAt / 1000)),
    ...(result.allowed ? {} : { "Retry-After": String(Math.max(1, result.retryAfterSeconds)) }),
  };
}

/** Test-only hook so a suite can start from a clean limiter. */
export function __resetRateLimits(): void {
  buckets.clear();
}
