-- Zybble — 0009_storage
-- Private media bucket. Objects are stored under
--   <workspace_id>/<post_id>/<asset_id>.<ext>
-- and every policy below re-derives the workspace from the first path segment,
-- so a member of workspace A can never read (or overwrite) workspace B's files.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-media',
  'post-media',
  false,
  104857600, -- 100 MB: LinkedIn's document ceiling
  array[
    'image/png', 'image/jpeg', 'image/gif', 'image/webp',
    'video/mp4',
    'application/pdf'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Workspace id parsed from an object path (`<uuid>/…`).
create or replace function public.storage_workspace_id(object_name text)
returns uuid
language sql
immutable
as $$
  select nullif(split_part(object_name, '/', 1), '')::uuid;
$$;

drop policy if exists post_media_select on storage.objects;
create policy post_media_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'post-media'
    and public.storage_workspace_id(name) in (select public.workspace_ids_for_user())
  );

drop policy if exists post_media_insert on storage.objects;
create policy post_media_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'post-media'
    and public.storage_workspace_id(name) in (select public.workspace_ids_for_user())
    and public.can_write_workspace(public.storage_workspace_id(name))
  );

drop policy if exists post_media_update on storage.objects;
create policy post_media_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'post-media'
    and public.storage_workspace_id(name) in (select public.workspace_ids_for_user())
    and public.can_write_workspace(public.storage_workspace_id(name))
  );

drop policy if exists post_media_delete on storage.objects;
create policy post_media_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'post-media'
    and public.storage_workspace_id(name) in (select public.workspace_ids_for_user())
    and public.can_write_workspace(public.storage_workspace_id(name))
  );
