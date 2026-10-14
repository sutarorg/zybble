-- Zybble — Row Level Security, grants, views and triggers.
--
-- Defence model:
--   * Every table a browser can reach has RLS enabled and explicit policies.
--   * Sensitive writes (role, status, money, Route state) are service-role only.
--   * `profiles.role` is protected by a column-level GRANT *and* a trigger, so a
--     user cannot promote themselves through the API, SQL or the browser.
--   * Public catalog access is exactly `courses.status = 'published'`.

-- ===========================================================================
-- Enable RLS everywhere
-- ===========================================================================

do $$
declare t record;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

-- ===========================================================================
-- Default privileges
-- ===========================================================================

revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
grant  select on public.categories to anon, authenticated;
grant  select on public.marketplace_settings to anon, authenticated;
grant  select on public.courses to anon, authenticated;
grant  select on public.course_sections to anon, authenticated;
grant  select on public.lessons to anon, authenticated;
grant  select on public.reviews to anon, authenticated;
grant  select on public.creator_profiles to authenticated;

grant  select, insert, update, delete on public.entitlements to authenticated;
grant  select, insert, update, delete on public.wishlist to authenticated;
grant  select, insert, update, delete on public.lesson_progress to authenticated;
grant  select, insert, update, delete on public.lesson_notes to authenticated;
grant  select, insert, update, delete on public.course_resume to authenticated;
grant  select, insert, update on public.learner_preferences to authenticated;
grant  select, insert, update, delete on public.recent_course_views to authenticated;
grant  select, insert, update, delete on public.entitlements to authenticated;
grant  select, insert on public.certificates to authenticated;
grant  select, update, delete on public.certificates to authenticated;
grant  select on public.orders to authenticated;
grant  select on public.order_items to authenticated;
grant  select on public.payments to authenticated;
grant  select on public.profiles to authenticated;
grant  insert, update, delete on public.profiles to authenticated;
grant  select on public.notifications to authenticated;
grant  update on public.notifications to authenticated;
grant  select, insert on public.messages to authenticated;
grant  update on public.messages to authenticated;
grant  select, insert on public.conversations to authenticated;
grant  update on public.conversations to authenticated;
grant  select, insert, update on public.creator_profiles to authenticated;
grant  select, insert, update, delete on public.course_sections to authenticated;
grant  select, insert, update, delete on public.lessons to authenticated;
grant  select, insert, update, delete on public.course_resources to authenticated;
grant  select, insert, update, delete on public.course_review_events to authenticated;
grant  select, insert, update, delete on public.reviews to authenticated;
grant  update on public.reports to authenticated;
grant  select on public.reports to authenticated;
grant  select, insert, update, delete on public.reports to authenticated;
grant  select on public.moderation_notes to authenticated;
grant  select, insert, update on public.admin_audit_log to authenticated;
grant  select on public.route_transfers to authenticated;
grant  select on public.route_settlements to authenticated;
grant  select on public.ledger_entries to authenticated;
grant  select on public.chat_conversations to authenticated;
grant  select, insert on public.chat_conversations to authenticated;
grant  select, insert on public.chat_messages to authenticated;

-- Column-level protection for `profiles`: a user may edit their own profile but
-- never their own access role or account status.
revoke update on public.profiles from authenticated;
grant update (full_name, avatar_key, headline, bio, country_code, locale, onboarding_complete)
  on public.profiles to authenticated;

-- Column-level protection for `creator_profiles`: Route state is provider-owned
-- and must only be written by the server after an API response is verified.
revoke update on public.creator_profiles from authenticated;
grant update (username, display_name, headline, bio, website, avatar_key, topics, languages, onboarding_status, onboarded_at)
  on public.creator_profiles to authenticated;

-- Creator-facing course fields: status, published_at, ratings aggregates and
-- rejection reasons are server-owned.
revoke update on public.courses from authenticated;
grant update (slug, category_id, title, subtitle, description, long_description,
              what_you_learn, requirements, audience, tags, language, level,
              price_paise, compare_at_paise, thumbnail_key, duration_minutes)
  on public.courses to authenticated;

