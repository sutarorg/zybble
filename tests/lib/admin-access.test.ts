import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Platform-admin allowlist.
 *
 * This module is the whole of `/admin`'s authorisation, so the properties that
 * matter are the failure modes: an absent variable, a variable that is present
 * but empty, and one full of junk must all deny everyone. A permissive default
 * here would expose every customer's data.
 */

const ORIGINAL = { ...process.env };

const ADMIN_A = "11111111-1111-4111-8111-111111111111";
const ADMIN_B = "22222222-2222-4222-8222-222222222222";
const CUSTOMER = "33333333-3333-4333-8333-333333333333";

async function withAllowlist(raw: string | undefined) {
  if (raw === undefined) delete process.env.ZYBBLE_ADMIN_USER_IDS;
  else process.env.ZYBBLE_ADMIN_USER_IDS = raw;

  vi.resetModules();
  return import("@/lib/admin/access");
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.resetModules();
});

describe("allowlist parsing", () => {
  it("accepts a single UUID", async () => {
    const { adminAllowlist } = await withAllowlist(ADMIN_A);
    const list = adminAllowlist();

    expect(list.configured).toBe(true);
    expect(list.ids).toEqual([ADMIN_A]);
    expect(list.reason).toBe("ok");
  });

  it("accepts several UUIDs separated by commas and stray whitespace", async () => {
    const { adminAllowlist } = await withAllowlist(`  ${ADMIN_A} ,\n${ADMIN_B}  `);
    expect(adminAllowlist().ids).toEqual([ADMIN_A, ADMIN_B]);
  });

  it("de-duplicates ids", async () => {
    const { adminAllowlist } = await withAllowlist(`${ADMIN_A},${ADMIN_A}`);
    expect(adminAllowlist().ids).toEqual([ADMIN_A]);
  });

  it("normalises upper-case UUIDs", async () => {
    const { adminAllowlist, isPlatformAdmin } = await withAllowlist(ADMIN_A.toUpperCase());

    // A founder copying an id out of a dashboard may get either case.
    expect(adminAllowlist().ids).toEqual([ADMIN_A]);
    expect(isPlatformAdmin(ADMIN_A)).toBe(true);
  });

  it("rejects the all-zero UUID shape", async () => {
    const { adminAllowlist } = await withAllowlist("00000000-0000-0000-0000-000000000000");

    expect(adminAllowlist().configured).toBe(false);
    expect(adminAllowlist().reason).toBe("no_valid_entries");
  });
});

describe("fail-closed behaviour", () => {
  it("denies everyone when the variable is absent", async () => {
    const { isPlatformAdmin, adminAllowlist } = await withAllowlist(undefined);

    expect(adminAllowlist().configured).toBe(false);
    expect(adminAllowlist().reason).toBe("missing");
    expect(isPlatformAdmin(ADMIN_A)).toBe(false);
    expect(adminCount(adminAllowlist())).toBe(0);
  });

  it("denies everyone when the variable is present but empty", async () => {
    const { isPlatformAdmin, adminAllowlist } = await withAllowlist("");
    const list = adminAllowlist();

    expect(list.configured).toBe(false);
    expect(list.reason).toBe("empty");
    expect(isPlatformAdmin(ADMIN_A)).toBe(false);
  });

  it("denies everyone when every entry is malformed", async () => {
    const { isPlatformAdmin, adminAllowlist } = await withAllowlist("founder, tejas@example.com");

    expect(adminAllowlist().configured).toBe(false);
    expect(isPlatformAdmin(ADMIN_A)).toBe(false);
  });

  it("still admits the valid id when one entry is malformed", async () => {
    const { isPlatformAdmin, adminAllowlist } = await withAllowlist(`${ADMIN_A}, not-a-uuid`);
    const list = adminAllowlist();

    expect(list.configured).toBe(true);
    expect(list.invalid).toEqual(["not-a-uuid"]);
    expect(isPlatformAdmin(ADMIN_A)).toBe(true);
  });
});

describe("isPlatformAdmin", () => {
  it("admits a listed id and rejects everyone else", async () => {
    const { isPlatformAdmin } = await withAllowlist(`${ADMIN_A},${ADMIN_B}`);

    expect(isPlatformAdmin(ADMIN_A)).toBe(true);
    expect(isPlatformAdmin(ADMIN_B)).toBe(true);
    expect(isPlatformAdmin(CUSTOMER)).toBe(false);
  });

  it("rejects null, undefined and empty string", async () => {
    const { isPlatformAdmin } = await withAllowlist(ADMIN_A);

    expect(isPlatformAdmin(null)).toBe(false);
    expect(isPlatformAdmin(undefined)).toBe(false);
    expect(isPlatformAdmin("")).toBe(false);
  });

  it("does not match on a prefix of a listed id", async () => {
    const { isPlatformAdmin } = await withAllowlist(ADMIN_A);

    expect(isPlatformAdmin(ADMIN_A.slice(0, -1))).toBe(false);
    expect(isPlatformAdmin(`${ADMIN_A}0`)).toBe(false);
  });
});

function adminCount(list: { ids: readonly string[] }): number {
  return list.ids.length;
}
