-- Zybble — 0005_analytics
-- Metrics returned by LinkedIn's memberCreatorPostAnalytics API and the
-- best-time recommendation cache.

-- ---------------------------------------------------------------------------
-- post_analytics: per-post metric totals for one capture date.
--
-- Only metrics LinkedIn actually returns for the connected member are stored.
-- `members_reached` stays NULL unless the API returns a MEMBERS_REACHED value;
-- nothing in this table is ever synthesised or interpolated.
-- ---------------------------------------------------------------------------
create table if not exists public.post_analytics (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  captured_on date not null,
  source text not null default 'linkedin_member_creator_post_analytics',
  impressions integer,
  members_reached integer,
  reactions integer,
  comments integer,
  reposts integer,
  -- Engagement rate derived from the values above; NULL when impressions are
  -- unknown or zero so the UI can show "—" rather than a fabricated 0%.
  engagement_rate numeric(6, 4),
  -- Verbatim LinkedIn response for auditability.
  raw jsonb,
  synced_at timestamptz not null default now(),
  constraint post_analytics_source_valid check (
    source in ('linkedin_member_creator_post_analytics', 'linkedin_organization_share_statistics')
  ),
  constraint post_analytics_metrics_non_negative check (
    (impressions is null or impressions >= 0)
    and (members_reached is null or members_reached >= 0)
    and (reactions is null or reactions >= 0)
    and (comments is null or comments >= 0)
    and (reposts is null or reposts >= 0)
  )
);

create unique index if not exists post_analytics_post_captured_key
  on public.post_analytics (post_id, captured_on);

create index if not exists post_analytics_workspace_captured_idx
  on public.post_analytics (workspace_id, captured_on);

-- ---------------------------------------------------------------------------
-- analytics_snapshots: account-wide daily series (q=me finder).
-- ---------------------------------------------------------------------------
create table if not exists public.analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  linkedin_account_id uuid not null references public.linkedin_accounts (id) on delete cascade,
  captured_on date not null,
  metric_type text not null,
  -- 'daily' for a per-day value, 'total' for a period total.
  granularity text not null default 'daily',
  value bigint not null default 0,
  raw jsonb,
  synced_at timestamptz not null default now(),
  constraint analytics_snapshots_metric_valid check (
    metric_type in (
      'IMPRESSION', 'MEMBERS_REACHED', 'REACTION', 'COMMENT', 'RESHARE',
      'POST_SAVE', 'POST_SEND', 'LINK_CLICKS', 'PREMIUM_CTA_CLICKS',
      'FOLLOWER_GAINED_FROM_CONTENT', 'PROFILE_VIEW_FROM_CONTENT'
    )
  ),
  constraint analytics_snapshots_granularity_valid check (granularity in ('daily', 'total'))
);

create unique index if not exists analytics_snapshots_unique_point
  on public.analytics_snapshots (linkedin_account_id, captured_on, metric_type, granularity);

create index if not exists analytics_snapshots_workspace_day_idx
  on public.analytics_snapshots (workspace_id, captured_on);

-- ---------------------------------------------------------------------------
-- best_time_recommendations: cached output of the recommendation engine.
--
-- `score` is an estimate in [0,1] relative to the account's own history, never
-- a prediction. Rows are only written where the engine had enough evidence;
-- `sample_size` and `confidence` travel with every recommendation so the UI can
-- be honest about how thin the data is.
-- ---------------------------------------------------------------------------
create table if not exists public.best_time_recommendations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  linkedin_account_id uuid not null references public.linkedin_accounts (id) on delete cascade,
  -- 0 = Monday … 6 = Sunday, in the account timezone.
  weekday smallint not null,
  -- 0–23, account-local.
  hour smallint not null,
  score numeric(5, 4) not null,
  sample_size integer not null,
  confidence numeric(4, 3) not null,
  computed_at timestamptz not null default now(),
  constraint best_time_weekday_range check (weekday between 0 and 6),
  constraint best_time_hour_range check (hour between 0 and 23),
  constraint best_time_score_range check (score >= 0 and score <= 1),
  constraint best_time_confidence_range check (confidence >= 0 and confidence <= 1)
);

create unique index if not exists best_time_recommendations_slot_key
  on public.best_time_recommendations (linkedin_account_id, weekday, hour);

create index if not exists best_time_recommendations_workspace_idx
  on public.best_time_recommendations (workspace_id);
