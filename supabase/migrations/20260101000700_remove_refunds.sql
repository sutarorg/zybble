-- Zybble — refunds are removed from the product, completely.
--
-- Zybble never published a refund policy and now has no refund machinery at
-- all: no `refunds` table, no refund statuses on orders or payments, no refund
-- split maths, and no code path that reverses money to a learner. Money leaves
-- the platform in exactly one way — a reviewed creator payout.
--
-- What this migration does, in dependency order:
--   1. drops the payout RPC that read `refunds` (recreated at the end without it),
--   2. drops the `refunds` table and its admin-read policy,
--   3. rebuilds `order_status` and `payment_status` without refund values,
--   4. recreates the RPC and leaves the ledger untouched.
--
-- `ledger_entry_kind` deliberately keeps its historical `'refund'` value:
-- `ledger_entries` is append-only (the `ledger_entries_no_update` trigger raises
-- on update or delete), so rewriting financial history to satisfy a type would
-- break the one invariant the ledger exists to guarantee. No code path can write
-- that value any more — the TypeScript ledger union no longer includes it.
--
-- Legacy rows, if any exist, are converted in the `using` clause rather than
-- deleted: an order that was once reversed becomes `cancelled` (access ended),
-- and a payment that was once reversed stays `captured` (the capture happened —
-- that is a fact about the provider, not a promise Zybble makes).

-- ===========================================================================
-- 1. Drop the RPC that depends on the refunds table
-- ===========================================================================

drop function if exists public.create_creator_payout_request(uuid, text, bigint, text);

-- ===========================================================================
-- 2. Drop the refunds table
-- ===========================================================================

-- The policy and the index go with the table.
drop policy if exists refunds_admin_read on public.refunds;
drop index if exists public.refunds_order_idx;
drop table if exists public.refunds cascade;

-- ===========================================================================
-- 3. Rebuild the status enums without refund values
-- ===========================================================================

-- Postgres cannot remove a value from an enum, so each type is rebuilt: create
-- the replacement, convert the column, drop the old type, rename.

do $$
begin
  if exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'order_status' and e.enumlabel in ('refunded', 'partially_refunded')
  ) then
    create type public.order_status_v2 as enum (
      'created', 'pending', 'paid', 'failed', 'cancelled'
    );

    alter table public.orders alter column status drop default;
    alter table public.orders
      alter column status type public.order_status_v2
      using (
        case status::text
          when 'refunded' then 'cancelled'
          when 'partially_refunded' then 'cancelled'
          else status::text
        end
      )::public.order_status_v2;
    alter table public.orders alter column status set default 'created';

    drop type public.order_status;
    alter type public.order_status_v2 rename to order_status;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'payment_status' and e.enumlabel in ('refunded', 'partially_refunded')
  ) then
    create type public.payment_status_v2 as enum (
      'created', 'authorized', 'captured', 'failed'
    );

    alter table public.payments alter column status drop default;
    alter table public.payments
      alter column status type public.payment_status_v2
      using (
        case status::text
          when 'refunded' then 'captured'
          when 'partially_refunded' then 'captured'
          else status::text
        end
      )::public.payment_status_v2;
    alter table public.payments alter column status set default 'created';

    drop type public.payment_status;
    alter type public.payment_status_v2 rename to payment_status;
  end if;
end $$;

comment on column public.orders.status is
  'Order state machine. There is no refund state: Zybble has no refund flow.';

-- ===========================================================================
-- 4. Recreate the payout RPC without refund debits
-- ===========================================================================
--
-- Identical contract to the version in 20260101000600, minus step 2 of the old
-- balance calculation (creator-share debits from processed refunds). Net earned
-- is now simply the captured creator share.

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

  -- 1. Gross creator share from captured orders. There is no refund debit: a
  --    captured creator share is never taken back.
  select coalesce(sum(oi.creator_share_paise), 0)
  into v_gross_earned
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.creator_id = p_creator_id
    and o.status = 'paid';

  v_net_earned := v_gross_earned;

  -- 2. Completed payouts (manual paid requests + historical settled Route transfers).
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

  -- 3. Reserved in open requests (requested or approved).
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
