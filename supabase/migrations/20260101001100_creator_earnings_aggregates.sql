-- ===========================================================================
-- 001100: captured-earnings aggregates for Creator Studio
-- ===========================================================================
--
-- Why these functions exist
-- -------------------------
-- Creator earnings used to be summed in TypeScript from
-- `order_items ... orders ( status )` read through the caller's RLS client.
-- That is wrong twice over:
--
--   1. `orders_own_read` is `user_id = auth.uid() or is_admin()`. A creator is
--      neither the buyer nor an admin, so PostgREST filters the embedded order
--      out and the join comes back `null` for every row. A filter written as
--      "ignore the row only if the status is present and not paid" therefore
--      counted *every* order item — including `created`, `pending`, `failed`
--      and `cancelled` checkouts that never captured a rupee.
--   2. `.select()` returns at most 1000 rows, so a creator with more than a
--      thousand sales silently lost the oldest ones from their own totals.
--
-- Both are fixed by aggregating in SQL, where the join to `orders` is not
-- subject to the caller's RLS. Each function derives the creator from
-- `auth.uid()` rather than trusting an argument, so the only rows it can ever
-- see are the calling creator's own captured sales — the same set the
-- `order_items_own_read` policy already exposes, minus the unpaid ones.
--
-- Grants
-- ------
-- Execute is granted to `authenticated` only. These must be called with the
-- creator's own session client: under `service_role` there is no `auth.uid()`,
-- so the functions would return zeros and a missing key would look like "no
-- earnings". Revoking from `service_role` makes that mistake impossible instead
-- of silent.
--
-- Money is integer paise throughout; `unit_price_paise = commission_paise +
-- creator_share_paise` is enforced per row by `item_split_is_exact`, so the
-- aggregated columns keep the same identity.

-- ----------------------------------------------------------------------------
-- Lifetime totals
-- ----------------------------------------------------------------------------
--
-- Always returns exactly one row: an aggregate without GROUP BY yields zeros
-- for a creator with no captured sales, so "no earnings yet" and "no data" are
-- both answered honestly by the caller's own empty states.

create or replace function public.creator_earnings_totals()
returns table (
  sales               bigint,
  gross_paise         bigint,
  commission_paise    bigint,
  creator_share_paise bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(oi.id)::bigint,
    coalesce(sum(oi.unit_price_paise), 0)::bigint,
    coalesce(sum(oi.commission_paise), 0)::bigint,
    coalesce(sum(oi.creator_share_paise), 0)::bigint
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.creator_id = auth.uid()
    and o.status = 'paid';
$$;

comment on function public.creator_earnings_totals() is
  'Lifetime captured-sales totals for the calling creator, in integer paise.';

-- ----------------------------------------------------------------------------
-- Per-course breakdown
-- ----------------------------------------------------------------------------
--
-- `course_title` is the snapshot stored on the order item, so a renamed course
-- does not rewrite history. Ordered by the creator's own share, descending.

create or replace function public.creator_earnings_by_course()
returns table (
  course_id           uuid,
  course_title        text,
  sales               bigint,
  gross_paise         bigint,
  commission_paise    bigint,
  creator_share_paise bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    oi.course_id,
    max(oi.course_title),
    count(oi.id)::bigint,
    coalesce(sum(oi.unit_price_paise), 0)::bigint,
    coalesce(sum(oi.commission_paise), 0)::bigint,
    coalesce(sum(oi.creator_share_paise), 0)::bigint
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.creator_id = auth.uid()
    and o.status = 'paid'
  group by oi.course_id
  order by coalesce(sum(oi.creator_share_paise), 0) desc, max(oi.course_title);
$$;

comment on function public.creator_earnings_by_course() is
  'Captured sales per course for the calling creator, richest first.';

-- ----------------------------------------------------------------------------
-- Per-day series
-- ----------------------------------------------------------------------------
--
-- Days are UTC dates, matching the `created_at.toISOString().slice(0, 10)`
-- bucketing the studio charts already use. Days with no sales are absent; the
-- caller fills the window so a flat zero line stays distinguishable from a
-- window that was never queried.

create or replace function public.creator_earnings_daily(
  p_since timestamptz,
  p_until timestamptz default now()
)
returns table (
  day                 date,
  sales               bigint,
  gross_paise         bigint,
  commission_paise    bigint,
  creator_share_paise bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (oi.created_at at time zone 'UTC')::date,
    count(oi.id)::bigint,
    coalesce(sum(oi.unit_price_paise), 0)::bigint,
    coalesce(sum(oi.commission_paise), 0)::bigint,
    coalesce(sum(oi.creator_share_paise), 0)::bigint
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.creator_id = auth.uid()
    and o.status = 'paid'
    and oi.created_at >= coalesce(p_since, now() - interval '30 days')
    and oi.created_at < coalesce(p_until, now())
  group by 1
  order by 1;
$$;

comment on function public.creator_earnings_daily(timestamptz, timestamptz) is
  'Captured sales per UTC day for the calling creator, inside [p_since, p_until).';

-- ----------------------------------------------------------------------------
-- Per-month series
-- ----------------------------------------------------------------------------
--
-- Covers the last `p_months` calendar months including the current, still-open
-- one, clamped to 1..36 so a caller cannot ask for an unbounded scan.

create or replace function public.creator_earnings_monthly(p_months integer default 6)
returns table (
  month_key           text,
  sales               bigint,
  gross_paise         bigint,
  commission_paise    bigint,
  creator_share_paise bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select
      date_trunc('month', now() at time zone 'UTC')
        - make_interval(months => greatest(1, least(coalesce(p_months, 6), 36)) - 1) as since
  )
  select
    to_char(date_trunc('month', oi.created_at at time zone 'UTC'), 'YYYY-MM'),
    count(oi.id)::bigint,
    coalesce(sum(oi.unit_price_paise), 0)::bigint,
    coalesce(sum(oi.commission_paise), 0)::bigint,
    coalesce(sum(oi.creator_share_paise), 0)::bigint
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  cross join bounds b
  where oi.creator_id = auth.uid()
    and o.status = 'paid'
    and oi.created_at >= b.since
  group by 1
  order by 1;
$$;

comment on function public.creator_earnings_monthly(integer) is
  'Captured sales per calendar month for the calling creator, oldest first.';

-- ----------------------------------------------------------------------------
-- Grants
-- ----------------------------------------------------------------------------

revoke all on function public.creator_earnings_totals() from public, anon, service_role;
revoke all on function public.creator_earnings_by_course() from public, anon, service_role;
revoke all on function public.creator_earnings_daily(timestamptz, timestamptz) from public, anon, service_role;
revoke all on function public.creator_earnings_monthly(integer) from public, anon, service_role;

grant execute on function public.creator_earnings_totals() to authenticated;
grant execute on function public.creator_earnings_by_course() to authenticated;
grant execute on function public.creator_earnings_daily(timestamptz, timestamptz) to authenticated;
grant execute on function public.creator_earnings_monthly(integer) to authenticated;
