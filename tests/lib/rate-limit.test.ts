import { describe, expect, it } from "vitest";
import {
  fallbackRateLimiter,
  hashKey,
  memoryRateLimiter,
  type RateLimiter,
} from "@/lib/rate-limit";

/**
 * Rate limiting is a protective control, so its own failure modes matter:
 * a limiter that throws takes the endpoint with it, and a limiter keyed on raw
 * input leaks that input into the counter table.
 */

function brokenLimiter(): RateLimiter {
  return {
    async check() {
      throw new Error("connection terminated");
    },
  };
}

describe("hashKey", () => {
  it("never stores the raw value it was given", () => {
    const hashed = hashKey(["ada@example.com"]);
    expect(hashed).not.toContain("ada");
    expect(hashed).not.toContain("@");
    expect(hashed).toMatch(/^[a-f0-9]+$/);
  });

  it("is stable for the same input and different for different input", () => {
    expect(hashKey(["a", "b"])).toBe(hashKey(["a", "b"]));
    expect(hashKey(["a", "b"])).not.toBe(hashKey(["b", "a"]));
  });

  it("ignores empty parts so a missing IP does not collide with an empty string", () => {
    expect(hashKey(["a", null, undefined])).toBe(hashKey(["a"]));
  });
});

describe("memoryRateLimiter", () => {
  it("allows up to the limit then blocks", async () => {
    const limiter = memoryRateLimiter();

    for (let i = 0; i < 3; i += 1) {
      await expect(limiter.check("k", 3, 60_000)).resolves.toMatchObject({ allowed: true });
    }

    await expect(limiter.check("k", 3, 60_000)).resolves.toMatchObject({ allowed: false });
  });

  it("counts keys independently", async () => {
    const limiter = memoryRateLimiter();
    await limiter.check("a", 1, 60_000);

    await expect(limiter.check("a", 1, 60_000)).resolves.toMatchObject({ allowed: false });
    await expect(limiter.check("b", 1, 60_000)).resolves.toMatchObject({ allowed: true });
  });

  it("reports a reset time in the future", async () => {
    const decision = await memoryRateLimiter().check("k", 5, 60_000);
    expect(decision.resetAt.getTime()).toBeGreaterThan(Date.now());
    expect(decision.remaining).toBeLessThanOrEqual(decision.limit);
  });
});

describe("fallbackRateLimiter", () => {
  it("uses the primary limiter when it works", async () => {
    const limiter = fallbackRateLimiter(memoryRateLimiter(), memoryRateLimiter());
    await expect(limiter.check("k", 5, 60_000)).resolves.toMatchObject({ allowed: true });
  });

  it("degrades to the fallback instead of failing the request", async () => {
    // A database blip must not turn every endpoint into a 500.
    const limiter = fallbackRateLimiter(brokenLimiter(), memoryRateLimiter());
    await expect(limiter.check("k", 5, 60_000)).resolves.toMatchObject({ allowed: true });
  });

  it("keeps enforcing the limit after degrading", async () => {
    const limiter = fallbackRateLimiter(brokenLimiter(), memoryRateLimiter());

    await expect(limiter.check("k", 1, 60_000)).resolves.toMatchObject({ allowed: true });
    await expect(limiter.check("k", 1, 60_000)).resolves.toMatchObject({ allowed: false });
  });
});