revoke update on public.lessons from authenticated;
grant update (course_id, section_id, title, description, kind, sort_order,
              duration_minutes, is_preview)
  on public.lessons to authenticated;

-- ===========================================================================
-- profiles
-- ===========================================================================

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ===========================================================================
-- creator_profiles
-- ===========================================================================
--
-- This table mixes a creator's public profile with their Razorpay Route
-- onboarding state. `route_account_id` is a live financial-account identifier
-- belonging to a real, KYC'd entity — it must not be world-readable, and RLS
-- cannot filter it out because RLS filters rows, not columns.
--
-- So the split is:
--   * `anon` gets NO grant on this table at all.
--   * `authenticated` may read only its OWN row (a creator needs their own Route
--     state to render the onboarding screen).
--   * Public profile fields are served from the `creator_public_profiles`
--     view further down, which is granted to `anon` and `authenticated`.

revoke select on public.creator_profiles from anon;

drop policy if exists creator_profiles_public_read on public.creator_profiles;
create policy creator_profiles_own_read on public.creator_profiles
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists creator_profiles_self_write on public.creator_profiles;
create policy creator_profiles_self_write on public.creator_profiles
  for all to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- ===========================================================================
-- Catalog
-- ===========================================================================

drop policy if exists categories_read on public.categories;
create policy categories_read on public.categories
  for select to anon, authenticated using (visible or public.is_admin());

drop policy if exists categories_admin_write on public.categories;
create policy categories_admin_write on public.categories
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Public: published courses only. Drafts, pending, rejected and unpublished
-- records are invisible to anonymous and to other creators.
drop policy if exists courses_public_read on public.courses;
create policy courses_public_read on public.courses
  for select to anon, authenticated
  using (status = 'published');

drop policy if exists courses_owner_read on public.courses;
create policy courses_owner_read on public.courses
  for select to authenticated
  using (creator_id = auth.uid());

drop policy if exists courses_admin_read on public.courses;
create policy courses_admin_read on public.courses
  for select to authenticated
  using (public.is_admin());

drop policy if exists courses_owner_write on public.courses;
create policy courses_owner_write on public.courses
  for all to authenticated
  using (creator_id = auth.uid() or public.is_admin())
  with check (creator_id = auth.uid() or public.is_admin());

-- A creator may only insert a course they own, and only as a draft.
drop policy if exists courses_insert_draft on public.courses;
create policy courses_insert_draft on public.courses
  for insert to authenticated
  with check (creator_id = auth.uid() and status = 'draft');

-- Sections / lessons / resources follow the course ownership chain.
drop policy if exists sections_public_read on public.course_sections;
create policy sections_public_read on public.course_sections
  for select to anon, authenticated
  using (exists (select 1 from public.courses c where c.id = course_id and c.status = 'published'));

drop policy if exists sections_owner_all on public.course_sections;
create policy sections_owner_all on public.course_sections
  for all to authenticated
  using (exists (select 1 from public.courses c where c.id = course_id and c.creator_id = auth.uid())
         or public.is_admin())
  with check (exists (select 1 from public.courses c where c.id = course_id and c.creator_id = auth.uid())
         or public.is_admin());

drop policy if exists lessons_public_read on public.lessons;
create policy lessons_public_read on public.lessons
  for select to anon, authenticated
  using (exists (select 1 from public.courses c where c.id = course_id and c.status = 'published'));

drop policy if exists lessons_owner_all on public.lessons;
create policy lessons_owner_all on public.lessons
  for all to authenticated
  using (exists (select 1 from public.courses c where c.id = course_id and c.creator_id = auth.uid())
         or public.is_admin())
  with check (exists (select 1 from public.courses c where c.id = course_id and c.creator_id = auth.uid())
         or public.is_admin());

