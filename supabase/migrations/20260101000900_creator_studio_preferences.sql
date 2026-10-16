-- Zybble — Creator Studio preferences.
--
-- `/creator/settings` used to write into `learner_preferences`, which meant the
-- studio's settings page was really the learner's settings page wearing a
-- different hat: a daily *learning* goal and *study* reminders for somebody
-- configuring how they publish and get paid.
--
-- This table holds only studio concerns:
--   * which studio events email the creator,
--   * whether those events also raise an in-app notification,
--   * the defaults prefilled when the creator starts a new course.
--
-- Learner preferences stay exactly where they were, in `learner_preferences`,
-- and are still edited only from `/settings`.

create table if not exists public.creator_studio_preferences (
  user_id                 uuid primary key references public.profiles (id) on delete cascade,

  -- Studio notifications
  email_new_enrollment    boolean not null default true,
  email_new_review        boolean not null default true,
  email_moderation        boolean not null default true,
  email_payout_updates    boolean not null default true,
  notify_in_app           boolean not null default true,

  -- Defaults for a new course
  default_course_language text not null default 'English',
  default_course_level    text not null default 'beginner'
                            check (default_course_level in ('beginner', 'intermediate', 'advanced')),
  default_price_paise     bigint not null default 0 check (default_price_paise >= 0),

  updated_at              timestamptz not null default now()
);

comment on table public.creator_studio_preferences is
  'Per-creator studio settings: notification channels and new-course defaults. Learner preferences are not stored here.';

alter table public.creator_studio_preferences enable row level security;

revoke all on public.creator_studio_preferences from anon;
grant select, insert, update on public.creator_studio_preferences to authenticated;

drop policy if exists creator_studio_preferences_own on public.creator_studio_preferences;
create policy creator_studio_preferences_own on public.creator_studio_preferences
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- An admin may read any creator's studio preferences while moderating.
drop policy if exists creator_studio_preferences_admin_read on public.creator_studio_preferences;
create policy creator_studio_preferences_admin_read on public.creator_studio_preferences
  for select to authenticated
  using (public.is_admin());

drop trigger if exists creator_studio_preferences_touch on public.creator_studio_preferences;
create trigger creator_studio_preferences_touch
  before update on public.creator_studio_preferences
  for each row execute function public.touch_updated_at();
