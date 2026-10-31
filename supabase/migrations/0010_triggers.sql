-- Zybble — 0010_triggers
-- Transactional business rules: workspace provisioning, quota accounting,
-- plan limits, membership invariants and data deletion.

-- ---------------------------------------------------------------------------
-- Workspace provisioning (atomic: workspace + owner membership + billing row)
-- ---------------------------------------------------------------------------
create or replace function public.create_workspace(
  workspace_name text,
  workspace_timezone text default 'UTC'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace_id uuid;
  slug_base text;
  slug_candidate text;
  slug_suffix integer := 0;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  slug_base := nullif(public.slugify(workspace_name), '');
  slug_base := coalesce(slug_base, 'workspace');
  slug_candidate := slug_base;

  while exists (select 1 from public.workspaces w where w.slug = slug_candidate) loop
    slug_suffix := slug_suffix + 1;
    slug_candidate := slug_base || '-' || slug_suffix::text;
  end loop;

  insert into public.workspaces (name, slug, owner_id, plan, seats, timezone)
  values (
    btrim(workspace_name),
    slug_candidate,
    auth.uid(),
    'free',
    1,
    coalesce(workspace_timezone, 'UTC')
  )
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, email, role, status, joined_at)
  values (
    new_workspace_id,
    auth.uid(),
    coalesce((select p.email from public.profiles p where p.id = auth.uid()), ''),
    'owner',
    'active',
    now()
  );

  insert into public.subscriptions (workspace_id, plan, status, seats)
  values (new_workspace_id, 'free', 'free', 1);

  insert into public.usage_counters (workspace_id, period, metric, count)
  values (new_workspace_id, public.usage_period(now()), 'scheduled_posts', 0)
  on conflict do nothing;

  return new_workspace_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Invitation acceptance. The raw token never reaches the database: the caller
