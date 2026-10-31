import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, seedUser, seedWorkspace, type TestDb } from "./harness";

/**
 * Multi-tenant isolation is the security requirement the whole product rests
 * on. Every test here runs as a real Postgres role with a real JWT claim, so
 * the assertions exercise the shipped policies rather than a mock of them.
 */
let db: TestDb;

const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
const carol = "33333333-3333-4333-8333-333333333333";

let workspaceA: string;
let workspaceB: string;

beforeAll(async () => {
  db = await createTestDb();

  await seedUser(db, { id: alice, email: "alice@example.com", name: "Alice" });
  await seedUser(db, { id: bob, email: "bob@example.com", name: "Bob" });
  await seedUser(db, { id: carol, email: "carol@example.com", name: "Carol" });

  workspaceA = await seedWorkspace(db, { ownerId: alice, name: "Alice Co", slug: "alice-co" });
  workspaceB = await seedWorkspace(db, { ownerId: bob, name: "Bob Co", slug: "bob-co", plan: "pro" });

  // Carol is a viewer in workspace A (read-only).
  await db.admin.query(
    `insert into public.workspace_members (workspace_id, user_id, email, role, status)
     values ($1::uuid, $2::uuid, 'carol@example.com', 'viewer', 'active')
     on conflict do nothing`,
    [workspaceA, carol],
  );

  // One LinkedIn connection per workspace.
  for (const [workspace, owner] of [
    [workspaceA, alice],
    [workspaceB, bob],
  ] as const) {
    const { rows } = await db.admin.query<{ id: string }>(
      `insert into public.linkedin_accounts
         (workspace_id, profile_urn, display_name, granted_scopes, can_publish, connected_by)
       values ($1::uuid, $2, $3, '{openid,profile,w_member_social}', true, $4::uuid)
       returning id`,
      [workspace, `urn:li:person:${workspace.slice(0, 8)}`, `User ${owner.slice(0, 4)}`, owner],
    );

    await db.admin.query(
      `insert into public.linkedin_account_secrets
         (account_id, access_token_ciphertext, access_token_key_id)
       values ($1::uuid, 'v1.ciphertext', 'key-1')`,
      [rows[0].id],
    );
  }

  // A post in each workspace.
  await db.admin.query(
    `insert into public.posts (workspace_id, author_account_id, created_by, body, status)
     select $1::uuid, la.id, $2::uuid, 'A private post', 'draft'
     from public.linkedin_accounts la where la.workspace_id = $1::uuid`,
    [workspaceA, alice],
  );
  await db.admin.query(
    `insert into public.posts (workspace_id, author_account_id, created_by, body, status)
     select $1::uuid, la.id, $2::uuid, 'B private post', 'draft'
     from public.linkedin_accounts la where la.workspace_id = $1::uuid`,
    [workspaceB, bob],
  );
});

afterAll(async () => {
  await db.close();
});

async function countAs(userId: string | null, sql: string, params: unknown[] = []) {
  const executor = userId === null ? await db.asAnon() : await db.asUser(userId);
  const { rows } = await executor.query<{ count: string }>(
    `select count(*)::text as count from (${sql}) as counted`,
    params,
  );
  return Number(rows[0].count);
}

