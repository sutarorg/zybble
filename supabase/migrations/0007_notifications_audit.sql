-- Zybble — 0007_notifications_audit
-- In-app notifications, per-user email preferences, audit trail and the
-- database-backed rate-limit table referenced by 0001_foundation.

-- ---------------------------------------------------------------------------
-- notifications: the feed behind the topbar bell.
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- NULL for workspace-wide notices delivered to every member.
  user_id uuid references auth.users (id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  action_url text,
  severity text not null default 'info',
  metadata jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_kind_valid check (
    kind in (
      'post_published', 'post_failed', 'post_reminder', 'token_expiring',
      'token_revoked', 'subscription_confirmed', 'payment_failed',
      'subscription_cancelled', 'member_invited', 'system'
    )
  ),
  constraint notifications_severity_valid check (severity in ('info', 'warning', 'error', 'success'))
);

create index if not exists notifications_workspace_created_idx
  on public.notifications (workspace_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

-- ---------------------------------------------------------------------------
-- notification_preferences: opt-outs honoured before every send.
-- ---------------------------------------------------------------------------
create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email_post_published boolean not null default true,
  email_post_failed boolean not null default true,
  email_post_reminder boolean not null default false,
  email_token_expiring boolean not null default true,
  email_billing boolean not null default true,
  email_product_updates boolean not null default false,
  -- Never send before this hour in the user's timezone.
  quiet_hours_start smallint,
  quiet_hours_end smallint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_preferences_quiet_hours_valid check (
    (quiet_hours_start is null and quiet_hours_end is null)
    or (quiet_hours_start between 0 and 23 and quiet_hours_end between 0 and 23)
  )
);

-- ---------------------------------------------------------------------------
-- audit_logs: who did what, to which workspace entity.
-- ---------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  -- 'user' | 'system' | 'webhook'
  actor_type text not null default 'user',
  actor_user_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  -- Metadata is scrubbed by src/lib/logger.ts before it reaches the database:
  -- no tokens, no payment details, no raw webhook secrets.
  metadata jsonb,
  ip_address inet,
  user_agent text,
  request_id text,
  created_at timestamptz not null default now(),
  constraint audit_logs_actor_valid check (actor_type in ('user', 'system', 'webhook'))
);

create index if not exists audit_logs_workspace_created_idx
  on public.audit_logs (workspace_id, created_at desc);

create index if not exists audit_logs_entity_idx
  on public.audit_logs (entity_type, entity_id, created_at desc);

-- ---------------------------------------------------------------------------
-- rate_limit_counters: fixed-window counters (used by public.bump_rate_limit).
-- No client-facing policy exists; only the SECURITY DEFINER function touches it.
-- ---------------------------------------------------------------------------
create table if not exists public.rate_limit_counters (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);

create index if not exists rate_limit_counters_window_idx
  on public.rate_limit_counters (window_start);


-- ---------------------------------------------------------------------------
-- Rate limiting: atomic fixed-window counter (no Redis dependency).
-- ---------------------------------------------------------------------------
create or replace function public.bump_rate_limit(
  bucket_key text,
  max_hits integer,
  window_ms integer
)
returns table (allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  window_start timestamptz := to_timestamp(
    (extract(epoch from now()) * 1000 / window_ms)::bigint * window_ms / 1000.0
  );
  current_count integer;
begin
  insert into public.rate_limit_counters (key, window_start, count)
  values (bucket_key, window_start, 1)
  on conflict (key, window_start) do update
    set count = public.rate_limit_counters.count + 1
  returning public.rate_limit_counters.count into current_count;

  return query select
    current_count <= max_hits,
    greatest(max_hits - current_count, 0),
    window_start + make_interval(secs => window_ms / 1000.0);
end;
$$;

create trigger notification_preferences_set_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();
