-- ============================================================================
-- Zybble — Migration 6: Manual Creator Payouts & Encrypted Payout Destinations
--
-- Replaces the operational dependency on Razorpay Route with an auditable,
-- server-authorized manual payout workflow while preserving legacy Route
-- tables and columns non-destructively for historical records.
--
-- Security invariants enforced here:
--   * All money amounts are integer paise in INR (`currency = 'INR'`).
--   * Full creator payout destinations (beneficiary name, UPI VPA, bank
--     account number, IFSC) are AES-256-GCM encrypted in the application layer
--     before reaching Postgres (`encrypted_payload` /
--     `destination_encrypted_payload`), and the ciphertext column is not even
--     granted to `anon` or `authenticated`.
--   * Each payout request captures an immutable snapshot of the destination
--     that was active when the creator submitted the request.
--   * A payout request cannot transition to `paid` unless an admin records a
--     real payment reference (UTR / bank / UPI reference) and explicitly
--     confirms both the amount and the off-platform transfer.
--   * State transitions are guarded by a BEFORE UPDATE trigger so terminal
--     requests (`paid`, `rejected`, `failed`, `cancelled`) cannot be mutated
--     or double-paid.
-- ============================================================================

-- Mark legacy Razorpay Route objects as deprecated (kept for historical rows).
comment on table public.route_transfers is
  'DEPRECATED: Historical Razorpay Route transfer records. New orders settle to Zybble and pay creators via public.payout_requests.';
comment on table public.route_settlements is
  'DEPRECATED: Historical Razorpay Route settlement records. New creator payouts are tracked in public.payout_requests.';
comment on column public.creator_profiles.route_account_id is
  'DEPRECATED: Legacy Razorpay Route linked-account identifier. Active creator payout destinations live in public.creator_payout_destinations.';
comment on column public.creator_profiles.route_account_status is
  'DEPRECATED: Legacy Razorpay Route linked-account status. Paid course publication no longer depends on Route.';
comment on column public.creator_profiles.route_settlement_verified is
  'DEPRECATED: Legacy Razorpay Route settlement flag. Creators now configure UPI or bank destinations in public.creator_payout_destinations.';

do $$ begin
  alter type public.ledger_entry_kind add value if not exists 'payout';
exception when others then null; end $$;

do $$ begin
  create type public.payout_destination_method as enum ('upi', 'bank');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payout_request_status as enum (
    'requested',
    'approved',
    'paid',
    'rejected',
    'failed',
    'cancelled'
  );
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- Creator payout destinations (one active destination per creator)
-- ----------------------------------------------------------------------------

