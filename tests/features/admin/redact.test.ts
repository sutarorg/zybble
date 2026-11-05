import { describe, expect, it } from "vitest";
import { redactError, redactMetadata } from "@/features/admin/redact";

/**
 * Admin JSON redaction.
 *
 * Audit metadata is free-form JSONB written by many call sites, so the admin
 * layer cannot trust any of them. These tests pin that a credential-shaped key
 * is removed rather than masked: a masked value still tells an observer that
 * the key existed and roughly how long the value was.
 */

describe("redactMetadata", () => {
  it("removes keys that look like credentials", () => {
    const result = redactMetadata({
      access_token: "secret",
      refreshToken: "secret",
      api_key: "secret",
      authorization: "Bearer x",
      password: "hunter2",
      cookie: "sid=1",
      signature: "abc",
      accessTokenCiphertext: "cipher",
    });

    expect(result).toEqual(null);
  });

  it("keeps ordinary operational fields", () => {
    const result = redactMetadata({
      kind: "image",
      bytes: 2048,
      verified: true,
      nested: { plan: "pro", seats: 3 },
    });

    expect(result).toEqual({
      kind: "image",
      bytes: 2048,
      verified: true,
      nested: { plan: "pro", seats: 3 },
    });
  });

  it("redacts long opaque strings that look like tokens", () => {
    const result = redactMetadata({ note: "a".repeat(80) });
    expect(result).toEqual({ note: "[redacted]" });
  });

  it("redacts nested credentials at any depth", () => {
    const result = redactMetadata({
      workspace: { linkedin: { access_token: "secret", displayName: "Acme" } },
    });

    expect(result).toEqual({ workspace: { linkedin: { displayName: "Acme" } } });
  });

  it("redacts credentials inside arrays", () => {
    const result = redactMetadata({
      items: [{ token: "secret", id: 1 }],
    });

    expect(result).toEqual({ items: [{ id: 1 }] });
  });

  it("returns null for nothing useful", () => {
    expect(redactMetadata(null)).toBe(null);
    expect(redactMetadata(undefined)).toBe(null);
    expect(redactMetadata({ token: "x" })).toBe(null);
    expect(redactMetadata("a string")).toBe(null);
    expect(redactMetadata([1, 2])).toBe(null);
  });

  it("caps depth so a deeply nested payload cannot hang the request", () => {
    let nested: Record<string, unknown> = { leaf: "value" };
    for (let index = 0; index < 12; index += 1) {
      nested = { child: nested };
    }

    const result = redactMetadata(nested);
    expect(JSON.stringify(result)).toContain("[omitted]");
  });
});

describe("redactError", () => {
  it("keeps only the first line", () => {
    expect(redactError("first line\nsecond line")).toBe("first line");
  });

  it("truncates a long message", () => {
    const result = redactError("x".repeat(400));
    expect(result?.length).toBe(161);
    expect(result?.endsWith("…")).toBe(true);
  });

  it("returns null when there is nothing to show", () => {
    expect(redactError(null)).toBe(null);
    expect(redactError("")).toBe(null);
    expect(redactError("   ")).toBe(null);
  });
});
