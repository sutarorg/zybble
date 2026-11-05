import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * `/admin` handling in the proxy.
 *
 * The status code for a denied non-admin is the one thing a Server Component
 * cannot produce — a page that renders "access denied" still answers 200. So
 * the proxy owns it, and these tests pin all three outcomes: anonymous
 * visitors are redirected to sign in, signed-in non-admins get a genuine 403,
 * and a listed admin is passed through.
 */

const ORIGINAL = { ...process.env };

const FOUNDER = "11111111-1111-4111-8111-111111111111";
const CUSTOMER = "33333333-3333-4333-8333-333333333333";

let currentUser: { id: string } | null = null;

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () =>
        currentUser
          ? { data: { user: currentUser }, error: null }
          : { data: { user: null }, error: { message: "no session" } },
    },
  }),
}));

async function loadProxy() {
  vi.resetModules();
  return import("@/lib/supabase/proxy");
}

function adminRequest(path = "/admin"): NextRequest {
  return new NextRequest(new URL(`https://zybble.com${path}`));
}

beforeEach(() => {
  currentUser = null;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.resetModules();
});

describe("proxy handling of /admin", () => {
  it("redirects an anonymous visitor to login with a return path", async () => {
    const { updateSession } = await loadProxy();
    const response = await updateSession(adminRequest());

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
    expect(response.headers.get("location")).toContain("next=%2Fadmin");
  });

  it("returns a real 403 for a signed-in non-admin", async () => {
    currentUser = { id: CUSTOMER };
    process.env.ZYBBLE_ADMIN_USER_IDS = FOUNDER;

    const { updateSession } = await loadProxy();
    const response = await updateSession(adminRequest());

    expect(response.status).toBe(403);
  });

  it("returns 403 for everyone when the allowlist is unset, including the founder", async () => {
    delete process.env.ZYBBLE_ADMIN_USER_IDS;
    currentUser = { id: FOUNDER };

    const { updateSession } = await loadProxy();
    const response = await updateSession(adminRequest());

    expect(response.status).toBe(403);
  });

  it("passes a listed admin through to the page", async () => {
    currentUser = { id: FOUNDER };
    process.env.ZYBBLE_ADMIN_USER_IDS = FOUNDER;

    const { updateSession } = await loadProxy();
    const response = await updateSession(adminRequest());

    expect(response.status).toBe(200);
  });

  it("protects nested admin paths, not just the index", async () => {
    currentUser = { id: CUSTOMER };
    process.env.ZYBBLE_ADMIN_USER_IDS = FOUNDER;

    const { updateSession } = await loadProxy();

    for (const path of ["/admin/users", "/admin/billing", "/admin/system"]) {
      const response = await updateSession(adminRequest(path));
      expect(response.status, path).toBe(403);
    }
  });

  it("does not treat /administration as an admin path", async () => {
    currentUser = { id: CUSTOMER };
    process.env.ZYBBLE_ADMIN_USER_IDS = FOUNDER;

    const { updateSession } = await loadProxy();
    const response = await updateSession(adminRequest("/administration"));

    // A prefix match without the boundary check would 403 an unrelated route.
    expect(response.status).not.toBe(403);
  });

  it("denies /admin outright when Supabase is not configured", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    const { updateSession } = await loadProxy();
    const response = await updateSession(adminRequest());

    expect(response.status).toBe(403);
  });

  it("marks the 403 response noindex so it is never crawled", async () => {
    currentUser = { id: CUSTOMER };
    process.env.ZYBBLE_ADMIN_USER_IDS = FOUNDER;

    const { updateSession } = await loadProxy();
    const response = await updateSession(adminRequest());

    expect(response.headers.get("x-robots-tag")).toContain("noindex");
  });
});