-- passes its SHA-256 hash, computed server-side from the emailed link.
-- ---------------------------------------------------------------------------
create or replace function public.accept_workspace_invitation(token_hash_value text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation public.workspace_members;
  caller_email text;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select * into invitation
  from public.workspace_members wm
  where wm.invite_token_hash = token_hash_value
    and wm.status = 'invited'
  for update;

  if invitation.id is null then
    raise exception 'invitation_not_found' using errcode = 'P0002';
  end if;

  if invitation.invite_expires_at is not null and invitation.invite_expires_at < now() then
    raise exception 'invitation_expired' using errcode = 'P0001';
  end if;

  caller_email := lower((select p.email from public.profiles p where p.id = auth.uid()));

  if caller_email is null or caller_email <> lower(invitation.email) then
    raise exception 'invitation_email_mismatch' using errcode = '42501';
  end if;

  update public.workspace_members
  set user_id = auth.uid(),
      status = 'active',
      joined_at = now(),
      invite_token_hash = null,
      invite_expires_at = null
  where id = invitation.id;

  return invitation.workspace_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Plan limits: connected LinkedIn accounts.
-- Free: 1 · Pro: 5 (per workspace).
-- ---------------------------------------------------------------------------
create or replace function public.linkedin_account_limit(plan_id text)
returns integer
language sql
immutable
as $$
  select case when plan_id = 'pro' then 5 else 1 end;
$$;

create or replace function public.enforce_linkedin_account_limit()
returns trigger
language plpgsql
as $$
declare
  active_count integer;
  max_accounts integer;
begin
  select count(*) into active_count
  from public.linkedin_accounts la
  where la.workspace_id = new.workspace_id
    and la.status <> 'revoked'
    and la.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  max_accounts := public.linkedin_account_limit(public.workspace_plan(new.workspace_id));

  if active_count >= max_accounts then
    raise exception 'linkedin_account_limit_reached'
      using errcode = 'P0001',
            detail = format('plan %s allows %s connected account(s)', public.workspace_plan(new.workspace_id), max_accounts);
  end if;

  return new;
end;
$$;

create trigger linkedin_accounts_enforce_limit
  before insert on public.linkedin_accounts
  for each row execute function public.enforce_linkedin_account_limit();

-- ---------------------------------------------------------------------------
-- Membership invariants: a workspace always keeps at least one active owner.
-- ---------------------------------------------------------------------------
create or replace function public.guard_workspace_owner()
returns trigger
language plpgsql
as $$
declare
  remaining_owners integer;
begin
  if tg_op = 'DELETE' then
    if old.role = 'owner' and old.status = 'active' then
      select count(*) into remaining_owners
      from public.workspace_members wm
      where wm.workspace_id = old.workspace_id
        and wm.role = 'owner'
        and wm.status = 'active'
        and wm.id <> old.id;

      if remaining_owners = 0 then
        raise exception 'workspace_requires_owner' using errcode = 'P0001';
      end if;
    end if;
    return old;
  end if;

  if old.role = 'owner' and old.status = 'active'
     and (new.role <> 'owner' or new.status <> 'active') then
    select count(*) into remaining_owners
    from public.workspace_members wm
    where wm.workspace_id = new.workspace_id
      and wm.role = 'owner'
      and wm.status = 'active'
      and wm.id <> new.id;

    if remaining_owners = 0 then
      raise exception 'workspace_requires_owner' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

create trigger workspace_members_guard_owner
  before update or delete on public.workspace_members
  for each row execute function public.guard_workspace_owner();

-- ---------------------------------------------------------------------------
-- Free-plan quota: 10 scheduled posts per calendar month.
--
-- A post consumes a slot the moment it becomes scheduled (or later) and the
-- slot is refunded if it returns to draft or is cancelled before publishing.
-- The count lives in public.usage_counters so both the guard below and the
-- billing screen read the same number.
-- ---------------------------------------------------------------------------
create or replace function public.monthly_schedule_limit(plan_id text)
returns integer
language sql
immutable
as $$
  select case when plan_id = 'pro' then null else 10 end;
$$;

create or replace function public.posts_guard_schedule_quota()
returns trigger
language plpgsql
as $$
declare
  limit_value integer;
  current_count integer;
  new_period text;
begin
  new_period := public.usage_period(coalesce(new.scheduled_at, now()));

  if new.status in ('scheduled', 'publishing', 'published', 'failed') then
    limit_value := public.monthly_schedule_limit(public.workspace_plan(new.workspace_id));

    if limit_value is not null then
      if tg_op = 'UPDATE' and old.status in ('scheduled', 'publishing', 'published', 'failed') then
        -- Rescheduling inside the same period must not consume a second slot.
        if old.usage_period is not distinct from new_period then
          return new;
        end if;
      end if;

      current_count := public.current_usage(new.workspace_id, 'scheduled_posts');

      if current_count >= limit_value then
        raise exception 'schedule_limit_reached'
          using errcode = 'P0001',
                detail = format('free plan allows %s scheduled posts per month', limit_value);
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger posts_guard_schedule_quota_trigger
  before insert or update on public.posts
  for each row execute function public.posts_guard_schedule_quota();

create or replace function public.posts_sync_usage_counter()
returns trigger
language plpgsql
as $$
declare
  counted text[] := array['scheduled', 'publishing', 'published', 'failed'];
  old_counted boolean;
  new_counted boolean;
  old_period text;
  new_period text;
begin
  old_counted := tg_op = 'UPDATE' and old.status = any(counted);
  new_counted := new.status = any(counted);
  old_period := case when tg_op = 'UPDATE' then old.usage_period else null end;
  new_period := new.usage_period;

  if new_counted and not old_counted then
    insert into public.usage_counters (workspace_id, period, metric, count)
    values (new.workspace_id, coalesce(new_period, public.usage_period(now())), 'scheduled_posts', 1)
    on conflict (workspace_id, period, metric)
    do update set count = public.usage_counters.count + 1;
  elsif old_counted and not new_counted then
    update public.usage_counters
    set count = greatest(count - 1, 0)
    where workspace_id = new.workspace_id
      and period = coalesce(old_period, public.usage_period(now()))
      and metric = 'scheduled_posts';
  elsif old_counted and new_counted and old_period is distinct from new_period then
    update public.usage_counters
    set count = greatest(count - 1, 0)
    where workspace_id = new.workspace_id
      and period = old_period
      and metric = 'scheduled_posts';

    insert into public.usage_counters (workspace_id, period, metric, count)
    values (new.workspace_id, new_period, 'scheduled_posts', 1)
    on conflict (workspace_id, period, metric)
    do update set count = public.usage_counters.count + 1;
  end if;

  return null;
end;
$$;

create trigger posts_sync_usage_counter_trigger
  after insert or update of status, usage_period on public.posts
  for each row execute function public.posts_sync_usage_counter();

-- Keep the denormalised media count in step with the media_assets table.
create or replace function public.posts_sync_media_count()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts p
    set media_count = (
      select count(*) from public.media_assets ma where ma.post_id = new.post_id
    )
    where p.id = new.post_id;
  else
    update public.posts p
    set media_count = (
      select count(*) from public.media_assets ma where ma.post_id = old.post_id
    )
    where p.id = old.post_id;
  end if;

  return null;
end;
$$;

create trigger media_assets_sync_post_count
  after insert or delete on public.media_assets
  for each row execute function public.posts_sync_media_count();

-- ---------------------------------------------------------------------------
-- Data deletion (GDPR-style erasure). Runs inside one transaction from the
-- account-deletion job; storage objects are removed by the job beforehand.
-- ---------------------------------------------------------------------------
create or replace function public.purge_workspace_data(target_workspace uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.notifications where workspace_id = target_workspace;
  delete from public.audit_logs where workspace_id = target_workspace;
  delete from public.best_time_recommendations where workspace_id = target_workspace;
  delete from public.analytics_snapshots where workspace_id = target_workspace;
  delete from public.post_analytics where workspace_id = target_workspace;
  delete from public.post_publish_attempts
    where post_id in (select p.id from public.posts p where p.workspace_id = target_workspace);
  delete from public.media_assets where workspace_id = target_workspace;
  delete from public.posts where workspace_id = target_workspace;
  delete from public.linkedin_oauth_states where workspace_id = target_workspace;
  delete from public.linkedin_account_secrets
    where account_id in (select la.id from public.linkedin_accounts la where la.workspace_id = target_workspace);
  delete from public.linkedin_accounts where workspace_id = target_workspace;
  delete from public.usage_counters where workspace_id = target_workspace;
  delete from public.billing_payments where workspace_id = target_workspace;
  delete from public.subscriptions where workspace_id = target_workspace;
  delete from public.workspace_members where workspace_id = target_workspace;
  delete from public.workspaces where id = target_workspace;
end;
$$;
