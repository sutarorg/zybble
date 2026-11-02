-- Zybble — 0013_drop_supabase_storage
-- Retire Supabase Storage. Media objects now live in Cloudflare R2.

-- ---------------------------------------------------------------------------
-- Context
--
-- `0009_storage.sql` created a private `post-media` bucket with four RLS
-- policies. Media has moved to Cloudflare R2, reached through its
-- S3-compatible API from `src/lib/r2/objects.ts`. Nothing in the application
-- writes to or reads from Supabase Storage any more, so what remains is a
-- bucket full of objects no code references, plus policies that only widen the
-- attack surface.
--
-- This migration removes the half of the integration the database owns: the
-- policies, the helper function they depend on, and — once it is empty — the
-- bucket row itself.
-- ---------------------------------------------------------------------------

do $$
begin
  -- Everything is wrapped in `to_regclass` guards so this migration is a
  -- no-op on a database without the storage schema (local Postgres, CI),
  -- rather than failing the whole deploy.
  if to_regclass('storage.objects') is not null then
    drop policy if exists post_media_select on storage.objects;
    drop policy if exists post_media_insert on storage.objects;
    drop policy if exists post_media_update on storage.objects;
    drop policy if exists post_media_delete on storage.objects;
  end if;

  if to_regclass('storage.buckets') is not null then
    if exists (select 1 from storage.objects where bucket_id = 'post-media') then
      -- Deleting a non-empty bucket would violate the foreign key from
      -- storage.objects, and failing the deploy over leftover files helps
      -- nobody. The objects are unreferenced by application code; remove them
      -- from the Storage UI (or migrate them to R2 first) and re-run this.
      raise notice
        'Bucket post-media still holds objects; leaving the bucket row in place. '
        'Remove or migrate those files, then re-run to complete the removal.';
    else
      delete from storage.buckets where id = 'post-media';
    end if;
  end if;
end $$;

-- The helper parsed the workspace id out of an object path. R2 keys use the
-- same `<workspace_id>/…` layout, but isolation there is enforced by signed
-- URLs minted server-side, not by a SQL policy over a shared table.
drop function if exists public.storage_workspace_id(text);
