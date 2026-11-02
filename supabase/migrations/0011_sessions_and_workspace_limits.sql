-- Zybble — 0011_sessions_and_workspace_limits
-- Signed-in device list for the account screen, and the per-plan workspace cap.

-- ---------------------------------------------------------------------------
-- auth_sessions: one row per device an account has signed in from.
--
-- Supabase Auth does not expose a per-device session list through the JS
-- client, so the app records what it can see at sign-in and shows it back on
-- the account screen.
--
-- Deliberately minimal and privacy-preserving:
--   * the raw IP is never stored — only a SHA-256 of it, used solely to
--     recognise a returning device instead of creating a duplicate row;
--   * location is whatever the platform's geo headers supply, which is
--     city/country at best and absent entirely on most local setups;
--   * a row can be deleted by its owner, and cascades away with the account.
-- ---------------------------------------------------------------------------
create table if not exists public.auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Human-readable device name, e.g. "Chrome on macOS" or "Safari on iPhone".
  device_label text not null,
  -- These are '' when unknown rather than NULL. A NULL cannot be compared for
  -- equality, so nullable columns would force the identity index below to be
  -- an expression index — which `on conflict` cannot target, turning every
  -- refresh into a duplicate row. "" means "not known", and never a guess.
  ip_hash text not null default '',
  city text not null default '',
  region text not null default '',
  country text not null default '',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint auth_sessions_device_label_length
    check (char_length(device_label) between 1 and 80)
);

create index if not exists auth_sessions_user_idx
  on public.auth_sessions (user_id, last_seen_at desc);

-- A returning device refreshes its row rather than accumulating a new one.
create unique index if not exists auth_sessions_identity_key
  on public.auth_sessions (user_id, device_label, ip_hash, city, country);

comment on table public.auth_sessions is
  'Devices an account has signed in from. Stores no raw IP addresses.';

-- ---------------------------------------------------------------------------
-- Workspace cap: 1 on Free, 3 on Pro.
--
-- The allowance follows the best plan the account holds anywhere, so upgrading
-- one workspace to Pro raises the cap for the whole account rather than only
-- for that one workspace. Enforced inside create_workspace() (SECURITY
-- DEFINER) so no API route can walk around it.
-- ---------------------------------------------------------------------------
create or replace function public.workspace_allowance(target_user uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1
      from public.workspaces w
      join public.subscriptions s on s.workspace_id = w.id
      where w.owner_id = target_user
        and w.deleted_at is null
        and s.plan = 'pro'
        -- Mirrors isPro() in src/features/billing/entitlements.ts: dunning a
        -- paying customer must not destroy workspaces they have already made.
        and s.status in ('active', 'past_due', 'trialing')
        and (s.current_period_end is null or s.current_period_end > now())
    )
    then 3
    else 1
  end;
$$;

comment on function public.workspace_allowance(uuid) is
  'Workspaces a user may own: 3 with an active Pro subscription, otherwise 1.';

-- Re-declared in full (rather than patched) because Postgres has no ALTER
-- FUNCTION body. Everything below is 0010's body plus the allowance check.
create or replace function public.create_workspace(
  workspace_name text,
  workspace_timezone text default 'UTC'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace_id uuid;
  slug_base text;
  slug_candidate text;
  slug_suffix integer := 0;
  owned_count integer;
  allowance integer;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  allowance := public.workspace_allowance(auth.uid());

  select count(*) into owned_count
  from public.workspaces w
  where w.owner_id = auth.uid()
    and w.deleted_at is null;

  if owned_count >= allowance then
    raise exception 'workspace_limit_reached'
      using errcode = 'P0001',
            detail = format('this account allows %s workspace(s)', allowance);
  end if;

  slug_base := nullif(public.slugify(workspace_name), '');
  slug_base := coalesce(slug_base, 'workspace');
  slug_candidate := slug_base;

  while exists (select 1 from public.workspaces w where w.slug = slug_candidate) loop
    slug_suffix := slug_suffix + 1;
    slug_candidate := slug_base || '-' || slug_suffix::text;
  end loop;

  insert into public.workspaces (name, slug, owner_id, plan, seats, timezone)
  values (
    btrim(workspace_name),
    slug_candidate,
    auth.uid(),
    'free',
    1,
    coalesce(workspace_timezone, 'UTC')
  )
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, email, role, status, joined_at)
  values (
    new_workspace_id,
    auth.uid(),
    coalesce((select p.email from public.profiles p where p.id = auth.uid()), ''),
    'owner',
    'active',
    now()
  );

  insert into public.subscriptions (workspace_id, plan, status, seats)
  values (new_workspace_id, 'free', 'free', 1);

  insert into public.usage_counters (workspace_id, period, metric, count)
  values (new_workspace_id, public.usage_period(now()), 'scheduled_posts', 0)
  on conflict do nothing;

  return new_workspace_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS for auth_sessions
-- ---------------------------------------------------------------------------
alter table public.auth_sessions enable row level security;

drop policy if exists auth_sessions_select_self on public.auth_sessions;
create policy auth_sessions_select_self on public.auth_sessions
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Insert is allowed so a server route acting as the user can record the
-- sign-in; the check pins the row to the caller so it cannot be forged for
-- someone else.
drop policy if exists auth_sessions_insert_self on public.auth_sessions;
create policy auth_sessions_insert_self on public.auth_sessions
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- Owners may revoke a device from their own list.
drop policy if exists auth_sessions_delete_self on public.auth_sessions;
create policy auth_sessions_delete_self on public.auth_sessions
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- No UPDATE policy: the upsert that refreshes last_seen_at runs through the
-- service-role client, which bypasses RLS by design.
