-- Zybble — 0012_media_direct_upload
-- Allow a media row to exist before its bytes have arrived.

-- ---------------------------------------------------------------------------
-- Why this exists
--
-- Media used to be POSTed to /api/posts/media, which meant the bytes travelled
-- through a serverless function. Vercel caps request bodies at 4.5 MB, so any
-- video (up to 200 MB) — and even a 5 MB image at the top of LinkedIn's limit —
-- was rejected by the platform with a plain-text "Request Entity Too Large"
-- before our code ran. The client then tried to read that as JSON and threw
-- `Unexpected token 'R', "Request En"... is not valid JSON`.
--
-- Uploads now go browser → storage directly, against a URL the server mints
-- after validating the file against LinkedIn's limits. The row is created
-- before the bytes arrive, hence the `pending` state; it moves to `stored`
-- once the upload is confirmed.
-- ---------------------------------------------------------------------------
alter table public.media_assets
  drop constraint if exists media_assets_status_valid;

alter table public.media_assets
  add constraint media_assets_status_valid check (
    upload_status in ('pending', 'stored', 'registering', 'registered', 'ready', 'failed')
  );

comment on column public.media_assets.upload_status is
  'pending: row created, bytes not yet confirmed. stored: verified in the bucket.';

-- Pending rows are garbage if the browser never finishes the upload. Anything
-- older than a day is not a live upload in progress.
create index if not exists media_assets_pending_idx
  on public.media_assets (created_at)
  where upload_status = 'pending';
