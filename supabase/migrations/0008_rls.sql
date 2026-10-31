-- Zybble — 0008_rls
-- Row Level Security for every table.
--
-- Security model
-- --------------
-- 1. Every workspace-scoped table filters on `public.workspace_ids_for_user()`,
--    which derives membership from the verified Supabase JWT (`auth.uid()`).
--    A row belonging to another workspace is invisible and unwritable, even if
--    the caller guesses its UUID.
-- 2. Credentials (linkedin_account_secrets), OAuth state, webhook payloads and
--    rate-limit counters have RLS enabled and *no* policy for `anon` or
--    `authenticated`. They are reachable only through the service-role key on
--    the server.
-- 3. Entitlement state (subscriptions) is read-only for clients: the only way
--    to become Pro is a signature-verified Dodo webhook.
-- 4. Plan-bound history windows are enforced in the policy itself, so a Free
--    workspace cannot read 12 months of analytics by changing a query string.

alter table public.profiles                    enable row level security;
alter table public.workspaces                  enable row level security;
alter table public.workspace_members           enable row level security;
alter table public.usage_counters              enable row level security;
alter table public.linkedin_accounts           enable row level security;
alter table public.linkedin_account_secrets    enable row level security;
alter table public.linkedin_oauth_states       enable row level security;
alter table public.posts                       enable row level security;
alter table public.media_assets                enable row level security;
alter table public.post_publish_attempts       enable row level security;
alter table public.post_analytics              enable row level security;
alter table public.analytics_snapshots         enable row level security;
alter table public.best_time_recommendations   enable row level security;
alter table public.subscriptions               enable row level security;
alter table public.billing_payments            enable row level security;
alter table public.webhook_events              enable row level security;
alter table public.notifications               enable row level security;
alter table public.notification_preferences    enable row level security;
alter table public.audit_logs                  enable row level security;
alter table public.rate_limit_counters         enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or id in (
      select wm.user_id
      from public.workspace_members wm
      where wm.workspace_id in (select public.workspace_ids_for_user())
        and wm.user_id is not null
    )
  );

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- workspaces
-- ---------------------------------------------------------------------------
drop policy if exists workspaces_select_member on public.workspaces;
create policy workspaces_select_member on public.workspaces
  for select to authenticated
  using (id in (select public.workspace_ids_for_user()));

-- Creation goes through public.create_workspace() (SECURITY DEFINER) so the
-- owner membership row exists in the same transaction. This policy is the
-- safety net for any direct insert.
drop policy if exists workspaces_insert_owner on public.workspaces;
create policy workspaces_insert_owner on public.workspaces
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists workspaces_update_manager on public.workspaces;
create policy workspaces_update_manager on public.workspaces
  for update to authenticated
  using (public.can_manage_workspace(id))
  with check (public.can_manage_workspace(id));

-- No DELETE policy: workspaces are removed by public.request_workspace_deletion().

-- ---------------------------------------------------------------------------
-- workspace_members
-- ---------------------------------------------------------------------------
drop policy if exists workspace_members_select on public.workspace_members;
create policy workspace_members_select on public.workspace_members
  for select to authenticated
  using (workspace_id in (select public.workspace_ids_for_user()));

drop policy if exists workspace_members_insert_manager on public.workspace_members;
create policy workspace_members_insert_manager on public.workspace_members
  for insert to authenticated
  with check (public.can_manage_workspace(workspace_id));

drop policy if exists workspace_members_update_manager on public.workspace_members;
create policy workspace_members_update_manager on public.workspace_members
  for update to authenticated
  using (public.can_manage_workspace(workspace_id))
  with check (public.can_manage_workspace(workspace_id));

drop policy if exists workspace_members_delete_manager on public.workspace_members;
create policy workspace_members_delete_manager on public.workspace_members
  for delete to authenticated
  using (
    public.can_manage_workspace(workspace_id)
    and role <> 'owner'
  );

-- ---------------------------------------------------------------------------
-- usage_counters (read-only for members)
-- ---------------------------------------------------------------------------
drop policy if exists usage_counters_select on public.usage_counters;
create policy usage_counters_select on public.usage_counters
  for select to authenticated
  using (workspace_id in (select public.workspace_ids_for_user()));

-- ---------------------------------------------------------------------------
-- linkedin_accounts (metadata only — secrets are in a policy-free table)
-- ---------------------------------------------------------------------------
drop policy if exists linkedin_accounts_select on public.linkedin_accounts;
create policy linkedin_accounts_select on public.linkedin_accounts
  for select to authenticated
  using (workspace_id in (select public.workspace_ids_for_user()));

drop policy if exists linkedin_accounts_insert_manager on public.linkedin_accounts;
create policy linkedin_accounts_insert_manager on public.linkedin_accounts
  for insert to authenticated
  with check (public.can_manage_workspace(workspace_id));

drop policy if exists linkedin_accounts_update_manager on public.linkedin_accounts;
create policy linkedin_accounts_update_manager on public.linkedin_accounts
  for update to authenticated
  using (public.can_manage_workspace(workspace_id))
  with check (public.can_manage_workspace(workspace_id));

