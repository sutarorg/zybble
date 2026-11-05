import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * `/api/admin/*` authorisation.
 *
 * These tests call the real route handlers, not the guard in isolation,
 * because the property that matters is that a *direct request* cannot reach
 * admin data. The proxy is not involved — this is what an attacker hitting the
 * endpoint with curl would get.
 *
 * The service-role client is mocked so no test can ever touch a real database,
 * and to prove the ordering: an unauthorised request must be rejected before
 * any admin query is issued.
 */

const ORIGINAL = { ...process.env };

const FOUNDER = "11111111-1111-4111-8111-111111111111";
const CUSTOMER = "33333333-3333-4333-8333-333333333333";

let currentUser: { id: string } | null = null;
let adminQueries = 0;

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      getUser: async () =>
        currentUser
          ? { data: { user: currentUser }, error: null }
          : { data: { user: null }, error: { message: "no session" } },
    },
  }),
}));

// Any attempt to use the service-role client is counted and fails, so a test
// that got past authorisation would fail loudly rather than silently pass.
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => {
    adminQueries += 1;
    throw new Error("service-role client used");
  },
}));

const ROUTES = [
  "/api/admin/overview",
  "/api/admin/users",
  "/api/admin/workspaces",
  "/api/admin/billing",
  "/api/admin/activity",
  "/api/admin/system",
] as const;

async function loadHandlers() {
  vi.resetModules();

  const overview = await import("@/app/api/admin/overview/route");
  const users = await import("@/app/api/admin/users/route");
  const workspaces = await import("@/app/api/admin/workspaces/route");
  const billing = await import("@/app/api/admin/billing/route");
  const activity = await import("@/app/api/admin/activity/route");
  const system = await import("@/app/api/admin/system/route");

  return {
    "/api/admin/overview": overview.GET,
    "/api/admin/users": users.GET,
    "/api/admin/workspaces": workspaces.GET,
    "/api/admin/billing": billing.GET,
    "/api/admin/activity": activity.GET,
    "/api/admin/system": system.GET,
  } as Record<string, (req: NextRequest) => Promise<Response>>;
}

function request(path: string): NextRequest {
  return new NextRequest(new URL(`https://zybble.com${path}`));
}

beforeEach(() => {
  currentUser = null;
  adminQueries = 0;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.resetModules();
});

describe("admin API endpoints", () => {
  it("exposes GET on all six routes", async () => {
    const handlers = await loadHandlers();

    for (const path of ROUTES) {
      expect(typeof handlers[path], path).toBe("function");
    }
  });

  it("returns 401 for a signed-out visitor on every route", async () => {
    const handlers = await loadHandlers();

    for (const path of ROUTES) {
      const response = await handlers[path]!(request(path));
      expect(response.status, path).toBe(401);
    }
  });

  it("returns 403 for a signed-in non-admin on every route", async () => {
    currentUser = { id: CUSTOMER };
    const handlers = await loadHandlers();

    for (const path of ROUTES) {
      const response = await handlers[path]!(request(path));
      expect(response.status, path).toBe(403);
    }
  });

  it("returns 403 for the founder too when the allowlist is unset (fails closed)", async () => {
    delete process.env.ZYBBLE_ADMIN_USER_IDS;
    currentUser = { id: FOUNDER };
    const handlers = await loadHandlers();

    for (const path of ROUTES) {
      const response = await handlers[path]!(request(path));
      expect(response.status, path).toBe(403);
    }
  });

  it("returns 403 when the allowlist lists someone else", async () => {
    process.env.ZYBBLE_ADMIN_USER_IDS = CUSTOMER;
    currentUser = { id: FOUNDER };
    const handlers = await loadHandlers();

    for (const path of ROUTES) {
      const response = await handlers[path]!(request(path));
      expect(response.status, path).toBe(403);
    }
  });

  it("never issues a service-role query before authorising", async () => {
    currentUser = { id: CUSTOMER };
    process.env.ZYBBLE_ADMIN_USER_IDS = FOUNDER;
    const handlers = await loadHandlers();

    for (const path of ROUTES) {
      await handlers[path]!(request(path));
    }

    expect(adminQueries, "an unauthorised request must not touch the admin client").toBe(0);
  });

  it("reaches the data layer only once the founder is authorised", async () => {
    currentUser = { id: FOUNDER };
    process.env.ZYBBLE_ADMIN_USER_IDS = FOUNDER;
    const handlers = await loadHandlers();

    for (const path of ROUTES) {
      const response = await handlers[path]!(request(path));

      // The mocked admin client throws, which surfaces as a 500. What matters
      // is that the request got *past* authorisation — a 401/403 here would
      // mean the allowlist check rejected a correctly listed founder.
      expect([401, 403], `${path} should have been authorised`).not.toContain(response.status);
    }

    expect(adminQueries).toBeGreaterThan(0);
  });

  it("leaks no service-role or provider credential in an error body", async () => {
    currentUser = { id: FOUNDER };
    process.env.ZYBBLE_ADMIN_USER_IDS = FOUNDER;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "super-secret-service-role";
    const handlers = await loadHandlers();

    const response = await handlers["/api/admin/overview"]!(request("/api/admin/overview"));
    const body = await response.text();

    expect(body).not.toContain("super-secret-service-role");
    expect(body).not.toContain("service-role");
  });
});