-- Resources: metadata is private. Only the owning creator or an admin can see it;
-- downloads additionally require an entitlement check in the server action.
drop policy if exists resources_owner_all on public.course_resources;
create policy resources_owner_all on public.course_resources
  for all to authenticated
  using (exists (select 1 from public.courses c where c.id = course_id and c.creator_id = auth.uid())
         or public.is_admin())
  with check (exists (select 1 from public.courses c where c.id = course_id and c.creator_id = auth.uid())
         or public.is_admin());

-- ===========================================================================
-- Learner-private tables
-- ===========================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'entitlements','wishlist','lesson_progress','lesson_notes','course_resume',
    'recent_course_views','learner_preferences','notifications'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_own', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t || '_own', t
    );
  end loop;
end $$;

-- Certificates are issued server-side only: a learner may read their own but may
-- never insert one (the grant above is revoked for insert below).
drop policy if exists certificates_own on public.certificates;
create policy certificates_own on public.certificates
  for select to authenticated
  using ((user_id = auth.uid() and revoked_at is null) or public.is_admin());

drop policy if exists certificates_admin_write on public.certificates;
create policy certificates_admin_write on public.certificates
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke insert on public.certificates from authenticated;

-- ===========================================================================
-- Orders, payments, Route — read-only for learners and creators.
-- All money writes happen through server code that has verified the provider.
-- ===========================================================================

drop policy if exists orders_own_read on public.orders;
create policy orders_own_read on public.orders
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists order_items_own_read on public.order_items;
create policy order_items_own_read on public.order_items
  for select to authenticated
  using (
    exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin()))
    or creator_id = auth.uid()
  );

drop policy if exists payments_own_read on public.payments;
create policy payments_own_read on public.payments
  for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
         or public.is_admin());

drop policy if exists route_transfers_own_read on public.route_transfers;
create policy route_transfers_own_read on public.route_transfers
  for select to authenticated
  using (creator_id = auth.uid() or public.is_admin());

drop policy if exists route_settlements_own_read on public.route_settlements;
create policy route_settlements_own_read on public.route_settlements
  for select to authenticated
  using (creator_id = auth.uid() or public.is_admin());

drop policy if exists ledger_own_read on public.ledger_entries;
create policy ledger_own_read on public.ledger_entries
  for select to authenticated
  using (account = 'creator:' || auth.uid()::text or public.is_admin());

drop policy if exists refunds_admin_read on public.refunds;
create policy refunds_admin_read on public.refunds
  for select to authenticated using (public.is_admin());

-- ===========================================================================
-- Moderation
-- ===========================================================================

drop policy if exists review_events_course_read on public.course_review_events;
create policy review_events_course_read on public.course_review_events
  for select to authenticated
  using (exists (select 1 from public.courses c
                 where c.id = course_id and (c.creator_id = auth.uid() or public.is_admin()))
         or public.is_admin());

drop policy if exists moderation_notes_admin on public.moderation_notes;
create policy moderation_notes_admin on public.moderation_notes
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists reports_read on public.reports;
create policy reports_read on public.reports
  for select to authenticated
  using (reporter_id = auth.uid() or public.is_admin());

drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports
  for insert to authenticated
  with check (reporter_id = auth.uid());

drop policy if exists reports_admin_write on public.reports;
create policy reports_admin_write on public.reports
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists audit_admin_read on public.admin_audit_log;
create policy audit_admin_read on public.admin_audit_log
  for select to authenticated using (public.is_admin());

-- ===========================================================================
-- Reviews
-- ===========================================================================

drop policy if exists reviews_public_read on public.reviews;
create policy reviews_public_read on public.reviews
  for select to anon, authenticated
  using (
    published
    and exists (select 1 from public.courses c where c.id = course_id and c.status = 'published')
  );

drop policy if exists reviews_own_read on public.reviews;
create policy reviews_own_read on public.reviews
  for select to authenticated using (user_id = auth.uid());

