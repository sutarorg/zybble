import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SqlExecutor, TestDb } from "../db/harness";
import { createTestDb, seedUser, seedWorkspace } from "../db/harness";
import { createFakeSupabase, callsFor, type FakeSupabase } from "../helpers/fake-supabase";

/**
 * Dodo webhook processing — idempotency, ordering and entitlement handling.
 *
 * The SQL executor is a real embedded Postgres running the project's migrations,
 * so the claim logic is exercised against the actual `webhook_events` primary
 * key. The Supabase data client is faked, which keeps the assertions on
 * behaviour ("did we write the Pro snapshot?") rather than on PostgREST.
 */

const WEBHOOK_KEY = "whsec_" + Buffer.from("processing-secret").toString("base64").replace(/=+$/, "");
const NOW = new Date("2026-06-01T09:00:00.000Z");

const adminState: { current: FakeSupabase | null } = { current: null };

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => adminState.current,
}));

const { processDodoWebhook } = await import("@/features/billing/webhooks");
const { setSqlExecutor, getSqlExecutor } = await import("@/lib/db/sql");
const { signWebhook } = await import("@/lib/dodo/webhooks");
const { resetEnvCache } = await import("@/lib/env");

let db: TestDb;

function executeAsSql(executor: SqlExecutor) {
  return {
    async query<T extends Record<string, unknown> = Record<string, unknown>>(
      text: string,
      params: unknown[] = [],
    ) {
      const result = await executor.query<T>(text, params);
      return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
    },
  };
}

function signedRequest(body: string, id = "evt_1") {
  const timestamp = Math.floor(NOW.getTime() / 1000);
  const signature = signWebhook({ id, timestamp, body, secret: WEBHOOK_KEY });

  const headers = new Headers();
  headers.set("webhook-id", id);
  headers.set("webhook-timestamp", String(timestamp));
  headers.set("webhook-signature", signature);
  return headers;
}

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";

function subscriptionActive(body: Record<string, unknown> = {}) {
  return JSON.stringify({
    type: "subscription.active",
    timestamp: NOW.toISOString(),
    data: {
      subscription_id: "sub_123",
      customer: { customer_id: "cus_123", email: "owner@example.com" },
      status: "active",
      quantity: 3,
      currency: "USD",
      recurring_pre_tax_amount: 4500,
      previous_billing_date: new Date(Date.now() - 86_400_000).toISOString(),
      next_billing_date: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      metadata: { workspace_id: WORKSPACE_ID },
      ...body,
    },
  });
}

const OWNER_ID = "22222222-2222-4222-8222-222222222222";

beforeAll(async () => {
  db = await createTestDb();
  setSqlExecutor(executeAsSql(db.admin) as never);

  await seedUser(db, { id: OWNER_ID, email: "owner@example.com" });
  await seedWorkspace(db, { id: WORKSPACE_ID, ownerId: OWNER_ID, name: "Test Workspace" });
});

afterAll(async () => {
  setSqlExecutor(null);
  await db.close();
});

beforeEach(async () => {
  process.env.DODO_PAYMENTS_API_KEY = "test_key";
  process.env.DODO_PAYMENTS_WEBHOOK_KEY = WEBHOOK_KEY;
  process.env.DODO_PRO_PRODUCT_ID = "pdt_test";
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
  resetEnvCache();

  await db.admin.query(`delete from public.webhook_events`);
  adminState.current = createFakeSupabase({
    // The workspace exists; everything else starts empty.
    workspaces: { single: { id: WORKSPACE_ID, name: "Test Workspace" } },
  });
});

afterEach(() => {
  delete process.env.DODO_PAYMENTS_API_KEY;
  delete process.env.DODO_PAYMENTS_WEBHOOK_KEY;
  delete process.env.DODO_PRO_PRODUCT_ID;
  resetEnvCache();
});

