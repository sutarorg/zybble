-- Zybble — Row Level Security for the learner's own tables.
--
-- Why this migration exists
-- ------------------------
-- `20260101000300_rls.sql` enables RLS on every table and then GRANTs the
-- browser roles access to several learner tables — but it never defines a POLICY
-- for them. Postgres treats "RLS enabled, no matching policy" as **deny**, so
-- every one of those tables was reachable by nobody:
--
--   entitlements, wishlist, lesson_progress, lesson_notes, course_resume,
--   learner_preferences, recent_course_views, notifications
--
-- The effect would have been a silent, total failure of the learner area once
-- migrations were actually applied: `/dashboard`, `/my-learning`, `/wishlist`,
-- `/certificates`, `/learn/[courseId]` and Settings would all read as empty,
-- because the server queries the learner's own rows through the RLS client.
--
-- Each table below is owned by exactly one user. The policy is always
-- `user_id = auth.uid()`: a browser can see and write its own rows and nobody
-- else's. Ownership is therefore a database rule, not a UI convention.
--
-- `test:unit` asserts that every table granted to a browser role has at least
-- one policy, so this class of omission cannot come back silently.

-- ===========================================================================
-- Entitlements — "does this learner own this course?"
-- ===========================================================================
--
-- Readable and deletable by the owner. NOT insertable from the browser: an
-- entitlement is minted only by a verified payment or a free enrolment, both
-- of which run through the service role after re-checking the course and the
-- learner. Letting the browser insert one would be a free course for anyone.

drop policy if exists entitlements_own_read on public.entitlements;
create policy entitlements_own_read on public.entitlements
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists entitlements_own_delete on public.entitlements;
create policy entitlements_own_delete on public.entitlements
  for delete to authenticated
  using (user_id = auth.uid());

-- ===========================================================================
-- Wishlist
-- ===========================================================================

drop policy if exists wishlist_own_all on public.wishlist;
create policy wishlist_own_all on public.wishlist
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ===========================================================================
-- Lesson progress
-- ===========================================================================
--
-- Writable by the owner so the player can mark lessons complete. Note that this
-- alone does not grant anything: certificates are recomputed server-side
-- against the authoritative lesson list, and access to a lesson is decided by
-- `entitlements`, not by a progress row.

drop policy if exists lesson_progress_own_all on public.lesson_progress;
create policy lesson_progress_own_all on public.lesson_progress
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ===========================================================================
-- Lesson notes
-- ===========================================================================

drop policy if exists lesson_notes_own_all on public.lesson_notes;
create policy lesson_notes_own_all on public.lesson_notes
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ===========================================================================
-- Course resume position
-- ===========================================================================

drop policy if exists course_resume_own_all on public.course_resume;
create policy course_resume_own_all on public.course_resume
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ===========================================================================
-- Learner preferences (one row per user; `user_id` is the primary key)
-- ===========================================================================

drop policy if exists learner_preferences_own_all on public.learner_preferences;
create policy learner_preferences_own_all on public.learner_preferences
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ===========================================================================
-- Recently viewed
-- ===========================================================================

drop policy if exists recent_course_views_own_all on public.recent_course_views;
create policy recent_course_views_own_all on public.recent_course_views
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ===========================================================================
-- Notifications
-- ===========================================================================
--
-- Readable and markable-read by the owner. NOT insertable: notifications are
-- produced by real platform events (a captured payment, a moderation decision,
-- a Route transfer update), never by the browser.

drop policy if exists notifications_own_read on public.notifications;
create policy notifications_own_read on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists notifications_own_update on public.notifications;
create policy notifications_own_update on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ===========================================================================
-- published_courses — deliberately NOT given a policy here
-- ===========================================================================
--
-- It is a view created with `security_invoker = false`, so it runs with the
-- definer's rights and Postgres never applies RLS to it. Its own
-- `WHERE c.status = 'published'` clause is the entire access rule, which is why
-- it is safe to expose to `anon`.
--
-- It publishes catalog metadata only and never joins `profiles.email`,
-- `orders`, `payments` or anything else identifiable. The companion test in
-- `tests/rls.mjs` asserts that the column list never grows a PII column, since
-- a view is exactly the place where that leak would slip through unnoticed.