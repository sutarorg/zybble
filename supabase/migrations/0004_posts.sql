-- Zybble — 0004_posts
-- Posts, media assets and the publish-attempt ledger that makes retries safe.

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- LinkedIn connection the post will publish through.
  author_account_id uuid not null references public.linkedin_accounts (id) on delete restrict,
  created_by uuid not null references auth.users (id) on delete restrict,
  body text not null default '',
  status text not null default 'draft',
  -- UTC instant to publish at. NULL while the post is a draft.
  scheduled_at timestamptz,
  -- IANA zone the author picked the wall time in; kept so a reschedule shows
  -- the same wall-clock time the author originally chose.
  timezone text,
  -- Calendar month the post was scheduled in; drives the Free-plan quota.
  usage_period text,
  published_at timestamptz,
  linkedin_post_urn text,
  -- Non-technical, user-actionable failure explanation.
  failure_reason text,
  failure_code text,
  attempts integer not null default 0,
  -- Client-supplied idempotency key so a double-submitted form cannot create
  -- two copies of the same post.
  idempotency_key text,
  media_count integer not null default 0,
  last_error_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint posts_status_valid check (
    status in ('draft', 'scheduled', 'publishing', 'published', 'failed', 'cancelled')
  ),
  constraint posts_body_length check (char_length(body) <= 3000),
  constraint posts_scheduled_requires_time check (status <> 'scheduled' or scheduled_at is not null),
  constraint posts_published_requires_urn check (status <> 'published' or (published_at is not null and linkedin_post_urn is not null)),
  constraint posts_urn_shape check (
    linkedin_post_urn is null or linkedin_post_urn ~ '^urn:li:(share|ugcPost):[A-Za-z0-9_-]+$'
  ),
  constraint posts_period_shape check (usage_period is null or usage_period ~ '^\d{4}-(0[1-9]|1[0-2])$')
);

create unique index if not exists posts_workspace_idempotency_key
  on public.posts (workspace_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists posts_workspace_status_idx
  on public.posts (workspace_id, status);

create index if not exists posts_scheduled_due_idx
  on public.posts (scheduled_at)
  where status = 'scheduled';

create index if not exists posts_author_account_idx
  on public.posts (author_account_id);

create index if not exists posts_workspace_published_idx
  on public.posts (workspace_id, published_at desc)
  where status = 'published';

-- ---------------------------------------------------------------------------
-- media_assets: files staged in Supabase Storage before they are registered
-- with LinkedIn. Storage objects live in the private `post-media` bucket under
-- `<workspace_id>/<post_id>/<asset_id>.<ext>`.
-- ---------------------------------------------------------------------------
create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  post_id uuid references public.posts (id) on delete cascade,
  kind text not null,
  file_name text not null,
  mime_type text not null,
  byte_size bigint not null,
  checksum_sha256 text,
  storage_path text not null,
  -- Upload lifecycle: stored in our bucket → registered with LinkedIn → ready.
  upload_status text not null default 'stored',
  linkedin_asset_urn text,
  linkedin_upload_expires_at timestamptz,
  processing_error text,
  sort_order integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_assets_kind_valid check (kind in ('image', 'video', 'document')),
  constraint media_assets_status_valid check (
    upload_status in ('stored', 'registering', 'registered', 'ready', 'failed')
  ),
  constraint media_assets_size_valid check (byte_size > 0 and byte_size <= 524288000)
);

create index if not exists media_assets_post_idx on public.media_assets (post_id, sort_order);
create index if not exists media_assets_workspace_idx on public.media_assets (workspace_id);

-- ---------------------------------------------------------------------------
-- post_publish_attempts: one row per (post, attempt).
--
-- A retry must never be able to create a second LinkedIn post, so the publish
-- path inserts a row here *before* calling LinkedIn and records the returned
-- URN on it. The unique constraint is the database-level duplicate guard.
-- ---------------------------------------------------------------------------
create table if not exists public.post_publish_attempts (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  attempt integer not null,
  -- 'started' | 'succeeded' | 'failed' | 'skipped'
  outcome text not null default 'started',
  linkedin_post_urn text,
  error_code text,
  error_message text,
  -- True when the failure is transient (5xx, timeout, rate limit) and a retry
  -- is legitimate. False for permission/content errors, which need a human.
  retryable boolean not null default false,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint post_publish_attempts_outcome_valid check (
    outcome in ('started', 'succeeded', 'failed', 'skipped')
  ),
  constraint post_publish_attempts_attempt_positive check (attempt > 0)
);

create unique index if not exists post_publish_attempts_post_attempt_key
  on public.post_publish_attempts (post_id, attempt);

create index if not exists post_publish_attempts_post_idx
  on public.post_publish_attempts (post_id, started_at desc);

create trigger posts_set_updated_at
  before update on public.posts
  for each row execute function public.set_updated_at();

create trigger media_assets_set_updated_at
  before update on public.media_assets
  for each row execute function public.set_updated_at();
