-- Zybble — 0006_billing
-- Dodo Payments subscription state, payment receipts and the webhook ledger.

-- ---------------------------------------------------------------------------
-- subscriptions: entitlement state of a workspace.
--
-- Writable only by verified backend events (Dodo webhooks, Inngest
-- reconciliation). No RLS INSERT/UPDATE/DELETE policy exists for the
-- `authenticated` role, so a browser can never promote a workspace to Pro.
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces (id) on delete cascade,
  dodo_subscription_id text unique,
  dodo_customer_id text,
  plan text not null default 'free',
  -- Mirrors Dodo's lifecycle: pending | active | on_hold | paused | past_due |
  -- failed | cancelled | expired.
  status text not null default 'free',
  -- Billable seats. Maps 1:1 to Dodo subscription `quantity`.
  seats integer not null default 1,
  unit_amount_cents integer,
  currency text not null default 'USD',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  trial_ends_at timestamptz,
  -- Timestamp of the last provider event applied. Used to ignore out-of-order
  -- webhook deliveries (snapshots, never deltas).
  last_event_at timestamptz,
  last_event_type text,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_plan_valid check (plan in ('free', 'pro')),
  constraint subscriptions_status_valid check (
    status in (
      'free', 'pending', 'active', 'on_hold', 'paused', 'past_due', 'failed',
      'cancelled', 'expired'
    )
  ),
  constraint subscriptions_seats_positive check (seats > 0)
);

-- The plan currently in force for a workspace. `subscriptions` is the source of
-- truth once billing exists; the workspace row keeps the last known plan so a
-- page render never needs a second round trip. Webhooks keep both in sync.
--
-- A Pro subscription that has stopped being paid for is Free *in the database*,
-- not only in application code: a cancelled subscription whose period has closed,
-- a failed payment past the period end, or an expired subscription all fall back
-- here, so every trigger and policy that asks for the plan (account limits, the
-- scheduling quota, analytics history) agrees with the billing screen.
create or replace function public.workspace_plan(workspace uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when s.plan = 'pro'
     and s.status in ('active', 'past_due', 'pending')
     and (s.current_period_end is null or s.current_period_end > now())
    then 'pro'
    else 'free'
  end
  from public.subscriptions s
  where s.workspace_id = workspace
  union all
  select coalesce(
    (select w.plan from public.workspaces w where w.id = workspace),
    'free'
  )
  where not exists (select 1 from public.subscriptions s2 where s2.workspace_id = workspace)
  limit 1;
$$;

create index if not exists subscriptions_customer_idx on public.subscriptions (dodo_customer_id);

-- ---------------------------------------------------------------------------
-- billing_payments: receipts surfaced on the billing screen.
-- ---------------------------------------------------------------------------
create table if not exists public.billing_payments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  dodo_payment_id text not null unique,
  amount_cents integer not null,
  currency text not null default 'USD',
  -- 'paid' | 'failed' | 'refunded' | 'pending'
  status text not null default 'paid',
  brand text,
  last4 text,
  invoice_url text,
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint billing_payments_status_valid check (status in ('paid', 'failed', 'refunded', 'pending'))
);

create index if not exists billing_payments_workspace_idx
  on public.billing_payments (workspace_id, issued_at desc);

-- ---------------------------------------------------------------------------
-- webhook_events: idempotent processing ledger for inbound provider events.
--
-- `event_id` is the provider's `webhook-id` header and is the primary key, so a
-- replayed delivery cannot be claimed twice. Rows are inserted inside the same
-- transaction that applies the change; a failed handler rolls the claim back so
-- the provider's retry is processed.
-- ---------------------------------------------------------------------------
create table if not exists public.webhook_events (
  event_id text primary key,
  provider text not null default 'dodo',
  event_type text not null,
  -- 'received' → 'processed' | 'failed' | 'ignored'
  status text not null default 'received',
  signature_verified boolean not null default false,
  workspace_id uuid references public.workspaces (id) on delete set null,
  payload jsonb not null,
  error text,
  attempts integer not null default 0,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint webhook_events_provider_valid check (provider in ('dodo', 'inngest', 'linkedin')),
  constraint webhook_events_status_valid check (status in ('received', 'processed', 'failed', 'ignored'))
);

create index if not exists webhook_events_status_idx on public.webhook_events (status, received_at);
create index if not exists webhook_events_type_idx on public.webhook_events (event_type, received_at);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();