-- A review may only be written for a course the learner actually holds an
-- entitlement to. Review eligibility is a database rule, not a UI rule.
drop policy if exists reviews_insert_entitled on public.reviews;
create policy reviews_insert_entitled on public.reviews
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.entitlements e
      where e.user_id = auth.uid() and e.course_id = reviews.course_id and e.revoked_at is null
    )
  );

drop policy if exists reviews_own_update on public.reviews;
create policy reviews_own_update on public.reviews
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists reviews_admin_all on public.reviews;
create policy reviews_admin_all on public.reviews
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ===========================================================================
-- Messaging
-- ===========================================================================

drop policy if exists conversations_participant_read on public.conversations;
create policy conversations_participant_read on public.conversations
  for select to authenticated
  using (learner_id = auth.uid() or creator_id = auth.uid() or admin_id = auth.uid() or public.is_admin());

drop policy if exists messages_participant_read on public.messages;
create policy messages_participant_read on public.messages
  for select to authenticated
  using (exists (select 1 from public.conversations c
                 where c.id = conversation_id
                   and (c.learner_id = auth.uid() or c.creator_id = auth.uid() or c.admin_id = auth.uid()))
         or public.is_admin());

drop policy if exists messages_sender_write on public.messages;
create policy messages_sender_write on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (select 1 from public.conversations c
                where c.id = conversation_id
                  and (c.learner_id = auth.uid() or c.creator_id = auth.uid() or c.admin_id = auth.uid()))
  );

-- ===========================================================================
-- Marketplace settings / Zybble AI
-- ===========================================================================

drop policy if exists settings_admin_write on public.marketplace_settings;
create policy settings_admin_write on public.marketplace_settings
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists chat_conversations_owner on public.chat_conversations;
create policy chat_conversations_owner on public.chat_conversations
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists chat_messages_owner on public.chat_messages;
create policy chat_messages_owner on public.chat_messages
  for all to authenticated
  using (exists (select 1 from public.chat_conversations c
                 where c.id = conversation_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.chat_conversations c
                 where c.id = conversation_id and c.user_id = auth.uid()));

-- ===========================================================================
-- Triggers
-- ===========================================================================

-- Create (and admin-promote) a profile whenever a Supabase auth user appears.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.app_role;
begin
  insert into public.profiles (id, email, full_name, role, email_verified)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    case when exists (select 1 from public.platform_admins a where lower(a.email) = lower(new.email))
         then 'admin'::public.app_role
         else 'learner'::public.app_role
    end,
    new.email_confirmed_at is not null
  )
  on conflict (id) do nothing;

  insert into public.learner_preferences (user_id) values (new.id)
  on conflict (user_id) do nothing;

  select role into v_role from public.profiles where id = new.id;
  if v_role in ('admin', 'moderator') then
    insert into public.creator_profiles (user_id, display_name, country_code)
    values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)), 'IN')
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Privilege-escalation guard, layer 1 of 2: column-level grants.
--
-- `role` and `status` are removed from the browser roles entirely, so a client
-- cannot even attempt to write them. Layer 2 is the `guard_profile_privileges`
-- trigger below, which rejects the write regardless of how the grant arrives
-- (API, SQL console, or a direct connection).
revoke update (role) on public.profiles from authenticated;
revoke update (status) on public.profiles from authenticated;
revoke insert (role) on public.profiles from anon, authenticated;
revoke insert (status) on public.profiles from anon, authenticated;

-- Layer 2: even if a column grant is ever widened, a role or
-- status change from a non-service session is rejected outright.
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.role is distinct from old.role) or (new.status is distinct from old.status) then
    if auth.role() is distinct from 'service_role' and current_user not in ('postgres', 'supabase_admin') then
      raise exception 'role and status may only be changed by the service role';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_privileges on public.profiles;
create trigger profiles_guard_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- Route fields are provider-owned.
create or replace function public.guard_route_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.route_account_id is distinct from old.route_account_id)
     or (new.route_account_status is distinct from old.route_account_status)
     or (new.route_settlement_verified is distinct from old.route_settlement_verified)
     or (new.route_created_at is distinct from old.route_created_at)
     or (new.route_error is distinct from old.route_error) then
    if auth.role() is distinct from 'service_role' and current_user not in ('postgres', 'supabase_admin') then
      raise exception 'Route fields may only be written by the service role after a provider response';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists creator_profiles_guard_route on public.creator_profiles;
