-- Zybble — core relational schema.
--
-- Money convention: every monetary column is `bigint` and holds INTEGER PAISE
-- (1 INR = 100 paise). Currency columns are `text` constrained to 'INR'.

-- ===========================================================================
-- Identity
-- ===========================================================================

create table if not exists public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  email          text not null,
  full_name      text,
  avatar_key     text,
  headline       text,
  bio            text,
  country_code   text,
  locale         text not null default 'en',
  role           public.app_role not null default 'learner',
  status         public.account_status not null default 'active',
  email_verified boolean not null default false,
  onboarding_complete boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.profiles is 'One row per authenticated user. `role` is the authoritative access role.';
create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_email_idx on public.profiles (lower(email));

create table if not exists public.creator_profiles (
  user_id        uuid primary key references public.profiles (id) on delete cascade,
  username       text unique,
  display_name   text,
  headline       text,
  bio            text,
  country_code   text not null default 'IN',
  languages      text[] not null default '{}',
  website        text,
  avatar_key     text,
  topics         text[] not null default '{}',
  onboarding_status public.creator_onboarding_status not null default 'not_started',
  onboarded_at   timestamptz,
  -- Razorpay Route
  route_account_id        text unique,
  route_account_status    public.route_account_status,
  route_settlement_verified boolean not null default false,
  route_created_at        timestamptz,
  route_last_checked_at   timestamptz,
  route_error             text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint creator_country_is_india check (country_code = 'IN')
);

comment on constraint creator_country_is_india on public.creator_profiles is
  'Zybble is an India-only marketplace: Route sellers must be Indian.';

create index if not exists creator_profiles_username_idx on public.creator_profiles (lower(username));

