import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, seedUser, seedWorkspace, type TestDb } from "../db/harness";

/**
 * Publish-run claim semantics.
 *
 * "A failed retry must never double-post" is enforced by the database, not by
 * application optimism, so it is tested against the real migrations:
 *
 *  - `post_publish_attempts (post_id, attempt)` is unique → a concurrently
 *    started second run loses with 23505;
 *  - the status transition to `publishing` is a compare-and-swap guarded on
 *    `linkedin_post_urn IS NULL`, so a post that already has a URN can never be
 *    picked up again, by any attempt number.
 *
 * Also covered: the Free-plan scheduling quota trigger and its refund, plus the
 * usage counter that both the guard and the billing screen read.
 */

let db: TestDb;

const OWNER = "33333333-3333-4333-8333-333333333333";
let workspaceId: string;
let accountId: string;

async function insertPost(status = "scheduled", scheduledAt = new Date(Date.now() - 60_000).toISOString()) {
  const rows = await db.admin.query<{ id: string }>(
    `insert into public.posts (workspace_id, author_account_id, created_by, body, status, scheduled_at, timezone, usage_period)
     values ($1::uuid, $2::uuid, $3::uuid, 'hello world', $4, $5::timestamptz, 'UTC', public.usage_period($5::timestamptz))
     returning id`,
    [workspaceId, accountId, OWNER, status, scheduledAt],
  );
  return rows.rows[0]!.id;
}

/** What src/features/posts/publish.ts does, expressed as SQL. */
async function claimAttempt(postId: string, attempt: number) {
  return db.admin.query(
    `insert into public.post_publish_attempts (post_id, attempt, outcome, started_at)
     values ($1::uuid, $2, 'started', now())`,
    [postId, attempt],
  );
}

async function claimPublishing(postId: string) {
  const rows = await db.admin.query<{ id: string }>(
    `update public.posts
        set status = 'publishing', attempts = attempts + 1
      where id = $1::uuid
        and linkedin_post_urn is null
        and status in ('scheduled', 'failed')
      returning id`,
    [postId],
  );
  return rows.rows.length === 1;
}

beforeAll(async () => {
  db = await createTestDb();
  await seedUser(db, { id: OWNER, email: "owner@example.com" });
  workspaceId = await seedWorkspace(db, { ownerId: OWNER, name: "Claim Workspace" });

  const account = await db.admin.query<{ id: string }>(
    `insert into public.linkedin_accounts (workspace_id, kind, profile_urn, display_name, granted_scopes, can_publish, can_read_analytics, status, connected_by, token_expires_at)
     values ($1::uuid, 'member', 'urn:li:person:abc', 'Owner', array['w_member_social'], true, false, 'active', $2::uuid, now() + interval '30 days')
     returning id`,
    [workspaceId, OWNER],
  );
  accountId = account.rows[0]!.id;
});

afterAll(async () => {
  await db.close();
});

describe("publish attempt ledger", () => {
  it("rejects two concurrent runs claiming the same attempt number", async () => {
    const postId = await insertPost();

    await claimAttempt(postId, 1);

    await expect(claimAttempt(postId, 1)).rejects.toThrow(/duplicate key|23505|unique/i);
  });

  it("allows a later attempt after a failure", async () => {
    const postId = await insertPost("failed");

    await claimAttempt(postId, 1);
    await claimAttempt(postId, 2);

    const rows = await db.admin.query<{ attempt: number }>(
      `select attempt from public.post_publish_attempts where post_id = $1::uuid order by attempt`,
      [postId],
    );

    expect(rows.rows.map((row) => row.attempt)).toEqual([1, 2]);
  });

  it("never re-claims a post that already has a LinkedIn URN", async () => {
    const postId = await insertPost("scheduled");

    await db.admin.query(
      `update public.posts
          set status = 'published', linkedin_post_urn = 'urn:li:share:123', published_at = now()
        where id = $1::uuid`,
      [postId],
    );

    expect(await claimPublishing(postId)).toBe(false);

    const rows = await db.admin.query<{ status: string }>(
      `select status from public.posts where id = $1::uuid`,
      [postId],
    );
    expect(rows.rows[0]!.status).toBe("published");
  });

  it("claims a scheduled post exactly once under concurrent CAS updates", async () => {
    const postId = await insertPost("scheduled");

    const outcomes = await Promise.all([
      claimPublishing(postId),
      claimPublishing(postId),
      claimPublishing(postId),
    ]);

    // Exactly one caller wins; the others see zero rows updated.
    expect(outcomes.filter(Boolean)).toHaveLength(1);
  });

  it("does not claim a draft or a cancelled post", async () => {
    const draft = await insertPost("draft");
    const cancelled = await insertPost("cancelled");

    expect(await claimPublishing(draft)).toBe(false);
    expect(await claimPublishing(cancelled)).toBe(false);
  });
});