create table if not exists public.creator_payout_destinations (
  creator_id             uuid primary key references public.creator_profiles (user_id) on delete cascade,
  method                 public.payout_destination_method not null,
  masked_destination     text not null check (length(trim(masked_destination)) between 3 and 120),
  masked_account_holder  text not null check (length(trim(masked_account_holder)) between 1 and 120),
  bank_label             text check (bank_label is null or length(bank_label) <= 120),
  encrypted_payload      text not null check (
    encrypted_payload ~ '^v1:[A-Za-z0-9+/=_-]+:[A-Za-z0-9+/=_-]+:[A-Za-z0-9+/=_-]+$'
  ),
  key_version            smallint not null default 1 check (key_version >= 1),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Manual creator payout requests (with immutable destination snapshot)
-- ----------------------------------------------------------------------------

create table if not exists public.payout_requests (
  id                              uuid primary key default gen_random_uuid(),
  public_id                       text not null unique,
  creator_id                      uuid not null references public.creator_profiles (user_id) on delete restrict,
  amount_paise                    bigint not null check (amount_paise > 0),
  currency                        text not null default 'INR' check (currency = 'INR'),
  status                          public.payout_request_status not null default 'requested',

  -- Immutable snapshot of the destination at the moment the payout was requested
  destination_method              public.payout_destination_method not null,
  destination_masked              text not null check (length(trim(destination_masked)) between 3 and 120),
  destination_holder_masked       text not null check (length(trim(destination_holder_masked)) between 1 and 120),
  destination_bank_label          text check (destination_bank_label is null or length(destination_bank_label) <= 120),
  destination_encrypted_payload   text not null check (
    destination_encrypted_payload ~ '^v1:[A-Za-z0-9+/=_-]+:[A-Za-z0-9+/=_-]+:[A-Za-z0-9+/=_-]+$'
  ),
  destination_key_version         smallint not null default 1 check (destination_key_version >= 1),

  -- Balance snapshot when the request was opened
  eligible_earned_paise_snapshot  bigint not null default 0,
  available_paise_snapshot        bigint not null default 0 check (available_paise_snapshot >= amount_paise),

  -- Notes & settlement proof
  creator_note                    text check (creator_note is null or length(creator_note) <= 500),
  admin_note                      text check (admin_note is null or length(admin_note) <= 1000),
  rejection_reason                text check (rejection_reason is null or length(rejection_reason) <= 1000),
  failure_reason                  text check (failure_reason is null or length(failure_reason) <= 1000),
  payment_reference               text check (payment_reference is null or length(trim(payment_reference)) between 4 and 120),
  payment_method_used             text check (payment_method_used is null or length(payment_method_used) <= 60),
  amount_confirmed                boolean not null default false,
  transfer_confirmed              boolean not null default false,

  -- Lifecycle actors & timestamps
  requested_at                    timestamptz not null default now(),
  reviewed_by                     uuid references public.profiles (id) on delete set null,
  approved_at                     timestamptz,
  paid_by                         uuid references public.profiles (id) on delete set null,
  paid_at                         timestamptz,
  rejected_by                     uuid references public.profiles (id) on delete set null,
  rejected_at                     timestamptz,
  failed_by                       uuid references public.profiles (id) on delete set null,
  failed_at                       timestamptz,
  cancelled_at                    timestamptz,
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now(),

  constraint payout_requests_paid_requires_confirmation check (
    status <> 'paid' or (
      payment_reference is not null
      and length(trim(payment_reference)) >= 4
      and paid_at is not null
      and paid_by is not null
      and amount_confirmed = true
      and transfer_confirmed = true
    )
  ),
  constraint payout_requests_rejected_requires_reason check (
    status <> 'rejected' or (
      rejection_reason is not null
      and length(trim(rejection_reason)) >= 3
      and rejected_at is not null
    )
  ),
  constraint payout_requests_failed_requires_reason check (
    status <> 'failed' or (
      failure_reason is not null
      and length(trim(failure_reason)) >= 3
      and failed_at is not null
    )
  )
);

create index if not exists payout_requests_creator_idx
  on public.payout_requests (creator_id, requested_at desc);
create index if not exists payout_requests_status_idx
  on public.payout_requests (status, requested_at desc);

-- ----------------------------------------------------------------------------
-- Payout audit events
-- ----------------------------------------------------------------------------

create table if not exists public.payout_audit_events (
  id                 uuid primary key default gen_random_uuid(),
  payout_request_id  uuid references public.payout_requests (id) on delete cascade,
  creator_id         uuid not null references public.creator_profiles (user_id) on delete cascade,
  actor_id           uuid references public.profiles (id) on delete set null,
  actor_role         public.app_role not null,
  action             text not null check (length(trim(action)) between 2 and 120),
  from_status        public.payout_request_status,
  to_status          public.payout_request_status,
  amount_paise       bigint check (amount_paise is null or amount_paise >= 0),
  payment_reference  text,
  note               text,
  metadata           jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

create index if not exists payout_audit_events_creator_idx
  on public.payout_audit_events (creator_id, created_at desc);
create index if not exists payout_audit_events_request_idx
  on public.payout_audit_events (payout_request_id, created_at desc);

-- ----------------------------------------------------------------------------
-- Updated-at triggers
-- ----------------------------------------------------------------------------

drop trigger if exists creator_payout_destinations_touch on public.creator_payout_destinations;
create trigger creator_payout_destinations_touch
  before update on public.creator_payout_destinations
  for each row execute function public.touch_updated_at();

drop trigger if exists payout_requests_touch on public.payout_requests;
create trigger payout_requests_touch
  before update on public.payout_requests
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- State transition & immutability guard on payout_requests
-- ----------------------------------------------------------------------------

create or replace function public.guard_payout_request_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Core financial and snapshot fields are immutable once created.
  if new.creator_id is distinct from old.creator_id
     or new.amount_paise is distinct from old.amount_paise
     or new.currency is distinct from old.currency
     or new.destination_method is distinct from old.destination_method
     or new.destination_masked is distinct from old.destination_masked
     or new.destination_holder_masked is distinct from old.destination_holder_masked
     or new.destination_encrypted_payload is distinct from old.destination_encrypted_payload
  then
    raise exception 'Payout request amount, creator, and destination snapshot are immutable';
  end if;

  -- Terminal states cannot transition to any other state.
  if old.status in ('paid', 'rejected', 'failed', 'cancelled') and new.status is distinct from old.status then
    raise exception 'Cannot transition payout request from terminal status % to %', old.status, new.status;
  end if;

  -- Once paid, settlement reference fields cannot be rewritten.
  if old.status = 'paid' and (
    new.payment_reference is distinct from old.payment_reference
    or new.paid_at is distinct from old.paid_at
    or new.paid_by is distinct from old.paid_by
  ) then
    raise exception 'Paid payout settlement reference is immutable';
  end if;

  -- Approved requests can only move to paid, rejected, or failed (never back to requested/cancelled).
  if old.status = 'approved' and new.status not in ('approved', 'paid', 'rejected', 'failed') then
    raise exception 'Cannot transition approved payout request to %', new.status;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_payout_request_transition on public.payout_requests;
create trigger guard_payout_request_transition
  before update on public.payout_requests
  for each row execute function public.guard_payout_request_transition();

-- ----------------------------------------------------------------------------
-- Atomic balance calculation & payout request creation RPC
-- ----------------------------------------------------------------------------

create or replace function public.create_creator_payout_request(
  p_creator_id uuid,
  p_public_id text,
  p_amount_paise bigint,
  p_creator_note text default null
)
returns public.payout_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dest public.creator_payout_destinations;
  v_gross_earned bigint := 0;
  v_refund_debit bigint := 0;
  v_net_earned bigint := 0;
  v_paid_out bigint := 0;
  v_reserved bigint := 0;
  v_available bigint := 0;
  v_row public.payout_requests;
begin
  if p_amount_paise is null or p_amount_paise <= 0 then
    raise exception 'Payout request amount must be greater than zero paise';
  end if;

  -- Serialize concurrent payout requests for the same creator by locking their
  -- creator_profiles row for the duration of this transaction.
  perform 1
  from public.creator_profiles
  where user_id = p_creator_id
  for update;

  if not found then
    raise exception 'Creator profile not found';
  end if;

  select *
  into v_dest
  from public.creator_payout_destinations
  where creator_id = p_creator_id;

  if not found then
    raise exception 'Save a payout destination before requesting a payout';
  end if;

  -- 1. Gross creator share from captured orders.
  select coalesce(sum(oi.creator_share_paise), 0)
  into v_gross_earned
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.creator_id = p_creator_id
    and o.status in ('paid', 'partially_refunded', 'refunded');

  -- 2. Creator share debits from processed refunds/reversals.
  select coalesce(sum(
    case
      when oi.unit_price_paise > 0 then
        least(
          oi.creator_share_paise,
          round((r.amount_paise::numeric * oi.creator_share_paise::numeric) / oi.unit_price_paise::numeric)::bigint
        )
      else 0
    end
  ), 0)
  into v_refund_debit
  from public.refunds r
  join public.order_items oi on oi.order_id = r.order_id
  where oi.creator_id = p_creator_id
    and r.status = 'processed';

  v_net_earned := v_gross_earned - v_refund_debit;

  -- 3. Completed payouts (manual paid requests + historical settled Route transfers).
  select
    coalesce((
      select sum(pr.amount_paise)
      from public.payout_requests pr
      where pr.creator_id = p_creator_id
        and pr.status = 'paid'
    ), 0)
    +
    coalesce((
      select sum(rs.amount_paise)
      from public.route_settlements rs
      where rs.creator_id = p_creator_id
        and rs.status = 'processed'
    ), 0)
  into v_paid_out;

  -- 4. Reserved in open requests (requested or approved).
  select coalesce(sum(pr.amount_paise), 0)
  into v_reserved
  from public.payout_requests pr
  where pr.creator_id = p_creator_id
    and pr.status in ('requested', 'approved');

  v_available := greatest(0, v_net_earned - v_paid_out - v_reserved);

  if p_amount_paise > v_available then
    raise exception 'Requested amount (% paise) exceeds available balance (% paise)', p_amount_paise, v_available;
  end if;

  insert into public.payout_requests (
    public_id,
    creator_id,
    amount_paise,
    currency,
    status,
    destination_method,
    destination_masked,
    destination_holder_masked,
    destination_bank_label,
    destination_encrypted_payload,
    destination_key_version,
    eligible_earned_paise_snapshot,
    available_paise_snapshot,
    creator_note
  )
  values (
    p_public_id,
    p_creator_id,
    p_amount_paise,
    'INR',
    'requested',
    v_dest.method,
    v_dest.masked_destination,
    v_dest.masked_account_holder,
    v_dest.bank_label,
    v_dest.encrypted_payload,
    v_dest.key_version,
    v_net_earned,
    v_available,
    p_creator_note
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.create_creator_payout_request(uuid, text, bigint, text) from public, anon, authenticated;
grant execute on function public.create_creator_payout_request(uuid, text, bigint, text) to service_role;

-- ----------------------------------------------------------------------------
-- Row Level Security & Grants
-- ----------------------------------------------------------------------------

alter table public.creator_payout_destinations enable row level security;
alter table public.payout_requests enable row level security;
alter table public.payout_audit_events enable row level security;

revoke all on public.creator_payout_destinations from anon, authenticated;
revoke all on public.payout_requests from anon, authenticated;
revoke all on public.payout_audit_events from anon, authenticated;

-- Creators and admins may read only the masked metadata columns via their
-- session; `encrypted_payload` and `destination_encrypted_payload` are NOT
-- granted to `anon` or `authenticated`.
grant select (
  creator_id,
  method,
  masked_destination,
  masked_account_holder,
  bank_label,
  key_version,
  created_at,
  updated_at
) on public.creator_payout_destinations to authenticated;

grant select (
  id,
  public_id,
  creator_id,
  amount_paise,
  currency,
  status,
  destination_method,
  destination_masked,
  destination_holder_masked,
  destination_bank_label,
  destination_key_version,
  eligible_earned_paise_snapshot,
  available_paise_snapshot,
  creator_note,
  admin_note,
  rejection_reason,
  failure_reason,
  payment_reference,
  payment_method_used,
  amount_confirmed,
  transfer_confirmed,
  requested_at,
  reviewed_by,
  approved_at,
  paid_by,
  paid_at,
  rejected_by,
  rejected_at,
  failed_by,
  failed_at,
  cancelled_at,
  created_at,
  updated_at
) on public.payout_requests to authenticated;

grant select on public.payout_audit_events to authenticated;

grant all on public.creator_payout_destinations to service_role;
grant all on public.payout_requests to service_role;
grant all on public.payout_audit_events to service_role;

drop policy if exists creator_payout_destinations_own_read on public.creator_payout_destinations;
create policy creator_payout_destinations_own_read on public.creator_payout_destinations
  for select to authenticated
  using (creator_id = auth.uid() or public.is_admin());

drop policy if exists payout_requests_own_read on public.payout_requests;
create policy payout_requests_own_read on public.payout_requests
  for select to authenticated
  using (creator_id = auth.uid() or public.is_admin());

drop policy if exists payout_audit_events_own_or_admin_read on public.payout_audit_events;
create policy payout_audit_events_own_or_admin_read on public.payout_audit_events
  for select to authenticated
  using (creator_id = auth.uid() or public.is_admin());
