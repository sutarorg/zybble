-- ===========================================================================
-- Keep `profiles.email_verified` honest
-- ===========================================================================
--
-- `handle_new_user` seeds `profiles.email_verified` from
-- `auth.users.email_confirmed_at`, and nothing ever updated it afterwards. The
-- result was a permanent "Email not verified yet" badge on the settings page for
-- learners who had long since confirmed their address — a status indicator that
-- contradicted the auth system it claims to report.
--
-- The mirror is now maintained by a trigger on the auth schema, so verification
-- is reflected whether it happened through Zybble's own emailed link, a Supabase
-- confirmation email, or an administrator flipping the flag in the dashboard.
--
-- Session reads do not depend on this trigger landing first: `getSession()`
-- treats Supabase's own `email_confirmed_at` as the authority and the column as
-- the fallback.

create or replace function public.sync_profile_email_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_confirmed boolean;
begin
  v_confirmed := new.email_confirmed_at is not null;

  -- Only touch the row when the mirror actually disagrees, so a password change
  -- or a metadata update does not write to `profiles` for nothing.
  update public.profiles
     set email_verified = v_confirmed
   where id = new.id
     and email_verified is distinct from v_confirmed;

  return new;
end;
$$;

-- Runs as the function owner, never as the caller: `auth.users` is not readable
-- by any application role, and the trigger must not become a way to reach it.
revoke all on function public.sync_profile_email_verified() from public, anon, authenticated;

drop trigger if exists sync_profile_email_verified on auth.users;
create trigger sync_profile_email_verified
  after insert or update of email_confirmed_at on auth.users
  for each row
  execute function public.sync_profile_email_verified();

-- Backfill: every profile whose owner has already confirmed their address.
update public.profiles p
   set email_verified = true
 where p.email_verified = false
   and exists (
     select 1 from auth.users u
      where u.id = p.id
        and u.email_confirmed_at is not null
   );

comment on column public.profiles.email_verified is
  'Mirror of auth.users.email_confirmed_at, maintained by sync_profile_email_verified(). Session reads prefer the auth record.';