drop policy if exists linkedin_accounts_delete_manager on public.linkedin_accounts;
create policy linkedin_accounts_delete_manager on public.linkedin_accounts
  for delete to authenticated
  using (public.can_manage_workspace(workspace_id));

-- linkedin_account_secrets / linkedin_oauth_states intentionally have no
-- policies: RLS is enabled, so `anon` and `authenticated` see zero rows.

-- ---------------------------------------------------------------------------
-- posts
-- ---------------------------------------------------------------------------
drop policy if exists posts_select on public.posts;
create policy posts_select on public.posts
  for select to authenticated
  using (workspace_id in (select public.workspace_ids_for_user()));

drop policy if exists posts_insert on public.posts;
create policy posts_insert on public.posts
  for insert to authenticated
  with check (
    public.can_write_workspace(workspace_id)
    and created_by = (select auth.uid())
    and author_account_id in (
      select la.id from public.linkedin_accounts la where la.workspace_id = posts.workspace_id
    )
  );

drop policy if exists posts_update on public.posts;
create policy posts_update on public.posts
  for update to authenticated
  using (public.can_write_workspace(workspace_id))
  with check (public.can_write_workspace(workspace_id));

drop policy if exists posts_delete on public.posts;
create policy posts_delete on public.posts
  for delete to authenticated
  using (public.can_write_workspace(workspace_id));

-- ---------------------------------------------------------------------------
-- media_assets
-- ---------------------------------------------------------------------------
drop policy if exists media_assets_select on public.media_assets;
create policy media_assets_select on public.media_assets
  for select to authenticated
  using (workspace_id in (select public.workspace_ids_for_user()));

drop policy if exists media_assets_write on public.media_assets;
create policy media_assets_write on public.media_assets
  for all to authenticated
  using (public.can_write_workspace(workspace_id))
  with check (
    public.can_write_workspace(workspace_id)
    and created_by = (select auth.uid())
  );

-- ---------------------------------------------------------------------------
-- post_publish_attempts (read-only; the publish job writes with service role)
-- ---------------------------------------------------------------------------
drop policy if exists post_publish_attempts_select on public.post_publish_attempts;
create policy post_publish_attempts_select on public.post_publish_attempts
  for select to authenticated
  using (
    post_id in (
      select p.id from public.posts p where p.workspace_id in (select public.workspace_ids_for_user())
    )
  );

-- ---------------------------------------------------------------------------
-- analytics — plan window enforced in the policy
-- ---------------------------------------------------------------------------
drop policy if exists post_analytics_select on public.post_analytics;
create policy post_analytics_select on public.post_analytics
  for select to authenticated
  using (
    workspace_id in (select public.workspace_ids_for_user())
    and captured_on >= (current_date - make_interval(days => case
          when public.workspace_plan(workspace_id) = 'pro' then 365 else 7 end))
  );

drop policy if exists analytics_snapshots_select on public.analytics_snapshots;
create policy analytics_snapshots_select on public.analytics_snapshots
  for select to authenticated
  using (
    workspace_id in (select public.workspace_ids_for_user())
    and captured_on >= (current_date - make_interval(days => case
          when public.workspace_plan(workspace_id) = 'pro' then 365 else 7 end))
  );

drop policy if exists best_time_recommendations_select on public.best_time_recommendations;
create policy best_time_recommendations_select on public.best_time_recommendations
  for select to authenticated
  using (
    workspace_id in (select public.workspace_ids_for_user())
    and public.workspace_plan(workspace_id) = 'pro'
  );

-- ---------------------------------------------------------------------------
-- billing — read-only for members; writes come from verified webhooks only
-- ---------------------------------------------------------------------------
drop policy if exists subscriptions_select on public.subscriptions;
create policy subscriptions_select on public.subscriptions
  for select to authenticated
  using (workspace_id in (select public.workspace_ids_for_user()));

drop policy if exists billing_payments_select on public.billing_payments;
create policy billing_payments_select on public.billing_payments
  for select to authenticated
  using (workspace_id in (select public.workspace_ids_for_user()));

-- webhook_events: no policies.

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated
  using (
    workspace_id in (select public.workspace_ids_for_user())
    and (user_id is null or user_id = (select auth.uid()))
  );

-- Marking as read is the only client-side mutation allowed.
drop policy if exists notifications_update_read on public.notifications;
create policy notifications_update_read on public.notifications
  for update to authenticated
  using (
    workspace_id in (select public.workspace_ids_for_user())
    and (user_id is null or user_id = (select auth.uid()))
  )
  with check (
    workspace_id in (select public.workspace_ids_for_user())
    and (user_id is null or user_id = (select auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- notification_preferences — strictly personal
-- ---------------------------------------------------------------------------
drop policy if exists notification_preferences_self on public.notification_preferences;
create policy notification_preferences_self on public.notification_preferences
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- audit_logs — visible to owners/admins, written server-side only
-- ---------------------------------------------------------------------------
drop policy if exists audit_logs_select_manager on public.audit_logs;
create policy audit_logs_select_manager on public.audit_logs
  for select to authenticated
  using (public.can_manage_workspace(workspace_id));

-- rate_limit_counters: no policies (SECURITY DEFINER function only).
