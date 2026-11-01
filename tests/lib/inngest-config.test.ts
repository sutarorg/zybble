import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Inngest serve reachability.
 *
 * `/api/inngest` is the one endpoint an external service calls into, so it is
 * the one endpoint that can be broken by configuration alone. It was: an
 * `.optional().transform()` chain turned an absent `INNGEST_DEV` into `false`,
 * which pinned the SDK to cloud mode, where it refuses every request without a
 * signing key. The endpoint answered 500 to GET, PUT and POST alike and the
 * Inngest dashboard reported nothing more useful than "the URL is unreachable".
 *
 * These tests pin the three-state decision (explicit override, then NODE_ENV,
 * then cloud) so it cannot silently collapse into two states again.
 */

const ORIGINAL = { ...process.env };

/** Module state has to be reset because the env module is evaluated lazily. */
async function withEnv(vars: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.resetModules();
  return import("@/inngest/client");
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.resetModules();
});

describe("Inngest serve configuration", () => {
  it("serves without a signing key outside production", async () => {
    const { isInngestServeConfigured, inngestServeProblem } = await withEnv({
      NODE_ENV: "development",
      INNGEST_SIGNING_KEY: undefined,
      INNGEST_DEV: undefined,
    });

    expect(isInngestServeConfigured()).toBe(true);
    expect(inngestServeProblem()).toBeNull();
  });

  it("requires the signing key in production", async () => {
    const { isInngestServeConfigured, inngestServeProblem } = await withEnv({
      NODE_ENV: "production",
      INNGEST_SIGNING_KEY: undefined,
      INNGEST_DEV: undefined,
    });

    expect(isInngestServeConfigured()).toBe(false);
    const problem = inngestServeProblem();
    expect(problem?.variable).toBe("INNGEST_SIGNING_KEY");
    expect(problem?.message).toContain("INNGEST_SIGNING_KEY");
  });

  it("serves in production once the signing key is present", async () => {
    const { isInngestServeConfigured, inngestServeProblem } = await withEnv({
      NODE_ENV: "production",
      INNGEST_SIGNING_KEY: "signkey-prod-test",
      INNGEST_DEV: undefined,
    });

    expect(isInngestServeConfigured()).toBe(true);
    expect(inngestServeProblem()).toBeNull();
  });

  it("treats an absent INNGEST_DEV as unset rather than false", async () => {
    // The regression: `z.enum(...).optional().transform(v => v === "true")`
    // runs the transform on undefined and yields false, which forces cloud
    // mode. Development must stay in dev mode without an explicit override.
    await withEnv({ NODE_ENV: "development", INNGEST_DEV: undefined });
    const { env } = await import("@/lib/env");

    expect(env().INNGEST_DEV).toBeUndefined();
  });

  it("honours an explicit INNGEST_DEV=false in development", async () => {
    const { isInngestServeConfigured } = await withEnv({
      NODE_ENV: "development",
      INNGEST_SIGNING_KEY: undefined,
      INNGEST_DEV: "false",
    });

    // Explicitly asking for cloud mode still needs the key.
    expect(isInngestServeConfigured()).toBe(false);
  });

  it("separates sending events from serving requests", async () => {
    const { canSendInngestEvents, isInngestServeConfigured } = await withEnv({
      NODE_ENV: "production",
      INNGEST_EVENT_KEY: "evt-key",
      INNGEST_SIGNING_KEY: undefined,
      INNGEST_DEV: undefined,
    });

    // The deployment that looked healthy while its endpoint returned 503.
    expect(canSendInngestEvents()).toBe(true);
    expect(isInngestServeConfigured()).toBe(false);
  });
});
