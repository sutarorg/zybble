import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Cloudflare R2 configuration.
 *
 * Media is the one feature that fails completely rather than degrading when
 * credentials are missing, so "is it configured" has to be right. These pin
 * three things that are easy to get wrong:
 *
 *  - a partial configuration counts as unconfigured. Two of three secrets is
 *    not "mostly working", it is a signature error at upload time;
 *  - the endpoint is account-scoped, not a fixed AWS host;
 *  - the default bucket name, because it is the value the deployment docs tell
 *    people to create and a mismatch is a silent empty bucket.
 */

const ORIGINAL = { ...process.env };

async function withEnv(vars: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.resetModules();

  return {
    env: await import("@/lib/env"),
    client: await import("@/lib/r2/client"),
  };
}

/** Every R2 variable present and valid. */
const FULL = {
  R2_ACCOUNT_ID: "abc123def456abc123def456abc123de",
  R2_ACCESS_KEY_ID: "key-id",
  R2_SECRET_ACCESS_KEY: "secret",
};

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.resetModules();
});

describe("isR2Configured", () => {
  it("is true when all three credentials are present", async () => {
    const { env } = await withEnv(FULL);
    expect(env.isR2Configured()).toBe(true);
    expect(env.r2Blockers()).toEqual([]);
  });

  it("is false when any one credential is missing", async () => {
    for (const key of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"]) {
      const { env } = await withEnv({ ...FULL, [key]: undefined });
      expect(env.isR2Configured(), `${key} missing should mean unconfigured`).toBe(false);
    }
  });

  it("is false when nothing is set", async () => {
    const { env } = await withEnv({
      R2_ACCOUNT_ID: undefined,
      R2_ACCESS_KEY_ID: undefined,
      R2_SECRET_ACCESS_KEY: undefined,
    });

    expect(env.isR2Configured()).toBe(false);
  });

  it("names the missing variables so a deploy can be fixed without guesswork", async () => {
    const { env } = await withEnv({ ...FULL, R2_SECRET_ACCESS_KEY: undefined });

    const blockers = env.r2Blockers();
    expect(blockers).toHaveLength(1);
    expect(blockers[0]).toContain("R2_SECRET_ACCESS_KEY");
    expect(blockers[0]).toContain("Cloudflare R2");
  });
});

describe("endpoint and bucket", () => {
  it("builds an account-scoped endpoint, not an AWS one", async () => {
    const { client } = await withEnv(FULL);

    expect(client.r2Endpoint()).toBe("https://abc123def456abc123def456abc123de.r2.cloudflarestorage.com");
    expect(client.r2Endpoint()).not.toContain("amazonaws.com");
  });

  it("defaults the bucket to zybble-post-media", async () => {
    const { client } = await withEnv({ ...FULL, R2_BUCKET: undefined });
    expect(client.r2Bucket()).toBe("zybble-post-media");
  });

  it("honours an explicit bucket name", async () => {
    const { client } = await withEnv({ ...FULL, R2_BUCKET: "my-bucket" });
    expect(client.r2Bucket()).toBe("my-bucket");
  });

  it("rejects an over-long bucket name before it reaches R2", async () => {
    const { env } = await withEnv({ ...FULL, R2_BUCKET: "a".repeat(64) });
    expect(() => env.env()).toThrow();
  });
});

describe("public URLs", () => {
  it("leaves the bucket private by default", async () => {
    const { client } = await withEnv({ ...FULL, R2_PUBLIC_URL: undefined });

    expect(client.r2PublicBaseUrl()).toBeNull();
    // Privacy is opt-in: no environment variable, no public read.
    expect(process.env.R2_PUBLIC_URL).toBeUndefined();
  });

  it("returns a trailing-slash-free base when public read is enabled", async () => {
    const { client } = await withEnv({ ...FULL, R2_PUBLIC_URL: "https://media.zybble.com/" });
    expect(client.r2PublicBaseUrl()).toBe("https://media.zybble.com");
  });
});

describe("r2Client", () => {
  /**
   * The important part is *how* it fails. Signing a request with empty
   * credentials would surface to the user as an opaque S3 signature error from
   * inside the SDK; throwing `IntegrationNotConfiguredError` turns the same
   * situation into a 503 that names the integration.
   */
  it("fails as a not-configured integration, not as an SDK signature error", async () => {
    const { client } = await withEnv({
      R2_ACCOUNT_ID: undefined,
      R2_ACCESS_KEY_ID: undefined,
      R2_SECRET_ACCESS_KEY: undefined,
    });

    let thrown: unknown;
    try {
      client.r2Client();
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as { code?: string }).code).toBe("integration_not_configured");
    expect((thrown as Error).message).toMatch(/Cloudflare R2/);
    expect((thrown as Error).message).not.toMatch(/signature|credential.*scope/i);
  });

  it("builds a client once credentials are present, and memoises it", async () => {
    const { client } = await withEnv(FULL);

    const first = client.r2Client();
    expect(first).toBe(client.r2Client());
  });
});
