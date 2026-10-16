-- Zybble — creator analytics events.
--
-- The studio's Analytics page reports what actually happened in the catalog:
-- how often a course card was seen (impressions), how often a course page was
-- opened (views), and how long learners actually watched (watch seconds). None
-- of that existed before, so it is recorded here rather than modelled.
--
-- Design rules:
--   * One row per event, written only by `POST /api/analytics/track` from the
--     service role, after the server has confirmed the course is published. A
--     browser cannot insert a row directly: nothing is granted to `anon` or
--     `authenticated`, and RLS is on, so the default is deny.
--   * No personal data. `actor_id` is nullable and only ever the signed-in
--     caller's own id, used to deduplicate and to compute reach; nothing joins
--     it to a name or an email, and no creator query may select it.
--   * Money never lives here. Revenue stays in the ledger.
--   * Counts are additive, so a replayed beacon inflates a metric by one rather
--     than corrupting a balance.

do $$ begin
  create type public.course_event_kind as enum ('impression', 'view', 'watch');
exception when duplicate_object then null; end $$;

create table if not exists public.course_events (
  id          bigint generated always as identity primary key,
  course_id   uuid not null references public.courses (id) on delete cascade,
  kind        public.course_event_kind not null,
  -- Null for signed-out visitors, which is most impressions and many views.
  actor_id    uuid references public.profiles (id) on delete set null,
  -- Watch events only: the lesson the playback heartbeat belongs to.
  lesson_id   uuid references public.lessons (id) on delete set null,
  -- Watch events only: whole seconds credited by one heartbeat. Capped so a
  -- forged beacon cannot claim a year of viewing in one row.
  seconds     integer not null default 0 check (seconds >= 0 and seconds <= 900),
  -- Where the event happened: 'explore', 'search', 'category', 'home',
  -- 'course-page', 'related', 'player'. Free text, informational only.
  source      text,
  created_at  timestamptz not null default now()
);

comment on table public.course_events is
  'Catalog engagement events behind creator analytics: impressions, course views and watched seconds.';
comment on column public.course_events.seconds is
  'Watched seconds for a `watch` event; always 0 for impressions and views.';

-- The two access patterns the analytics page uses: one course over a window,
-- and one creator's whole catalog over a window (resolved through course_id).
create index if not exists course_events_course_time_idx
  on public.course_events (course_id, created_at desc);
create index if not exists course_events_kind_time_idx
  on public.course_events (kind, created_at desc);
create index if not exists course_events_watch_idx
  on public.course_events (course_id, lesson_id)
  where kind = 'watch';

alter table public.course_events enable row level security;

-- Deliberately no grant and no policy for browser roles: every read and write
-- goes through server code that has already established which creator owns the
-- courses being reported on. RLS with no policy denies everything else.
revoke all on public.course_events from anon, authenticated;
revoke all on public.course_events from public;

-- ----------------------------------------------------------------------------
-- Retention
-- ----------------------------------------------------------------------------
--
-- Events are engagement telemetry, not financial records, so they are prunable.
-- A creator's longest analytics window is one year; this keeps fourteen months
-- and is safe to call from the same scheduled job that drains the email outbox.

create or replace function public.prune_course_events(p_retention_days integer default 420)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  if p_retention_days is null or p_retention_days < 30 then
    raise exception 'Retention must be at least 30 days';
  end if;

  delete from public.course_events
  where created_at < now() - make_interval(days => p_retention_days);

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.prune_course_events(integer) from public, anon, authenticated;
grant execute on function public.prune_course_events(integer) to service_role;

-- ----------------------------------------------------------------------------
-- Aggregates for the studio
-- ----------------------------------------------------------------------------
--
-- Both functions are `security definer` and callable only by `service_role`,
-- because they read across every event for the courses passed in. Ownership is
-- established *before* the call: the server derives `p_course_ids` from an
-- RLS-scoped read of `courses` for the signed-in creator, so a creator can only
-- ever aggregate their own catalog. Neither function returns an actor id.
--
-- They exist so a one-year window costs a handful of rows instead of every
-- impression ever recorded. Enrollments ride along because `entitlements` is
-- readable only by its owner under RLS, and a creator must be able to see the
-- sales their reach produced.

create or replace function public.creator_engagement_by_course(
  p_course_ids uuid[],
  p_since timestamptz,
  p_until timestamptz default now()
)
returns table (
  course_id       uuid,
  impressions     bigint,
  views           bigint,
  viewers         bigint,
  watch_seconds   bigint,
  watch_sessions  bigint,
  enrollments     bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with scoped as (
    select c.id as course_id
    from public.courses c
    where c.id = any (p_course_ids)
  ),
  events as (
    select
      e.course_id,
      count(*) filter (where e.kind = 'impression') as impressions,
      count(*) filter (where e.kind = 'view') as views,
      count(distinct e.actor_id) filter (where e.kind = 'view' and e.actor_id is not null) as viewers,
      coalesce(sum(e.seconds) filter (where e.kind = 'watch'), 0) as watch_seconds,
      count(distinct (e.actor_id, e.lesson_id, date_trunc('hour', e.created_at)))
        filter (where e.kind = 'watch') as watch_sessions
    from public.course_events e
    where e.course_id = any (p_course_ids)
      and e.created_at >= p_since
      and e.created_at < p_until
    group by e.course_id
  ),
  joined as (
    select
      t.course_id,
      count(*) filter (where t.created_at >= p_since and t.created_at < p_until) as enrollments
    from public.entitlements t
    where t.course_id = any (p_course_ids)
    group by t.course_id
  )
  select
    s.course_id,
    coalesce(e.impressions, 0),
    coalesce(e.views, 0),
    coalesce(e.viewers, 0),
    coalesce(e.watch_seconds, 0),
    coalesce(e.watch_sessions, 0),
    coalesce(j.enrollments, 0)
  from scoped s
  left join events e on e.course_id = s.course_id
  left join joined j on j.course_id = s.course_id;
$$;

create or replace function public.creator_engagement_daily(
  p_course_ids uuid[],
  p_since timestamptz,
  p_until timestamptz default now()
)
returns table (
  day             date,
  impressions     bigint,
  views           bigint,
  watch_seconds   bigint,
  enrollments     bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with per_day as (
    select
      date_trunc('day', e.created_at)::date as day,
      count(*) filter (where e.kind = 'impression') as impressions,
      count(*) filter (where e.kind = 'view') as views,
      coalesce(sum(e.seconds) filter (where e.kind = 'watch'), 0) as watch_seconds,
      0::bigint as enrollments
    from public.course_events e
    where e.course_id = any (p_course_ids)
      and e.created_at >= p_since
      and e.created_at < p_until
    group by 1

    union all

    select
      date_trunc('day', t.created_at)::date as day,
      0::bigint,
      0::bigint,
      0::bigint,
      count(*) as enrollments
    from public.entitlements t
    where t.course_id = any (p_course_ids)
      and t.created_at >= p_since
      and t.created_at < p_until
    group by 1
  )
  select
    day,
    sum(impressions)::bigint,
    sum(views)::bigint,
    sum(watch_seconds)::bigint,
    sum(enrollments)::bigint
  from per_day
  group by day
  order by day;
$$;

revoke all on function public.creator_engagement_by_course(uuid[], timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.creator_engagement_daily(uuid[], timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.creator_engagement_by_course(uuid[], timestamptz, timestamptz) to service_role;
grant execute on function public.creator_engagement_daily(uuid[], timestamptz, timestamptz) to service_role;