describe("processDodoWebhook", () => {
  it("applies a subscription snapshot and records the event id", async () => {
    const body = subscriptionActive();
    const result = await processDodoWebhook({ body, headers: signedRequest(body), now: NOW });

    expect(result.status).toBe("processed");
    expect(result.workspaceId).toBe(WORKSPACE_ID);

    const subscriptionWrites = callsFor(adminState.current!, "subscriptions", "upsert");
    expect(subscriptionWrites).toHaveLength(1);

    const payload = subscriptionWrites[0]!.values as Record<string, unknown>;
    expect(payload.plan).toBe("pro");
    expect(payload.status).toBe("active");
    expect(payload.seats).toBe(3);
    expect(payload.dodo_subscription_id).toBe("sub_123");

    // The workspace's cached plan column follows the entitlement.
    const workspaceUpdates = callsFor(adminState.current!, "workspaces", "update");
    expect(workspaceUpdates[0]!.values).toMatchObject({ plan: "pro", seats: 3 });

    const stored = await db.admin.query<{ event_id: string; status: string }>(
      `select event_id, status from public.webhook_events where event_id = $1`,
      ["evt_1"],
    );
    expect(stored.rows[0]?.status).toBe("processed");
  });

  it("writes an audit entry and a workspace notification for a new Pro subscription", async () => {
    const body = subscriptionActive();
    await processDodoWebhook({ body, headers: signedRequest(body), now: NOW });

    expect(callsFor(adminState.current!, "audit_logs", "insert")).toHaveLength(1);
    expect(callsFor(adminState.current!, "notifications", "insert")).toHaveLength(1);
  });

  it("is idempotent: a replayed event id does not touch entitlements twice", async () => {
    const body = subscriptionActive();
    const headers = signedRequest(body);

    const first = await processDodoWebhook({ body, headers, now: NOW });
    const second = await processDodoWebhook({ body, headers, now: NOW });

    expect(first.status).toBe("processed");
    expect(second.status).toBe("duplicate");

    expect(callsFor(adminState.current!, "subscriptions", "upsert")).toHaveLength(1);
  });

  it("rolls the claim back when handling fails, so the provider retry reprocesses", async () => {
    adminState.current = createFakeSupabase({
      subscriptions: { error: null, single: null },
    });

    // Force a failure inside the apply step by making the workspace update
    // throw: the fake client is swapped for one whose update rejects.
    const failing = createFakeSupabase({});
    failing.from = (() => {
      throw new Error("database offline");
    }) as never;
    adminState.current = failing;

    const body = subscriptionActive();

    await expect(processDodoWebhook({ body, headers: signedRequest(body), now: NOW })).rejects.toThrow();

    const stored = await db.admin.query<{ event_id: string }>(
      `select event_id from public.webhook_events where event_id = $1`,
      ["evt_1"],
    );

    expect(stored.rows).toHaveLength(0);
  });

  it("ignores an event it cannot attribute to a workspace", async () => {
    const body = subscriptionActive({ metadata: {} });
    const result = await processDodoWebhook({ body, headers: signedRequest(body), now: NOW });

    expect(result.status).toBe("processed");
    expect(result.detail).toBe("workspace_not_resolved");
    expect(callsFor(adminState.current!, "subscriptions", "upsert")).toHaveLength(0);
  });

  it("refuses an unverifiable signature", async () => {
    const body = subscriptionActive();
    const headers = signedRequest(body);
    headers.set("webhook-signature", "v1,not-the-right-signature");

    await expect(processDodoWebhook({ body, headers, now: NOW })).rejects.toThrow(
      /signature|verif/i,
    );

    const stored = await db.admin.query(`select event_id from public.webhook_events`);
    expect(stored.rows).toHaveLength(0);
  });

  it("refuses to run when Dodo is not configured", async () => {
    delete process.env.DODO_PAYMENTS_API_KEY;
    resetEnvCache();

    const body = subscriptionActive();
    await expect(processDodoWebhook({ body, headers: signedRequest(body), now: NOW })).rejects.toThrow(
      /not configured/i,
    );
  });

  it("drops the workspace back to Free when the subscription lapses", async () => {
    const body = JSON.stringify({
      type: "subscription.cancelled",
      timestamp: NOW.toISOString(),
      data: {
        subscription_id: "sub_123",
        customer: { customer_id: "cus_123" },
        status: "cancelled",
        quantity: 3,
        cancelled_at: NOW.toISOString(),
        metadata: { workspace_id: WORKSPACE_ID },
      },
    });

    await processDodoWebhook({ body, headers: signedRequest(body, "evt_cancel"), now: NOW });

    const write = callsFor(adminState.current!, "workspaces", "update")[0]!;
    expect(write.values).toMatchObject({ plan: "free" });
  });

  it("records payments and notifies the workspace on failure", async () => {
    const body = JSON.stringify({
      type: "payment.failed",
      timestamp: NOW.toISOString(),
      data: {
        payment_id: "pay_1",
        status: "failed",
        total_amount: 4500,
        currency: "USD",
        subscription_id: "sub_123",
        metadata: { workspace_id: WORKSPACE_ID },
      },
    });

    const result = await processDodoWebhook({ body, headers: signedRequest(body, "evt_pay"), now: NOW });

    expect(result.status).toBe("processed");
    expect(callsFor(adminState.current!, "billing_payments", "upsert")).toHaveLength(1);
    expect(callsFor(adminState.current!, "notifications", "insert")).toHaveLength(1);
  });
});

/** Guard: the executor seam must be the embedded database for these tests. */
it("uses the injected SQL executor", () => {
  expect(getSqlExecutor()).toBeTruthy();
});
