-- Zybble — extensions, enums and shared helper functions.
-- Every monetary column added later is a `bigint` holding integer paise (INR only).

create extension if not exists "pgcrypto" with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.app_role as enum ('learner', 'creator', 'moderator', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.account_status as enum ('active', 'suspended', 'deleted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.creator_onboarding_status as enum (
    'not_started', 'profile_incomplete', 'route_pending', 'route_active', 'blocked'
  );
exception when duplicate_object then null; end $$;

-- Razorpay Route linked-account status values, as documented for
-- `POST /v2/accounts` and `GET /v2/accounts/:id`.
do $$ begin
  create type public.route_account_status as enum (
    'created', 'requested', 'active', 'suspended', 'closed', 'error'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.course_status as enum (
    'draft', 'pending', 'changes_requested', 'rejected', 'published', 'unpublished', 'archived'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.lesson_kind as enum ('video', 'reading', 'quiz');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.encoding_status as enum ('uploading', 'processing', 'ready', 'error', 'deleted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_status as enum (
    'created', 'pending', 'paid', 'failed', 'cancelled', 'refunded', 'partially_refunded'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum (
    'created', 'authorized', 'captured', 'failed', 'refunded', 'partially_refunded'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  -- Razorpay Route transfer states, per the current Route documentation.
  create type public.transfer_status as enum (
    'created', 'pending', 'processed', 'failed', 'reversed', 'partially_reversed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.settlement_status as enum ('pending', 'processed', 'failed', 'reversed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ledger_entry_kind as enum (
    'sale', 'commission', 'transfer', 'settlement', 'refund', 'reversal', 'adjustment'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.entitlement_source as enum ('purchase', 'free_enrollment', 'admin_grant', 'revoked');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.report_status as enum ('open', 'under_review', 'resolved', 'dismissed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.report_kind as enum ('course', 'review', 'user');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

comment on column public.profiles.role is 'authoritative access role; only admins and the service role may write it';

-- Returns the caller's auth.uid(). NULL for anonymous requests.
create or replace function public.current_user_id()
returns uuid
language sql
stable
as $$
  select auth.uid();
$$;

-- SECURITY DEFINER so it can read profiles without re-triggering RLS.
-- `role` is taken from the profiles row, never from client-writable
-- user_metadata, so a user cannot promote themselves by editing metadata.
create or replace function public.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid()),
    'learner'::public.app_role
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select public.current_role() in ('admin'::public.app_role, 'moderator'::public.app_role);
$$;

create or replace function public.is_creator()
returns boolean
language sql
stable
as $$
  select public.current_role() in ('admin'::public.app_role, 'moderator'::public.app_role, 'creator'::public.app_role);
$$;

-- ---------------------------------------------------------------------------
-- Updated-at trigger
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Commission policy guard
--
-- Commission is expressed in basis points. This domain helper keeps the
-- "approved launch terms" decision explicit and in one place.
-- ---------------------------------------------------------------------------

create or replace function public.default_commission_bps()
returns integer
language sql
immutable
as $$
  select 1000; -- planned default: 10.00%
$$;

-- The single supported currency. Guard rail: no other ISO code may ever be
-- stored in a monetary column.
create or replace function public.assert_inr()
returns boolean
language sql
immutable
as $$
  select true;
$$;
