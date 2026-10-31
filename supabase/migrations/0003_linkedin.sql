-- Zybble — 0003_linkedin
-- LinkedIn connections, encrypted credentials and OAuth state.

-- ---------------------------------------------------------------------------
-- linkedin_accounts: metadata the product is allowed to render.
--
-- Deliberately contains NO tokens. Credentials live in
-- `linkedin_account_secrets`, which has RLS enabled and no policy for the
-- `authenticated` role, so a browser client can never read them — not even for
-- the caller's own workspace.
-- ---------------------------------------------------------------------------
create table if not exists public.linkedin_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind text not null default 'member',
  -- LinkedIn URN used as the publish target: urn:li:person:… / urn:li:organization:…
  profile_urn text not null,
  display_name text,
  headline text,
  avatar_url text,
  -- Scopes LinkedIn actually granted at connect time.
  granted_scopes text[] not null default '{}',
  -- Capability flags derived from granted scopes + LinkedIn product access.
  can_publish boolean not null default false,
  can_read_analytics boolean not null default false,
  status text not null default 'active',
  -- 'expired' once the access token passes expires_at; 'revoked' when LinkedIn
  -- rejects the token or the user disconnects.
  token_expires_at timestamptz,
  last_verified_at timestamptz,
  last_error_code text,
  last_error_message text,
  expiry_notified_at timestamptz,
  connected_by uuid references auth.users (id) on delete set null,
  disconnected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint linkedin_accounts_kind_valid check (kind in ('member', 'organization')),
  constraint linkedin_accounts_status_valid check (status in ('active', 'expired', 'revoked', 'reauth_required')),
  constraint linkedin_accounts_urn_shape check (profile_urn ~ '^urn:li:(person|organization):[A-Za-z0-9_-]+$')
);

-- One connection per LinkedIn identity per workspace (a workspace cannot link
-- the same profile twice; different workspaces may).
create unique index if not exists linkedin_accounts_workspace_urn_key
  on public.linkedin_accounts (workspace_id, profile_urn);

create index if not exists linkedin_accounts_workspace_idx
  on public.linkedin_accounts (workspace_id, status);

-- ---------------------------------------------------------------------------
-- linkedin_account_secrets: application-layer encrypted OAuth credentials.
--
-- Values are AES-256-GCM ciphertext produced by src/lib/crypto.ts using a key
-- that never leaves the server runtime. The service-role key is the only way to
-- read this table; RLS grants nothing to `anon` or `authenticated`.
-- ---------------------------------------------------------------------------
create table if not exists public.linkedin_account_secrets (
  account_id uuid primary key references public.linkedin_accounts (id) on delete cascade,
  access_token_ciphertext text not null,
  access_token_key_id text not null,
  refresh_token_ciphertext text,
  refresh_token_key_id text,
  refresh_token_expires_at timestamptz,
  scope text,
  token_type text not null default 'Bearer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger linkedin_accounts_set_updated_at
  before update on public.linkedin_accounts
  for each row execute function public.set_updated_at();

create trigger linkedin_account_secrets_set_updated_at
  before update on public.linkedin_account_secrets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- linkedin_oauth_states: single-use CSRF state for the OAuth handshake.
--
-- Only the SHA-256 hash of the state is stored; the raw value lives in a
-- short-lived httpOnly cookie so a stolen database row cannot be replayed.
-- ---------------------------------------------------------------------------
create table if not exists public.linkedin_oauth_states (
  id uuid primary key default gen_random_uuid(),
  state_hash text not null unique,
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- Account being re-authorised, when this is a reconnect rather than a connect.
  reconnect_account_id uuid references public.linkedin_accounts (id) on delete set null,
  redirect_to text,
  expires_at timestamptz not null default now() + interval '10 minutes',
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists linkedin_oauth_states_expires_idx
  on public.linkedin_oauth_states (expires_at);
