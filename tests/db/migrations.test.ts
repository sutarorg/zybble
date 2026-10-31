import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createTestDb, type TestDb } from "./harness";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db.close();
});

describe("migrations", () => {
  it("applies every migration file in order", async () => {
    const files = (await readdir(join(process.cwd(), "supabase", "migrations")))
      .filter((file) => file.endsWith(".sql"))
      .sort();

    expect(files.length).toBeGreaterThanOrEqual(10);

    for (const file of files) {
      const sql = await readFile(join(process.cwd(), "supabase", "migrations", file), "utf8");
      expect(sql.trim().length, `${file} must not be empty`).toBeGreaterThan(0);
    }
  });

  it("creates every required entity", async () => {
    const { rows } = await db.admin.query<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
    );

    const tables = rows.map((row) => row.table_name);

    for (const required of [
      "profiles",
      "workspaces",
      "workspace_members",
      "linkedin_accounts",
      "linkedin_account_secrets",
      "linkedin_oauth_states",
      "posts",
      "media_assets",
      "post_analytics",
      "analytics_snapshots",
      "best_time_recommendations",
      "subscriptions",
      "billing_payments",
      "webhook_events",
      "notifications",
      "notification_preferences",
      "audit_logs",
      "rate_limit_counters",
      "usage_counters",
      "post_publish_attempts",
    ]) {
      expect(tables, `missing table ${required}`).toContain(required);
    }
  });

  it("enables row level security on every user-facing table", async () => {
    const { rows } = await db.admin.query<{ table_name: string; rowsecurity: boolean }>(
      `select c.relname as table_name, c.relrowsecurity as rowsecurity
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r'`,
    );

    for (const row of rows) {
      expect(row.rowsecurity, `${row.table_name} must have RLS enabled`).toBe(true);
    }
  });

  it("grants no policy on credential tables", async () => {
    const { rows } = await db.admin.query<{ tablename: string; policyname: string }>(
      `select tablename, policyname from pg_policies where schemaname = 'public'`,
    );

    const policyTables = new Set(rows.map((row) => row.tablename));

    expect(policyTables.has("linkedin_account_secrets")).toBe(false);
    expect(policyTables.has("linkedin_oauth_states")).toBe(false);
    expect(policyTables.has("webhook_events")).toBe(false);
    expect(policyTables.has("rate_limit_counters")).toBe(false);
  });

  it("creates the private post-media bucket and its policies", async () => {
    const { rows: buckets } = await db.admin.query<{ id: string; public: boolean }>(
      `select id, public from storage.buckets where id = 'post-media'`,
    );

    expect(buckets[0]).toBeDefined();
    expect(buckets[0].public).toBe(false);

    const { rows: policies } = await db.admin.query<{ policyname: string }>(
      `select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects'`,
    );

    expect(policies.map((row) => row.policyname).sort()).toEqual([
      "post_media_delete",
      "post_media_insert",
      "post_media_select",
      "post_media_update",
    ]);
  });

  it("defines the helper functions used by policies", async () => {
    const { rows } = await db.admin.query<{ proname: string }>(
      `select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and proname in (
           'workspace_ids_for_user', 'can_read_workspace', 'can_write_workspace',
           'can_manage_workspace', 'workspace_plan', 'bump_rate_limit',
           'create_workspace', 'accept_workspace_invitation', 'purge_workspace_data',
           'current_usage', 'usage_period'
         )`,
    );

    expect(rows.length).toBe(11);
  });
});
