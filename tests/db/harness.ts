import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

export type SqlExecutor = {
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; affectedRows?: number }>;
  exec(sql: string): Promise<void>;
};

export type TestDb = {
  pg: PGlite;
  /** Run SQL as the Supabase service role (bypasses RLS). */
  admin: SqlExecutor;
  /** Run SQL exactly as a signed-in user would (RLS enforced). */
  asUser: (userId: string) => Promise<SqlExecutor>;
  /** Run SQL as an anonymous request (RLS enforced, no JWT). */
  asAnon: () => Promise<SqlExecutor>;
  close: () => Promise<void>;
};

/**
 * Objects Supabase provides on a hosted project that PGlite does not have:
 * `auth.users` + `auth.uid()` (JWT-derived identity) and `storage.objects`.
 * The shim reproduces the semantics the policies depend on — nothing more.
 */
const SUPABASE_SHIM = `
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key,
  email text,
  created_at timestamptz not null default now()
);

create or replace function auth.uid() returns uuid
language sql stable
as $$
  select nullif(
    coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub'
    ),
    ''
  )::uuid;
$$;

create or replace function auth.role() returns text
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role',
    'authenticated'
  );
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;
-- Supabase does not expose auth.users to client roles; only the service role reads it.
grant all on auth.users to service_role;

create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text not null,
  owner uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

alter table storage.objects enable row level security;

grant usage on schema storage to anon, authenticated, service_role;
grant all on storage.objects to authenticated, service_role;
grant all on storage.buckets to service_role;
`;

async function migrationFiles(): Promise<string[]> {
  const files = await readdir(MIGRATIONS_DIR);
  return files.filter((file) => file.endsWith(".sql")).sort();
}

function toExecutor(pg: PGlite, prefix: string[]): SqlExecutor {
  return {
    async query<T = Record<string, unknown>>(text: string, params: unknown[] = []) {
      for (const statement of prefix) {
        await pg.exec(statement);
      }
      const result = await pg.query<T>(text, params);
      return { rows: result.rows, affectedRows: result.affectedRows };
    },
    async exec(sql: string) {
      for (const statement of prefix) {
        await pg.exec(statement);
      }
      await pg.exec(sql);
    },
  };
}

export async function createTestDb(): Promise<TestDb> {
  const pg = new PGlite();

  await pg.exec(SUPABASE_SHIM);

  for (const file of await migrationFiles()) {
    const sql = await readFile(join(MIGRATIONS_DIR, file), "utf8");
    await pg.exec(sql);
  }

  // Supabase grants table access through default privileges; reproduce the
  // same grants so policy tests exercise the real permission surface.
  await pg.exec(`
    do $$
    declare
      tbl record;
    begin
      for tbl in select tablename from pg_tables where schemaname = 'public' loop
        execute format('grant select, insert, update, delete on public.%I to authenticated', tbl.tablename);
        execute format('grant all on public.%I to anon', tbl.tablename);
        execute format('grant all on public.%I to service_role', tbl.tablename);
      end loop;
    end
    $$;
  `);

  const admin = toExecutor(pg, ["set role service_role;"]);

  return {
    pg,
    admin,
    async asUser(userId: string) {
      return toExecutor(pg, [
        `set role authenticated;`,
        `select set_config('request.jwt.claims', '{"sub":"${userId}","role":"authenticated"}', false);`,
      ]);
    },
    async asAnon() {
      return toExecutor(pg, [
        `set role anon;`,
        `select set_config('request.jwt.claims', '{}', false);`,
      ]);
    },
    async close() {
      await pg.close();
    },
  };
}

/** Insert an auth user + profile pair. */
export async function seedUser(
  db: TestDb,
  input: { id: string; email: string; name?: string; timezone?: string },
): Promise<void> {
  await db.admin.query(
    `insert into auth.users (id, email) values ($1, $2)
     on conflict (id) do update set email = excluded.email`,
    [input.id, input.email],
  );
  await db.admin.query(
    `insert into public.profiles (id, email, full_name, timezone)
     values ($1, $2, $3, $4)
     on conflict (id) do update set email = excluded.email`,
    [input.id, input.email, input.name ?? input.email.split("@")[0], input.timezone ?? "UTC"],
  );
}

/** Create a workspace with a single owner member, as that user. */
export async function seedWorkspace(
  db: TestDb,
  input: { id?: string; ownerId: string; name: string; slug?: string; plan?: "free" | "pro" },
): Promise<string> {
  const rows = await db.admin.query<{ id: string }>(
    `insert into public.workspaces (id, name, slug, owner_id, plan)
     values (coalesce($1::uuid, gen_random_uuid()), $2, $3, $4::uuid, $5)
     returning id`,
    [input.id ?? null, input.name, input.slug ?? input.name.toLowerCase().replace(/\s+/g, "-"), input.ownerId, input.plan ?? "free"],
  );

  const workspaceId = rows.rows[0].id;

  await db.admin.query(
    `insert into public.workspace_members (workspace_id, user_id, email, role, status, joined_at)
     select $1::uuid, $2::uuid, p.email, 'owner', 'active', now()
     from public.profiles p where p.id = $2::uuid
     on conflict do nothing`,
    [workspaceId, input.ownerId],
  );

  await db.admin.query(
    `insert into public.subscriptions (workspace_id, plan, status, seats)
     values ($1::uuid, $2, case when $2 = 'pro' then 'active' else 'free' end, 1)
     on conflict (workspace_id) do update set plan = excluded.plan, status = excluded.status`,
    [workspaceId, input.plan ?? "free"],
  );

  return workspaceId;
}
