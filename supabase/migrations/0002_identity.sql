-- Zybble — 0002_identity
-- Profiles, workspaces, membership and the Free-plan usage counter.

-- ---------------------------------------------------------------------------
-- profiles: public side of an auth.users row
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  -- IANA timezone used to render the calendar and to resolve best-time slots.
  timezone text not null default 'UTC',
  onboarding_completed_at timestamptz,
  marketing_opt_in boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_email_shape check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint profiles_timezone_shape check (timezone ~ '^[A-Za-z0-9_+\-/]{1,64}$')
);

comment on table public.profiles is
  'Application profile for a Supabase Auth user. Never stores credentials.';

-- ---------------------------------------------------------------------------
-- workspaces: the tenant boundary. Everything else hangs off this.
-- ---------------------------------------------------------------------------
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_id uuid not null references auth.users (id) on delete restrict,
  -- Last known plan. Reconciled from public.subscriptions by Dodo webhooks.
  plan text not null default 'free',
  -- Billable seats (Pro only). Seats = active members; see docs/BILLING.
  seats integer not null default 1,
  timezone text not null default 'UTC',
  billing_email text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspaces_plan_valid check (plan in ('free', 'pro')),
  constraint workspaces_name_length check (char_length(name) between 1 and 80),
  constraint workspaces_slug_shape check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$'),
  constraint workspaces_seats_positive check (seats > 0)
);

create index if not exists workspaces_owner_idx on public.workspaces (owner_id);

-- ---------------------------------------------------------------------------
-- workspace_members: membership + pending invitations in one table.
-- Pending invites are `status = 'invited'` and carry only the *hash* of the
-- invite token, never the token itself.
-- ---------------------------------------------------------------------------
create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'editor',
  status text not null default 'active',
  invited_by uuid references auth.users (id) on delete set null,
  invite_token_hash text,
  invite_expires_at timestamptz,
  invited_at timestamptz,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_members_role_valid check (role in ('owner', 'admin', 'editor', 'viewer')),
  constraint workspace_members_status_valid check (status in ('active', 'invited', 'removed')),
  constraint workspace_members_active_has_user check (status <> 'active' or user_id is not null),
  constraint workspace_members_invite_has_hash check (status <> 'invited' or invite_token_hash is not null)
);

create unique index if not exists workspace_members_workspace_user_key
  on public.workspace_members (workspace_id, user_id)
  where user_id is not null;

create unique index if not exists workspace_members_workspace_email_key
  on public.workspace_members (workspace_id, lower(email));

create index if not exists workspace_members_workspace_idx
  on public.workspace_members (workspace_id, status);

create index if not exists workspace_members_user_idx
  on public.workspace_members (user_id)
  where user_id is not null;

-- Exactly one owner per workspace.
create unique index if not exists workspace_members_single_owner
  on public.workspace_members (workspace_id)
  where role = 'owner' and status = 'active';

-- ---------------------------------------------------------------------------
-- usage_counters: deterministic Free-plan quota accounting.
-- Maintained by trigger (0010_triggers.sql) so the limit cannot be bypassed by
-- a direct API call and so the dashboard can read usage in one query.
-- ---------------------------------------------------------------------------
create table if not exists public.usage_counters (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  period text not null,
  metric text not null,
  count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, period, metric),
  constraint usage_counters_metric_valid check (metric in ('scheduled_posts')),
  constraint usage_counters_count_non_negative check (count >= 0),
  constraint usage_counters_period_shape check (period ~ '^\d{4}-(0[1-9]|1[0-2])$')
);

create or replace function public.current_usage(workspace uuid, counter_metric text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select uc.count
     from public.usage_counters uc
     where uc.workspace_id = workspace
       and uc.period = public.usage_period(now())
       and uc.metric = counter_metric),
    0
  );
$$;

-- ---------------------------------------------------------------------------
-- Auth helpers
-- ---------------------------------------------------------------------------
-- `auth.uid()` is provided by Supabase Auth and reads `request.jwt.claims`.
-- It is never redefined here; migrations only ever consume it.

-- Roles a member can hold inside a workspace.
create or replace function public.workspace_role(workspace uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select wm.role
  from public.workspace_members wm
  where wm.workspace_id = workspace
    and wm.user_id = auth.uid()
    and wm.status = 'active'
  limit 1;
$$;

create or replace function public.workspace_ids_for_user()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select wm.workspace_id
  from public.workspace_members wm
  where wm.user_id = auth.uid()
    and wm.status = 'active';
$$;

-- Read/write capability split: owners and admins manage billing, members and
-- LinkedIn connections; editors additionally create content; viewers only read.
create or replace function public.can_read_workspace(workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  );
$$;

create or replace function public.can_write_workspace(workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace
      and wm.user_id = auth.uid()
      and wm.status = 'active'
      and wm.role in ('owner', 'admin', 'editor')
  );
$$;

create or replace function public.can_manage_workspace(workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace
      and wm.user_id = auth.uid()
      and wm.status = 'active'
      and wm.role in ('owner', 'admin')
  );
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger workspaces_set_updated_at
  before update on public.workspaces
  for each row execute function public.set_updated_at();

create trigger workspace_members_set_updated_at
  before update on public.workspace_members
  for each row execute function public.set_updated_at();

create trigger usage_counters_set_updated_at
  before update on public.usage_counters
  for each row execute function public.set_updated_at();
