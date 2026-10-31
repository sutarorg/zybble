import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callsFor, createFakeSupabase, type FakeSupabase } from "../helpers/fake-supabase";

/**
 * Seat accounting and seat sync.
 *
 * The billing model is "one seat = one active member, $15 per seat per month",
 * so two things have to hold: the count is derived from membership rows (never
 * from a client claim, never from the request), and pushing it to Dodo is
 * idempotent — a replayed event or a retried job must not double-bill.
 */

const WORKSPACE = "11111111-1111-4111-8111-111111111111";
const DODO_SUB = "sub_pro_123";

// --- module seams -----------------------------------------------------------

const adminState = { current: null as FakeSupabase | null };
const dodoState = {
  configured: true,
  calls: [] as Array<{ dodoSubscriptionId: string; seats: number }>,
  failNext: false,
};

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => adminState.current,
}));

vi.mock("@/lib/env", () => ({
  isDodoConfigured: () => dodoState.configured,
  env: () => ({ NODE_ENV: "test" }),
  isSupabaseConfigured: () => true,
}));

vi.mock("@/lib/dodo/client", () => ({
  updateSubscriptionSeats: async (input: { dodoSubscriptionId: string; seats: number }) => {
    dodoState.calls.push(input);
    if (dodoState.failNext) {
      dodoState.failNext = false;
      throw new Error("Dodo 503");
    }
    return { subscriptionId: input.dodoSubscriptionId, quantity: input.seats };
  },
}));

const { syncSeats, countActiveMembers } = await import("@/features/billing/seats");
const { billableSeats, monthlyAmountCents, PRO_SEAT_PRICE_CENTS } = await import(
  "@/features/billing/entitlements"
);

/** `workspace_members` rows, keyed by the count test that needs them. */
function memberRows(statuses: string[]) {
  return statuses.map((status, index) => ({ id: `m-${index}`, status }));
}

function subscriptionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub-row",
    workspace_id: WORKSPACE,
    plan: "pro",
    status: "active",
    seats: 1,
    dodo_subscription_id: DODO_SUB,
    dodo_customer_id: "cus_123",
    ...overrides,
  };
}

beforeEach(() => {
  dodoState.configured = true;
  dodoState.calls = [];
  dodoState.failNext = false;
});

afterEach(() => {
  adminState.current = null;
});

/* ------------------------------ seat counting ------------------------------ */

describe("seat counting", () => {
  it("counts one seat per active member", () => {
    expect(billableSeats(memberRows(["active", "active", "active"]))).toBe(3);
  });

  it("never bills a pending invitation", () => {
    expect(billableSeats(memberRows(["active", "invited", "invited"]))).toBe(1);
  });

  it("never bills a removed member", () => {
    expect(billableSeats(memberRows(["active", "removed", "removed"]))).toBe(1);
  });

  it("never bills zero — an empty workspace still occupies one seat", () => {
    expect(billableSeats([])).toBe(1);
    expect(billableSeats(memberRows(["invited"]))).toBe(1);
  });

  it("reads the count from the members table, not from a caller", async () => {
    adminState.current = createFakeSupabase({
      workspace_members: { rows: memberRows(["active", "active", "invited"]) },
    });

    await expect(countActiveMembers(WORKSPACE)).resolves.toBe(2);
  });
});

/* -------------------------------- pricing --------------------------------- */

describe("seat pricing", () => {
  it("charges $15 per seat per month", () => {
    expect(PRO_SEAT_PRICE_CENTS).toBe(1500);
  });

  it("multiplies seats by the seat price", () => {
    expect(monthlyAmountCents(1)).toBe(1500);
    expect(monthlyAmountCents(4)).toBe(6000);
  });

  it("never charges for zero seats", () => {
    expect(monthlyAmountCents(0)).toBe(1500);
    expect(monthlyAmountCents(-3)).toBe(1500);
  });
});

/* --------------------------------- sync ------------------------------------ */

describe("seat sync", () => {
  it("pushes the new count to Dodo when it changed", async () => {
    adminState.current = createFakeSupabase({
      workspace_members: { rows: memberRows(["active", "active", "active"]) },
      subscriptions: { single: subscriptionRow({ seats: 1 }) },
    });

    const result = await syncSeats({ workspaceId: WORKSPACE, actorUserId: null });

    expect(result).toMatchObject({ seats: 3, previousSeats: 1, reason: "updated" });
    expect(result.pushedToProvider).toBe(true);
    expect(dodoState.calls).toEqual([{ dodoSubscriptionId: DODO_SUB, seats: 3 }]);
  });

  it("stores the count locally even when the provider push fails", async () => {
    dodoState.failNext = true;

    adminState.current = createFakeSupabase({
      workspace_members: { rows: memberRows(["active", "active"]) },
      subscriptions: { single: subscriptionRow({ seats: 1 }) },
    });

    await expect(syncSeats({ workspaceId: WORKSPACE, actorUserId: null })).rejects.toThrow(
      /retry automatically/i,
    );

    // The local number is already correct; the reconciler closes the gap.
    const writes = callsFor(adminState.current!, "subscriptions", "upsert");
    expect(writes).toHaveLength(1);
    expect(writes[0]!.values).toMatchObject({ seats: 2 });
  });

  it("is idempotent — an unchanged count is not pushed again", async () => {
    adminState.current = createFakeSupabase({
      workspace_members: { rows: memberRows(["active", "active"]) },
      subscriptions: { single: subscriptionRow({ seats: 2 }) },
    });

    const result = await syncSeats({ workspaceId: WORKSPACE, actorUserId: null });

    expect(result.reason).toBe("unchanged");
    expect(result.pushedToProvider).toBe(false);
    expect(dodoState.calls).toHaveLength(0);

    // A replayed event produces the same outcome.
    const replay = await syncSeats({ workspaceId: WORKSPACE, actorUserId: null });
    expect(replay.reason).toBe("unchanged");
    expect(dodoState.calls).toHaveLength(0);
  });

  it("does not call Dodo for a workspace with no subscription", async () => {
    adminState.current = createFakeSupabase({
      workspace_members: { rows: memberRows(["active"]) },
      subscriptions: { single: subscriptionRow({ dodo_subscription_id: null }) },
    });

    const result = await syncSeats({ workspaceId: WORKSPACE, actorUserId: null });

    expect(result.reason).toBe("no_subscription");
    expect(dodoState.calls).toHaveLength(0);
  });

  it("reports an unconfigured provider instead of throwing", async () => {
    dodoState.configured = false;

    adminState.current = createFakeSupabase({
      workspace_members: { rows: memberRows(["active", "active", "active", "active"]) },
      subscriptions: { single: subscriptionRow({ seats: 1 }) },
    });

    const result = await syncSeats({ workspaceId: WORKSPACE, actorUserId: null });

    expect(result.reason).toBe("provider_unavailable");
    expect(result.seats).toBe(4);
    expect(dodoState.calls).toHaveLength(0);
  });

  it("keeps the workspace seat count in step with the subscription row", async () => {
    adminState.current = createFakeSupabase({
      workspace_members: { rows: memberRows(["active", "active", "active"]) },
      subscriptions: { single: subscriptionRow({ seats: 1 }) },
    });

    await syncSeats({ workspaceId: WORKSPACE, actorUserId: null });

    const workspaceWrites = callsFor(adminState.current!, "workspaces", "update");
    expect(workspaceWrites).toHaveLength(1);
    expect(workspaceWrites[0]!.values).toEqual({ seats: 3 });
  });
});