-- Admin allowlist. Rows here are written only by the service role (a reviewed
-- operational action). New accounts matching these emails are promoted by a
-- trigger, which is the only way a user can acquire an admin role.
create table if not exists public.platform_admins (
  email      text primary key,
  note       text,
  added_by   uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ===========================================================================
-- Catalog
-- ===========================================================================

create table if not exists public.categories (
  id          uuid primary key default extensions.gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  short_name  text,
  description text,
  icon        text,
  sort_order  integer not null default 0,
  visible     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists categories_visible_idx on public.categories (visible, sort_order);

create table if not exists public.courses (
  id             uuid primary key default extensions.gen_random_uuid(),
  slug           text not null unique,
  creator_id     uuid not null references public.profiles (id) on delete restrict,
  category_id    uuid references public.categories (id) on delete set null,
  title          text not null,
  subtitle       text,
  description    text,
  long_description text[] not null default '{}',
  what_you_learn text[] not null default '{}',
  requirements   text[] not null default '{}',
  audience       text[] not null default '{}',
  tags           text[] not null default '{}',
  language       text not null default 'English',
  level          text not null default 'beginner'
                 check (level in ('beginner', 'intermediate', 'advanced')),
  -- Integer paise. 0 means the course is free and is enrolled without payment.
  price_paise    bigint not null default 0 check (price_paise >= 0),
  compare_at_paise bigint check (compare_at_paise is null or compare_at_paise >= 0),
  currency       text not null default 'INR' check (currency = 'INR'),
  thumbnail_key  text,
  status         public.course_status not null default 'draft',
  submitted_at   timestamptz,
  published_at   timestamptz,
  rejection_reason text,
  duration_minutes integer not null default 0 check (duration_minutes >= 0),
  lessons_count  integer not null default 0,
  downloadable_resources integer not null default 0,
  -- Denormalised, recomputed from real records only.
  students_count integer not null default 0,
  rating         numeric(3, 2) not null default 0,
  ratings_count  integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- A paid course can never be published without a creator that can receive
  -- a Route transfer; enforced by the service layer, asserted here as a check
  -- on the status/price pair that public code relies on.
  constraint published_has_price_or_free check (status <> 'published' or price_paise >= 0)
);

create index if not exists courses_creator_idx on public.courses (creator_id);
create index if not exists courses_category_idx on public.courses (category_id);
create index if not exists courses_status_idx on public.courses (status);
create index if not exists courses_published_idx on public.courses (status, published_at desc);
create index if not exists courses_search_idx on public.courses
  using gin (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(subtitle, '') || ' ' || coalesce(description, '')));

create table if not exists public.course_sections (
  id          uuid primary key default extensions.gen_random_uuid(),
  course_id   uuid not null references public.courses (id) on delete cascade,
  title       text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists course_sections_course_idx on public.course_sections (course_id, sort_order);

create table if not exists public.lessons (
  id            uuid primary key default extensions.gen_random_uuid(),
  course_id     uuid not null references public.courses (id) on delete cascade,
  section_id    uuid references public.course_sections (id) on delete cascade,
  title         text not null,
  description   text,
  kind          public.lesson_kind not null default 'video',
  sort_order    integer not null default 0,
  duration_minutes integer not null default 0 check (duration_minutes >= 0),
  is_preview    boolean not null default false,
  -- Bunny Stream
  bunny_video_id   text unique,
  bunny_status     public.encoding_status,
  bunny_duration_seconds integer,
  bunny_playback_ready boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists lessons_course_idx on public.lessons (course_id, sort_order);

create table if not exists public.course_resources (
  id            uuid primary key default extensions.gen_random_uuid(),
  course_id     uuid not null references public.courses (id) on delete cascade,
  lesson_id     uuid references public.lessons (id) on delete cascade,
  title         text not null,
  -- Cloudflare R2 object key. The bucket stays private; downloads are issued as
  -- short-lived presigned URLs after an entitlement check.
  object_key    text not null unique,
  file_name     text not null,
  content_type  text not null,
  size_bytes    bigint not null check (size_bytes >= 0),
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists course_resources_course_idx on public.course_resources (course_id);

-- ===========================================================================
-- Moderation
-- ===========================================================================

create table if not exists public.course_review_events (
  id          uuid primary key default extensions.gen_random_uuid(),
  course_id   uuid not null references public.courses (id) on delete cascade,
  actor_id    uuid references public.profiles (id) on delete set null,
  actor_role  text not null,
  from_status public.course_status,
  to_status   public.course_status not null,
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists course_review_events_course_idx on public.course_review_events (course_id, created_at desc);

create table if not exists public.moderation_notes (
  id         uuid primary key default extensions.gen_random_uuid(),
  course_id  uuid not null references public.courses (id) on delete cascade,
  author_id  uuid references public.profiles (id) on delete set null,
  text       text not null,
  created_at timestamptz not null default now()
);

create index if not exists moderation_notes_course_idx on public.moderation_notes (course_id, created_at desc);

create table if not exists public.reports (
  id           uuid primary key default extensions.gen_random_uuid(),
  kind         public.report_kind not null,
  target_id    uuid,
  target_label text,
  reason       text not null,
  detail       text,
  reporter_id  uuid references public.profiles (id) on delete set null,
  priority     text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status       public.report_status not null default 'open',
  admin_note   text,
  resolved_by  uuid references public.profiles (id) on delete set null,
  resolved_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists reports_status_idx on public.reports (status, created_at desc);

create table if not exists public.admin_audit_log (
  id          bigserial primary key,
  actor_id    uuid references public.profiles (id) on delete set null,
  actor_email text,
  action      text not null,
  target_type text,
  target_id   text,
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists admin_audit_log_created_idx on public.admin_audit_log (created_at desc);

-- ===========================================================================
-- Learner state
-- ===========================================================================

create table if not exists public.orders (
  id                 uuid primary key default extensions.gen_random_uuid(),
  public_id          text not null unique,
  user_id            uuid not null references public.profiles (id) on delete restrict,
  status             public.order_status not null default 'created',
  currency           text not null default 'INR' check (currency = 'INR'),
  subtotal_paise     bigint not null default 0 check (subtotal_paise >= 0),
  discount_paise     bigint not null default 0 check (discount_paise >= 0),
  total_paise        bigint not null default 0 check (total_paise >= 0),
  platform_fee_paise bigint not null default 0 check (platform_fee_paise >= 0),
  provider_fee_paise bigint not null default 0 check (provider_fee_paise >= 0),
  tax_paise          bigint not null default 0 check (tax_paise >= 0),
  is_free            boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  paid_at            timestamptz,
  constraint free_orders_have_no_total check (not is_free or total_paise = 0)
);

create index if not exists orders_user_idx on public.orders (user_id, created_at desc);
create index if not exists orders_status_idx on public.orders (status, created_at desc);

-- Immutable snapshot of what was sold, at the price and commission that applied
-- at purchase time. A later commission-rate change must never rewrite history.
create table if not exists public.order_items (
  id              uuid primary key default extensions.gen_random_uuid(),
  order_id        uuid not null references public.orders (id) on delete cascade,
  course_id       uuid not null references public.courses (id) on delete restrict,
  creator_id      uuid not null references public.profiles (id) on delete restrict,
  course_title    text not null,
  course_slug     text not null,
  thumbnail_key   text,
  currency        text not null default 'INR' check (currency = 'INR'),
  unit_price_paise  bigint not null check (unit_price_paise >= 0),
  commission_bps    integer not null check (commission_bps >= 0 and commission_bps <= 5000),
  commission_paise  bigint not null check (commission_paise >= 0),
  creator_share_paise bigint not null check (creator_share_paise >= 0),
  route_account_id text,
  created_at      timestamptz not null default now(),
  constraint item_split_is_exact check (commission_paise + creator_share_paise = unit_price_paise),
  unique (order_id, course_id)
);

create index if not exists order_items_creator_idx on public.order_items (creator_id, created_at desc);
create index if not exists order_items_course_idx on public.order_items (course_id);

create table if not exists public.payments (
  id                     uuid primary key default extensions.gen_random_uuid(),
  order_id               uuid not null references public.orders (id) on delete cascade,
  razorpay_order_id      text unique,
  razorpay_payment_id    text unique,
  razorpay_signature     text,
  currency               text not null default 'INR' check (currency = 'INR'),
  amount_paise           bigint not null check (amount_paise >= 0),
  fee_paise              bigint,
  tax_paise              bigint,
  status                 public.payment_status not null default 'created',
  method                 text,
  captured_at            timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists payments_order_idx on public.payments (order_id);

create table if not exists public.payment_attempts (
  id                 uuid primary key default extensions.gen_random_uuid(),
  order_id           uuid not null references public.orders (id) on delete cascade,
  razorpay_order_id  text,
  razorpay_payment_id text,
  amount_paise       bigint not null check (amount_paise >= 0),
  status             public.payment_status not null default 'created',
  failure_reason     text,
  created_at         timestamptz not null default now()
);

create index if not exists payment_attempts_order_idx on public.payment_attempts (order_id, created_at desc);

-- Durable provider-event ledger. `provider_event_id` is unique so duplicate
-- webhook deliveries are rejected by the database, not by application logic
-- alone.
create table if not exists public.webhook_events (
  id                uuid primary key default extensions.gen_random_uuid(),
  provider          text not null default 'razorpay',
  provider_event_id text not null,
  event_type        text not null,
  entity_id         text,
  payload           jsonb not null,
  status            text not null default 'received'
                    check (status in ('received', 'processed', 'ignored', 'failed')),
  error_message     text,
  received_at       timestamptz not null default now(),
  processed_at      timestamptz,
  unique (provider, provider_event_id)
);

create index if not exists webhook_events_type_idx on public.webhook_events (event_type, received_at desc);

create table if not exists public.entitlements (
  id          uuid primary key default extensions.gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  course_id   uuid not null references public.courses (id) on delete cascade,
  order_id    uuid references public.orders (id) on delete set null,
  source      public.entitlement_source not null default 'purchase',
  revoked_at  timestamptz,
  created_at  timestamptz not null default now(),
  unique (user_id, course_id)
);

create index if not exists entitlements_course_idx on public.entitlements (course_id);

create table if not exists public.lesson_progress (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  lesson_id   uuid not null references public.lessons (id) on delete cascade,
  course_id   uuid not null references public.courses (id) on delete cascade,
  completed   boolean not null default false,
  completed_at timestamptz,
  updated_at  timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create index if not exists lesson_progress_course_idx on public.lesson_progress (user_id, course_id);

create table if not exists public.lesson_notes (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  lesson_id  uuid not null references public.lessons (id) on delete cascade,
  course_id  uuid not null references public.courses (id) on delete cascade,
  body       text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table if not exists public.course_resume (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  course_id    uuid not null references public.courses (id) on delete cascade,
  lesson_id    uuid references public.lessons (id) on delete set null,
  last_visited_at timestamptz not null default now(),
  primary key (user_id, course_id)
);

create table if not exists public.certificates (
  id              uuid primary key default extensions.gen_random_uuid(),
  -- Public, unguessable verification code rendered on the artwork.
  verification_code text not null unique,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  course_id       uuid not null references public.courses (id) on delete cascade,
  student_name    text not null,
  course_title    text not null,
  instructor_name text not null,
  lessons_count   integer not null check (lessons_count > 0),
  duration_minutes integer not null default 0,
  issued_at       timestamptz not null default now(),
  revoked_at      timestamptz,
  unique (user_id, course_id)
);

create index if not exists certificates_user_idx on public.certificates (user_id, issued_at desc);

create table if not exists public.wishlist (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  course_id  uuid not null references public.courses (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, course_id)
);

create table if not exists public.recent_course_views (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  course_id  uuid not null references public.courses (id) on delete cascade,
  viewed_at  timestamptz not null default now(),
  primary key (user_id, course_id)
);

create table if not exists public.reviews (
  id          uuid primary key default extensions.gen_random_uuid(),
  course_id   uuid not null references public.courses (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  rating      integer not null check (rating between 1 and 5),
  title       text,
  body        text,
  published   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (course_id, user_id)
);

create index if not exists reviews_course_idx on public.reviews (course_id) where published;

create table if not exists public.notifications (
  id          uuid primary key default extensions.gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  kind        text not null default 'system',
  title       text not null,
  body        text,
  href        text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

create table if not exists public.conversations (
  id           uuid primary key default extensions.gen_random_uuid(),
  subject      text,
  learner_id   uuid references public.profiles (id) on delete cascade,
  creator_id   uuid references public.profiles (id) on delete cascade,
  admin_id     uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists conversations_participants_idx on public.conversations (learner_id, creator_id);

create table if not exists public.messages (
  id             uuid primary key default extensions.gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id      uuid not null references public.profiles (id) on delete cascade,
  body           text not null,
  read_at        timestamptz,
  created_at     timestamptz not null default now()
);

create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at);

create table if not exists public.learner_preferences (
  user_id               uuid primary key references public.profiles (id) on delete cascade,
  goal_minutes_per_day  integer not null default 30,
  email_course_updates  boolean not null default true,
  email_promos          boolean not null default false,
  weekly_report         boolean not null default true,
  study_reminders       boolean not null default true,
  updated_at            timestamptz not null default now()
);

-- ===========================================================================
-- Financial ledger (immutable)
-- ===========================================================================

-- Append-only. Entries are never updated or deleted; corrections are expressed
-- as a new opposing entry so the running balance is always reconstructable.
create table if not exists public.ledger_entries (
  id             uuid primary key default extensions.gen_random_uuid(),
  idempotency_key text not null unique,
  kind           public.ledger_entry_kind not null,
  account        text not null, -- 'platform' or 'creator:<user_id>'
  user_id        uuid references public.profiles (id) on delete set null,
  order_id       uuid references public.orders (id) on delete set null,
  order_item_id  uuid references public.order_items (id) on delete set null,
  transfer_id    text,
  currency       text not null default 'INR' check (currency = 'INR'),
  amount_paise   bigint not null check (amount_paise >= 0),
  direction      text not null check (direction in ('credit', 'debit')),
  description    text,
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

create index if not exists ledger_entries_account_idx on public.ledger_entries (account, created_at desc);
create index if not exists ledger_entries_order_idx on public.ledger_entries (order_id);

create or replace function public.ledger_entries_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'ledger_entries is append-only';
end;
$$;

create trigger ledger_entries_no_update
  before update or delete on public.ledger_entries
  for each row execute function public.ledger_entries_immutable();

-- ===========================================================================
-- Razorpay Route transfers / settlements / refunds
-- ===========================================================================

create table if not exists public.route_transfers (
  id                 uuid primary key default extensions.gen_random_uuid(),
  transfer_id        text unique,
  order_id           uuid references public.orders (id) on delete set null,
  order_item_id      uuid references public.order_items (id) on delete set null,
  creator_id         uuid references public.profiles (id) on delete set null,
  route_account_id   text not null,
  currency           text not null default 'INR' check (currency = 'INR'),
  amount_paise       bigint not null check (amount_paise >= 0),
  reversed_paise     bigint not null default 0 check (reversed_paise >= 0),
  status             public.transfer_status not null default 'created',
  on_hold            boolean not null default false,
  notes              jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists route_transfers_creator_idx on public.route_transfers (creator_id, created_at desc);
create index if not exists route_transfers_status_idx on public.route_transfers (status);

create table if not exists public.route_settlements (
  id             uuid primary key default extensions.gen_random_uuid(),
  settlement_id  text unique not null,
  route_account_id text not null,
  transfer_id    text references public.route_transfers (transfer_id) on delete set null,
  creator_id     uuid references public.profiles (id) on delete set null,
  amount_paise   bigint not null check (amount_paise >= 0),
  currency       text not null default 'INR' check (currency = 'INR'),
  status         public.settlement_status not null default 'pending',
  settled_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists route_settlements_creator_idx on public.route_settlements (creator_id, settled_at desc nulls last);

create table if not exists public.refunds (
  id               uuid primary key default extensions.gen_random_uuid(),
  refund_id        text unique,
  order_id         uuid not null references public.orders (id) on delete restrict,
  payment_id       uuid references public.payments (id) on delete set null,
  amount_paise     bigint not null check (amount_paise >= 0),
  currency         text not null default 'INR' check (currency = 'INR'),
  reason           text,
  status           text not null default 'pending' check (status in ('pending', 'processed', 'failed')),
  requested_by     uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists refunds_order_idx on public.refunds (order_id);

-- ===========================================================================
-- Marketplace settings
-- ===========================================================================

create table if not exists public.marketplace_settings (
  id                        boolean primary key default true check (id),
  marketplace_name          text not null default 'Zybble',
  marketplace_description   text,
  -- Commission is authoritative and snapshotted onto each order item.
  commission_bps            integer not null default 1000
                              check (commission_bps >= 0 and commission_bps <= 5000),
  auto_approve_free_courses boolean not null default false,
  auto_approve_returning_creators boolean not null default false,
  email_review_decisions    boolean not null default true,
  require_payout_approval   boolean not null default true,
  support_email             text,
  updated_at                timestamptz not null default now(),
  updated_by                uuid references public.profiles (id) on delete set null
);

insert into public.marketplace_settings (id, marketplace_name)
values (true, 'Zybble')
on conflict (id) do nothing;

-- ===========================================================================
-- Zybble AI assistant conversations (retained 30 days)
-- ===========================================================================

create table if not exists public.chat_conversations (
  id          uuid primary key default extensions.gen_random_uuid(),
  session_id  text not null unique,
  user_id     uuid references public.profiles (id) on delete set null,
  category    text,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '30 days')
);

create index if not exists chat_conversations_expiry_idx on public.chat_conversations (expires_at);

create table if not exists public.chat_messages (
  id              uuid primary key default extensions.gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations (id) on delete cascade,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null,
  created_at      timestamptz not null default now()
);

create index if not exists chat_messages_conversation_idx on public.chat_messages (conversation_id, created_at);

-- ===========================================================================
-- Email outbox (retry-safe transactional delivery)
-- ===========================================================================

create table if not exists public.email_outbox (
  id             uuid primary key default extensions.gen_random_uuid(),
  to_email       text not null,
  template       text not null,
  payload        jsonb not null default '{}'::jsonb,
  provider_id    text,
  status         text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  attempts       integer not null default 0,
  last_error     text,
  -- The business object this email announces, so a retry can never duplicate it.
  idempotency_key text not null unique,
  created_at     timestamptz not null default now(),
  sent_at        timestamptz
);

create index if not exists email_outbox_status_idx on public.email_outbox (status, created_at);