describe("workspace isolation", () => {
  it("hides another workspace's posts", async () => {
    expect(await countAs(alice, `select id from public.posts`)).toBe(1);
    expect(await countAs(bob, `select id from public.posts`)).toBe(1);

    const { rows } = await (await db.asUser(alice)).query<{ body: string }>(
      `select body from public.posts`,
    );
    expect(rows[0].body).toBe("A private post");
  });

  it("hides another workspace's LinkedIn connections", async () => {
    const { rows } = await (await db.asUser(alice)).query<{ profile_urn: string }>(
      `select profile_urn from public.linkedin_accounts`,
    );
    expect(rows.length).toBe(1);
    expect(rows[0].profile_urn.startsWith("urn:li:person:")).toBe(true);
  });

  it("never exposes OAuth tokens to an authenticated client, even its own", async () => {
    const asAlice = await db.asUser(alice);
    const { rows } = await asAlice.query(`select * from public.linkedin_account_secrets`);
    expect(rows.length).toBe(0);

    await expect(
      asAlice.query(`select access_token_ciphertext from public.linkedin_account_secrets`),
    ).resolves.toBeTruthy();

    // The service role (server-only) can read them — that is the only path.
    const { rows: adminRows } = await db.admin.query(`select * from public.linkedin_account_secrets`);
    expect(adminRows.length).toBe(2);
  });

  it("never exposes OAuth state or webhook payloads to clients", async () => {
    await db.admin.query(
      `insert into public.linkedin_oauth_states (state_hash, user_id, workspace_id)
       values ('hash', $1::uuid, $2::uuid)`,
      [alice, workspaceA],
    );
    await db.admin.query(
      `insert into public.webhook_events (event_id, event_type, payload)
       values ('evt_1', 'subscription.active', '{}'::jsonb)`,
    );

    expect(await countAs(alice, `select event_id from public.webhook_events`)).toBe(0);
    expect(await countAs(alice, `select id from public.linkedin_oauth_states`)).toBe(0);
  });

  it("hides another workspace's subscription and billing rows", async () => {
    const { rows } = await (await db.asUser(alice)).query<{ workspace_id: string; plan: string }>(
      `select workspace_id, plan from public.subscriptions`,
    );
    expect(rows.length).toBe(1);
    expect(rows[0].workspace_id).toBe(workspaceA);
    expect(rows[0].plan).toBe("free");
  });

  it("does not let a client promote itself to Pro", async () => {
    const asAlice = await db.asUser(alice);

    await expect(
      asAlice.query(
        `update public.subscriptions set plan = 'pro', status = 'active' where workspace_id = $1::uuid`,
        [workspaceA],
      ),
    ).resolves.toBeDefined();

    const { rows } = await db.admin.query<{ plan: string }>(
      `select plan from public.subscriptions where workspace_id = $1::uuid`,
      [workspaceA],
    );
    expect(rows[0].plan).toBe("free");
  });

  it("does not let a client insert a subscription row", async () => {
    const asAlice = await db.asUser(alice);
    await expect(
      asAlice.query(
        `insert into public.subscriptions (workspace_id, plan, status) values ($1::uuid, 'pro', 'active')`,
        [workspaceA],
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("enforces read-only membership for viewers", async () => {
    const asCarol = await db.asUser(carol);

    const { rows: readable } = await asCarol.query(`select id from public.posts`);
    expect(readable.length).toBe(1);

    await expect(
      asCarol.query(
        `insert into public.posts (workspace_id, author_account_id, created_by, body)
         select $1::uuid, la.id, $2::uuid, 'nope'
         from public.linkedin_accounts la where la.workspace_id = $1::uuid`,
        [workspaceA, carol],
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("lets an editor write inside their own workspace only", async () => {
    const asAlice = await db.asUser(alice);

    await expect(
      asAlice.query(
        `insert into public.posts (workspace_id, author_account_id, created_by, body)
         select $1::uuid, la.id, $2::uuid, 'cross-tenant attempt'
         from public.linkedin_accounts la where la.workspace_id = $3::uuid`,
        [workspaceB, alice, workspaceA],
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("hides other workspaces' media assets", async () => {
    await db.admin.query(
      `insert into public.media_assets (workspace_id, kind, file_name, mime_type, byte_size, storage_path)
       values ($1::uuid, 'image', 'a.png', 'image/png', 100, $2)`,
      [workspaceA, `${workspaceA}/post/a.png`],
    );

    const { rows } = await (await db.asUser(bob)).query(`select id from public.media_assets`);
    expect(rows.length).toBe(0);
  });

  it("shows anonymous callers nothing", async () => {
    expect(await countAs(null, `select id from public.posts`)).toBe(0);
    expect(await countAs(null, `select id from public.workspaces`)).toBe(0);
    expect(await countAs(null, `select id from public.linkedin_accounts`)).toBe(0);
  });

  it("keeps private media private in storage", async () => {
    await db.admin.query(
      `insert into storage.objects (bucket_id, name, owner) values ('post-media', $1, $2::uuid)`,
      [`${workspaceA}/post/asset.png`, alice],
    );

    const asAlice = await db.asUser(alice);
    const { rows: visible } = await asAlice.query(`select id from storage.objects`);
    expect(visible.length).toBe(1);

    const asBob = await db.asUser(bob);
    const { rows: hidden } = await asBob.query(`select id from storage.objects`);
    expect(hidden.length).toBe(0);
  });
});

describe("plan-gated analytics history", () => {
  it("limits Free workspaces to 7 days of analytics", async () => {
    await db.admin.query(
      `insert into public.post_analytics (workspace_id, post_id, captured_on, impressions)
       select $1::uuid, p.id, (current_date - interval '30 days')::date, 100
       from public.posts p where p.workspace_id = $1::uuid limit 1`,
      [workspaceA],
    );
    await db.admin.query(
      `insert into public.post_analytics (workspace_id, post_id, captured_on, impressions)
       select $1::uuid, p.id, current_date, 50
       from public.posts p where p.workspace_id = $1::uuid limit 1`,
      [workspaceA],
    );

    expect(await countAs(alice, `select id from public.post_analytics`)).toBe(1);
  });

  it("allows Pro workspaces 365 days", async () => {
    await db.admin.query(
      `insert into public.post_analytics (workspace_id, post_id, captured_on, impressions)
       select $1::uuid, p.id, (current_date - interval '300 days')::date, 900
       from public.posts p where p.workspace_id = $1::uuid limit 1`,
      [workspaceB],
    );

    expect(await countAs(bob, `select id from public.post_analytics`)).toBe(1);
  });

  it("makes best-time recommendations a Pro-only read", async () => {
    await db.admin.query(
      `insert into public.best_time_recommendations
         (workspace_id, linkedin_account_id, weekday, hour, score, sample_size, confidence)
       select w.id, la.id, 1, 9, 0.8, 20, 0.9
       from public.workspaces w
       join public.linkedin_accounts la on la.workspace_id = w.id
       where w.id = any($1::uuid[])`,
      [[workspaceA, workspaceB]],
    );

    expect(await countAs(alice, `select id from public.best_time_recommendations`)).toBe(0);
    expect(await countAs(bob, `select id from public.best_time_recommendations`)).toBe(1);
  });
});
