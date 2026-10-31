-- Zybble — 0001_foundation
-- Schema helpers, shared trigger functions and multi-tenancy primitives.
--
-- Conventions used across every migration in this project:
--   * every instant is `timestamptz` and stored in UTC;
--   * every mutable table carries `created_at` / `updated_at` maintained by trigger;
--   * every workspace-scoped table carries `workspace_id` and is protected by RLS
--     (see 0008_rls.sql) through the helpers declared below;
--   * helper functions are STABLE + SECURITY DEFINER with a pinned search_path so
--     RLS predicates evaluate once per statement instead of once per row.

create schema if not exists public;

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Identifier helpers
-- ---------------------------------------------------------------------------
create or replace function public.slugify(input text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    regexp_replace(lower(btrim(coalesce(input, ''))), '[^a-z0-9]+', '-', 'g'),
    '(^-+|-+$)', '', 'g'
  );
$$;

-- Calendar month key (`YYYY-MM`) used by the Free-plan scheduled-post counter.
create or replace function public.usage_period(instant timestamptz)
returns text
language sql
immutable
as $$
  select to_char(timezone('utc', instant), 'YYYY-MM');
$$;