describe("Free-plan scheduling quota", () => {
  it("blocks the 11th scheduled post in a month on the Free plan", async () => {
    const fresh = await seedWorkspace(db, { ownerId: OWNER, name: "Quota Workspace" });

    for (let index = 0; index < 10; index += 1) {
      await db.admin.query(
        `insert into public.posts (workspace_id, author_account_id, created_by, body, status, scheduled_at, usage_period)
         values ($1::uuid, $2::uuid, $3::uuid, 'scheduled post', 'scheduled', now(), public.usage_period(now()))`,
        [fresh, accountId, OWNER],
      );
    }

    await expect(
      db.admin.query(
        `insert into public.posts (workspace_id, author_account_id, created_by, body, status, scheduled_at, usage_period)
         values ($1::uuid, $2::uuid, $3::uuid, 'one too many', 'scheduled', now(), public.usage_period(now()))`,
        [fresh, accountId, OWNER],
      ),
    ).rejects.toThrow(/schedule_limit_reached/);
  });

  it("counts usage in usage_counters and refunds a slot when a post is cancelled", async () => {
    const fresh = await seedWorkspace(db, { ownerId: OWNER, name: "Refund Workspace" });

    const created = await db.admin.query<{ id: string }>(
      `insert into public.posts (workspace_id, author_account_id, created_by, body, status, scheduled_at, usage_period)
       values ($1::uuid, $2::uuid, $3::uuid, 'refund me', 'scheduled', now(), public.usage_period(now()))
       returning id`,
      [fresh, accountId, OWNER],
    );

    const read = async () => {
      const rows = await db.admin.query<{ count: number }>(
        `select count from public.usage_counters
          where workspace_id = $1::uuid and metric = 'scheduled_posts'`,
        [fresh],
      );
      return rows.rows[0]?.count ?? 0;
    };

    expect(await read()).toBe(1);

    await db.admin.query(`update public.posts set status = 'draft' where id = $1::uuid`, [
      created.rows[0]!.id,
    ]);

    expect(await read()).toBe(0);
  });

  it("does not consume a second slot when a post is rescheduled inside the same month", async () => {
    const fresh = await seedWorkspace(db, { ownerId: OWNER, name: "Reschedule Workspace" });

    const created = await db.admin.query<{ id: string }>(
      `insert into public.posts (workspace_id, author_account_id, created_by, body, status, scheduled_at, usage_period)
       values ($1::uuid, $2::uuid, $3::uuid, 'move me', 'scheduled', now(), public.usage_period(now()))
       returning id`,
      [fresh, accountId, OWNER],
    );

    await db.admin.query(
      `update public.posts set scheduled_at = now() + interval '3 days' where id = $1::uuid`,
      [created.rows[0]!.id],
    );

    const rows = await db.admin.query<{ count: number }>(
      `select count from public.usage_counters where workspace_id = $1::uuid and metric = 'scheduled_posts'`,
      [fresh],
    );

    expect(rows.rows[0]?.count).toBe(1);
  });
});

describe("plan entitlements in SQL", () => {
  it("reports pro for an active subscription and free once the period lapses", async () => {
    const active = await seedWorkspace(db, { ownerId: OWNER, name: "Pro Workspace", plan: "pro" });

    const rows = await db.admin.query<{ plan: string }>(
      `select public.workspace_plan($1::uuid) as plan`,
      [active],
    );
    expect(rows.rows[0]!.plan).toBe("pro");

    await db.admin.query(
      `update public.subscriptions
          set current_period_end = now() - interval '1 day'
        where workspace_id = $1::uuid`,
      [active],
    );

    const lapsed = await db.admin.query<{ plan: string }>(
      `select public.workspace_plan($1::uuid) as plan`,
      [active],
    );
    expect(lapsed.rows[0]!.plan).toBe("free");
  });

  it("limits Free workspaces to one connected account", async () => {
    const single = await seedWorkspace(db, { ownerId: OWNER, name: "One Account" });

    await db.admin.query(
      `insert into public.linkedin_accounts (workspace_id, kind, profile_urn, display_name, granted_scopes, status)
       values ($1::uuid, 'member', 'urn:li:person:one', 'One', array['w_member_social'], 'active')`,
      [single],
    );

    await expect(
      db.admin.query(
        `insert into public.linkedin_accounts (workspace_id, kind, profile_urn, display_name, granted_scopes, status)
         values ($1::uuid, 'member', 'urn:li:person:two', 'Two', array['w_member_social'], 'active')`,
        [single],
      ),
    ).rejects.toThrow(/linkedin_account_limit_reached/);
  });
});