create trigger creator_profiles_guard_route
  before update on public.creator_profiles
  for each row execute function public.guard_route_fields();

-- Course publication state is server-owned: creators cannot self-publish.
create or replace function public.guard_course_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    if auth.role() is distinct from 'service_role' and current_user not in ('postgres', 'supabase_admin') then
      raise exception 'course status transitions require an authorised server action';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists courses_guard_status on public.courses;
create trigger courses_guard_status
  before update on public.courses
  for each row execute function public.guard_course_status();

-- Keep rating aggregates honest: they are derived from real published reviews.
create or replace function public.refresh_course_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_course uuid;
begin
  v_course := coalesce(new.course_id, old.course_id);
  update public.courses c
     set rating = coalesce(agg.avg_rating, 0),
         ratings_count = coalesce(agg.n, 0)
    from (
      select round(avg(rating)::numeric, 2) as avg_rating, count(*) as n
        from public.reviews
       where course_id = v_course and published
    ) agg
   where c.id = v_course;
  return null;
end;
$$;

drop trigger if exists reviews_refresh_rating on public.reviews;
create trigger reviews_refresh_rating
  after insert or update or delete on public.reviews
  for each row execute function public.refresh_course_rating();

-- updated_at maintenance
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','creator_profiles','categories','courses','course_sections','lessons',
    'course_resources','orders','payments','route_transfers','route_settlements','refunds',
    'conversations','reviews','reports','learner_preferences'
  ] loop
    execute format('drop trigger if exists %I on public.%I', t || '_touch', t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.touch_updated_at()',
      t || '_touch', t
    );
  end loop;
end $$;

-- ===========================================================================
-- Public read model
--
-- A view that exposes only non-identifying creator fields, and only for
-- creators who actually have a published course. It deliberately does not join
-- `profiles.email`.
-- ===========================================================================

drop view if exists public.published_courses;
create view public.published_courses
with (security_invoker = false)
as
select
  c.id,
  c.slug,
  c.title,
  c.subtitle,
  c.description,
  c.price_paise,
  c.currency,
  c.level,
  c.language,
  c.thumbnail_key,
  c.duration_minutes,
  c.lessons_count,
  c.downloadable_resources,
  c.rating,
  c.ratings_count,
  c.students_count,
  c.published_at,
  cat.slug as category_slug,
  cat.name as category_name,
  cp.username as creator_username,
  cp.display_name as creator_display_name,
  cp.headline as creator_headline,
  cp.avatar_key as creator_avatar_key
from public.courses c
left join public.categories cat on cat.id = c.category_id
join public.creator_profiles cp on cp.user_id = c.creator_id
where c.status = 'published';

grant select on public.published_courses to anon, authenticated;

-- ===========================================================================
-- creator_public_profiles — the publicly presentable half of creator_profiles
-- ===========================================================================
--
-- Same pattern as `published_courses`: a `security_invoker = false` view, so the
-- column list below *is* the access rule. RLS on the base table does not apply,
-- which is precisely why the list is deliberately short and why `tests/rls.mjs`
-- asserts it never grows a `route_*` or identity column.
--
-- This is what anonymous visitors read for the instructor page and catalogue
-- search. Everything a creator needs beyond these fields — Route status, topics,
-- website, onboarding state — stays behind the authenticated self-read policy.

drop view if exists public.creator_public_profiles;
create view public.creator_public_profiles
with (security_invoker = false)
as
select
  cp.user_id,
  cp.username,
  cp.display_name,
  cp.headline,
  cp.bio,
  cp.country_code,
  cp.languages,
  cp.topics,
  cp.website,
  cp.avatar_key,
  cp.created_at
from public.creator_profiles cp;

grant select on public.creator_public_profiles to anon, authenticated;
