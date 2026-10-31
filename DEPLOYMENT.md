# Zybble — Deployment guide

This document takes Zybble from a clean checkout to a running production
deployment. It is written for someone who has never deployed this codebase
before, and every command and dashboard path reflects what the code actually
expects — there are no invented options in here.

If a step cannot be completed without an account, an approval or a credential
that only you can obtain, it says so explicitly. Nothing in this repository has
been deployed to a production environment by an automated agent.

---

## Contents

| Section | What it covers |
| --- | --- |
| [A. Prerequisites](#a-prerequisites) | Accounts, software, credentials, domain |
| [B. GitHub setup](#b-github-setup) | Repository, branches, Actions, protection |
| [C. Supabase setup](#c-supabase-setup) | Project, auth, migrations, RLS, storage, backups |
| [D. LinkedIn setup](#d-linkedin-setup) | App, OAuth, permissions, review tiers |
| [E. Inngest setup](#e-inngest-setup) | App, keys, sync, verification |
| [F. Dodo Payments setup](#f-dodo-payments-setup) | Product, webhooks, test → live |
| [G. Resend setup](#g-resend-setup) | Domain, DNS, DMARC, API key |
| [H. Vercel setup](#h-vercel-setup) | Import, env vars, domain, environments |
| [I. Environment variables](#i-environment-variables) | Complete list, public vs secret |
| [J. Database migrations](#j-production-database-migration) | Apply, verify, roll back |
| [K. Post-deployment smoke tests](#k-post-deployment-smoke-testing) | What to check and in what order |
| [L. Monitoring](#l-monitoring) | Errors, jobs, payments, email |
| [M. Rollback and recovery](#m-rollback-and-recovery) | Deploy, migration, secrets, backups |
| [N. Launch checklist](#n-launch-checklist) | Copy-paste checklist |

---

## A. Prerequisites

### A.1 Accounts you must create

| Service | Plan | Why |
| --- | --- | --- |
| **GitHub** | Free or Team | Source, CI |
| **Vercel** | **Pro or higher** | See the warning below |
| **Supabase** | **Pro or higher** | Daily backups and PITR are paid features; the Free plan also pauses inactive projects |
| **Inngest** | Free tier is fine to start | Durable jobs |
| **Dodo Payments** | Merchant of Record account | Subscriptions; requires business verification for live mode |
| **Resend** | Free tier is fine to start | Transactional email |
| **LinkedIn Developer** | Free | OAuth app; Community Management API requires review |

> **Vercel plan — read this.** Vercel's Hobby plan is licensed for personal,
> non-commercial use only. Zybble is a paid SaaS product, so **Hobby is not a
> compliant production hosting choice**. Use the **Pro** plan (or Enterprise for
> contractual needs). This is a licensing requirement, not a technical one, and
> it is not something the code can work around.

### A.2 Software

```bash
node --version   # 22 LTS or newer (CI uses 22)
npm --version    # 10+
git --version

# Supabase CLI (migrations, type generation)
npm install -g supabase

# Vercel CLI (optional but recommended for env management and rollbacks)
npm install -g vercel

# Playwright browsers (only needed to run the E2E suite locally)
npx playwright install --with-deps chromium
```

### A.3 Credentials you will collect

You will be asked for each of these in the sections below. Keep them in a
password manager; never paste a real value into a file that is committed.

- Supabase: project URL, publishable key, **service-role key**, pooled connection string
- LinkedIn: client ID, client secret
- Inngest: signing key, event key
- Dodo Payments: API key, webhook signing secret, Pro product ID
- Resend: API key
- Two self-generated secrets: `TOKEN_ENCRYPTION_KEY` and `CRON_SECRET`

Generate the two secrets locally:

```bash
openssl rand -base64 32   # TOKEN_ENCRYPTION_KEY (must decode to exactly 32 bytes)
openssl rand -hex 32      # CRON_SECRET
```

### A.4 Domain

One domain you control, for example `zybble.app`. You will need to add DNS
records for:

- Vercel (the app itself)
- Resend (SPF, DKIM, return-path MX, and optionally DMARC)

A subdomain for the sending identity (e.g. `send.zybble.app` or a
`no-reply@zybble.app` sender) is cleaner than reusing the apex for both web and
mail, but Resend supports either.

---

## B. GitHub setup

### B.1 Repository

```bash
# If the repository already exists (this project):
git clone git@github.com:<org>/zybble.git && cd zybble

# Otherwise create one and push this tree.
```

### B.2 Branch model

- `main` — production. Vercel deploys this to the production environment.
- Feature branches — every push gets a Vercel **preview** deployment.
- A `staging` branch (optional) — if you want a long-lived staging
  environment, create a Vercel **custom environment** and point `staging` at it.

### B.3 GitHub Actions

Two workflows are committed:

| Workflow | Trigger | What it runs |
| --- | --- | --- |
| `.github/workflows/ci.yml` | Every push and PR | Install → lint → typecheck → unit/integration tests → production build → dependency audit → E2E (public surface) |
| `.github/workflows/e2e-staging.yml` | Nightly (03:17 UTC) and manual dispatch | The **full** E2E suite against a configured deployment |

The nightly workflow exists because the authenticated E2E tests need real
credentials. Running those on every pull request would expose project secrets to
any contributor's branch, so they are restricted to a protected GitHub
Environment.

To enable the full suite:

1. **Settings → Environments → New environment** → name it `staging`.
2. Add environment variables: `E2E_BASE_URL` (e.g. `https://staging.zybble.app`).
3. Optionally restrict the environment to `main` and administrators.
4. For the CI workflow's E2E step, add a repository secret `E2E_REAL_BACKEND`
   (`1` to enable the authenticated suites, absent to skip them).

### B.4 Branch protection

On **Settings → Branches → Add rule** for `main`, enable:

- [x] Require a pull request before merging (1 approval minimum)
- [x] Require status checks to pass: `Lint`, `Type check`, `Unit and integration tests`, `Production build`, `Dependency audit`
- [x] Require branches to be up to date before merging
- [x] Do not allow bypassing the above settings
- [x] Require signed commits (recommended)

This is what stops a change that breaks RLS or skips the migration tests from
reaching production.

### B.5 Secrets are never committed

`.gitignore` excludes `.env`, `.env.*` (except `.env.example`) and
`.playwright/`. CI reads secrets from GitHub Actions, never from the
repository. If a secret is ever committed, treat it as compromised and rotate
it — deleting the commit does not un-leak it.

---

## C. Supabase setup

### C.1 Create the production project

1. Create a project on the **Pro** plan (daily backups, no inactivity pausing).
2. Choose a region close to the majority of your users. Vercel's `iad1` pairs
   well with Supabase's `us-east-1`; keep the two in the same continent.
3. Set a strong database password and store it in your password manager.

### C.2 Collect the credentials

**Project Settings → API**

| Value | Environment variable |
| --- | --- |
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| Publishable key (or the legacy anon key) | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| `service_role` key | `SUPABASE_SERVICE_ROLE_KEY` |

> The service-role key bypasses RLS entirely. It is read only by
> `src/lib/supabase/admin.ts`, which is imported exclusively by server modules
> (webhooks and background jobs). **Never** import it into a component, and
> never prefix it with `NEXT_PUBLIC_`.

**Project Settings → Database → Connection string** → use the **pooled**
connection (port **6543**) for `DATABASE_URL`. The pooled connection is what
serverless functions need; a direct connection (5432) will exhaust Postgres'
connection limit under load.

### C.3 Configure authentication

**Authentication → Providers → Email**

- [x] Enable email provider
- [x] **Confirm email** — Zybble's signup flow handles the "check your inbox"
  state explicitly
- [ ] Allow new users to sign up — leave enabled, this is a self-serve SaaS

**Authentication → URL Configuration**

| Field | Value |
| --- | --- |
| Site URL | `https://zybble.app` |
| Redirect URLs | `https://zybble.app/auth/callback`, `https://zybble.app/reset-password`, `https://*.vercel.app/auth/callback` (for previews) |

Zybble routes everything through `/auth/callback`
(`src/app/auth/callback/route.ts`), which handles both the PKCE `code` exchange
and the `token_hash` flows, and sends `type=recovery` to `/reset-password`.

**Authentication → Settings**

- [x] Enable **leaked password protection** (Supabase checks against HaveIBeenPwned)
- Set the **JWT expiry** to something sane (default 1 hour is fine; sessions are
  refreshed on every request by `src/lib/supabase/proxy.ts`)
- Configure custom SMTP so confirmation and reset emails are not rate-limited
  by Supabase's default sender

### C.4 Apply the migrations

The migrations live in `supabase/migrations/` and are numbered
`0001_foundation.sql` … `0010_triggers.sql`. They must be applied **in
order** — later files depend on earlier ones.

```bash
supabase login
supabase link --project-ref <your-project-ref>

# Dry run first — prints the SQL it would apply.
supabase db push --dry-run

# Apply.
supabase db push
```

For production, prefer wiring migrations into CI:

1. In Supabase, enable the **GitHub integration** and turn on **Deploy to
   production** so `supabase/migrations` is applied from `main` automatically.
2. Keep `supabase db push` as the manual fallback.

### C.5 Verify RLS is actually on

Do not take this on trust. Run this in the SQL editor and confirm **every row
returns `true`**:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
```

Then confirm every table has at least one policy:

```sql
select tablename, count(*) as policies
from pg_policies
where schemaname = 'public'
group by tablename
order by tablename;
```

Both checks are enforced in CI by `tests/db/rls-isolation.test.ts`, which runs
the migrations against a real Postgres (PGlite) and asserts that one workspace
cannot read or write another workspace's posts, LinkedIn tokens, analytics,
media or subscription.

### C.6 Create the storage bucket

`supabase/migrations/0009_storage.sql` creates a **private** bucket called
`post-media` with `file_size_limit` and `allowed_mime_types` at the bucket
level, plus four RLS policies. Verify in **Storage → Buckets**; if your plan
restricted the SQL create, create the bucket by hand with:

- **Name:** `post-media`
- **Public:** **off**
- **File size limit:** 200 MB
- **Allowed MIME types:** `image/jpeg`, `image/png`, `image/gif`, `video/mp4`, `application/pdf`

Objects are stored under `{workspace_id}/…` and the policies derive the owning
workspace from the path with `storage_workspace_id(object_name)`, so renaming an
object cannot move it between tenants. The browser only ever receives
short-lived signed URLs.

### C.7 Generate the database types

`src/lib/supabase/database.types.ts` is checked in. Regenerate it whenever the
schema changes:

```bash
supabase gen types typescript --project-id <your-project-ref> > src/lib/supabase/database.types.ts
```

Commit the result — the type definitions are part of the build.

### C.8 Configure backups

| Control | Where | Recommended |
| --- | --- | --- |
| Daily backups | Automatic on Pro (7-day retention) | Verify under **Database → Backups** |
| Point-in-Time Recovery | **Database → Backups → PITR** (add-on) | Enable if your recovery point objective is shorter than 24 hours |
| Restore rehearsal | **Database → Backups → Restore to a new project** | Do this once before launch, on a throwaway project |

> Restoring to a **new** project is the safe way to recover deleted rows: it
> does not overwrite the live database. Note that this copies the database only
> — storage objects, auth settings and Edge Functions are **not** copied.

---

## D. LinkedIn setup

### D.1 Create the developer application

1. Go to the [LinkedIn Developer Portal](https://www.linkedin.com/developers/apps)
   and create an app.
2. Associate it with a **verified LinkedIn Company Page** for your
   organisation. Several permissions can only be granted to an app whose
   organisation LinkedIn has verified.
3. Under **Auth**, record the **Client ID** and **Client Secret**.
4. Under **Auth → Redirect URLs**, add **exactly** (no trailing slash, no
   wildcard):
   - `http://localhost:3000/api/linkedin/callback` (development)
   - `https://zybble.app/api/linkedin/callback` (production)
   - `https://<preview-domain>/api/linkedin/callback` if you test OAuth on previews

   The value must match `LINKEDIN_REDIRECT_URI` byte for byte. `redirectUri()`
   in `src/lib/linkedin/config.ts` builds it from that variable, so a mismatch
   shows up as an OAuth error before any code runs.

### D.2 Permissions: what is self-serve and what needs review

This is the single most important section, because **development access is not
production access.**

| Scope | Needed for | Approval |
| --- | --- | --- |
| `openid`, `profile`, `email` | Identify the member via OpenID Connect | **Self-serve** (Sign In with LinkedIn) |
| `w_member_social` | Post as the authenticated member — **the product cannot publish without this** | **Self-serve** with the *Share on LinkedIn* product |
| `r_member_postAnalytics` | Read the member's own post impressions/reactions/comments/reposts | **Requires Community Management API review** |

### D.3 Community Management API review

`r_member_postAnalytics` sits under the **Community Management API**, which
LinkedIn vets. Per LinkedIn's published review process:

- Access is granted only to **registered legal organisations for commercial use
  cases**.
- You must provide a **verified business email**, your organisation's legal
  name, registered address, website and privacy policy.
- The app must be **associated with a verified LinkedIn Page** belonging to the
  same organisation.
- The process runs in **two tiers**:
  1. **Development tier** — approved use case, verified business email and
     organisation, verified website, app linked to a verified Page. Low rate
     limits.
  2. **Standard tier** — requires the Development tier first, then an access
     request form plus a **screen recording** demonstrating each use case
     (the OAuth flow, a member post, and how the resulting analytics are shown
     in your app).
- There is **no fixed timeline**, and a rejection usually concerns how the use
  case is described rather than the code. If rejected you must create a **new**
  app to re-apply — you cannot re-apply with the same one.

**Practical consequence for Zybble.** Until this is granted:

- keep `LINKEDIN_ANALYTICS_SCOPE_ENABLED=false`;
- the app requests only `openid profile email w_member_social`;
- `GET /api/linkedin/accounts` reports `capabilities.analytics: false` with a
  human-readable blocker, and the analytics UI shows a gated empty state
  instead of fabricated numbers;
- publishing still works.

> **Do not enable the analytics scope before approval.** Requesting an
> unapproved scope aborts the entire consent screen for every scope, which would
> break connecting accounts for all users, not just analytics.

When approval lands:

```bash
# In Vercel → Settings → Environment Variables
LINKEDIN_ANALYTICS_SCOPE_ENABLED=true
```

Then **every existing connection must be re-authorised** — scopes are only
granted at consent time, so old tokens keep their old scope set.

### D.4 Verify access

```bash
curl -s https://zybble.app/api/health | jq '.analyticsScopeEnabled, .checks.linkedin'
```

Then connect a real account through **Settings → LinkedIn** and confirm:

- the consent screen lists `w_member_social`;
- `linkedin_account_secrets` contains a value beginning `v1.` (AES-256-GCM
  ciphertext) and **never** a raw token;
- `GET /api/linkedin/accounts` shows `status: "active"` and
  `capabilities.canPublish: true`.

### D.5 Development vs production differences to expect

| Behaviour | Development tier | Standard tier |
| --- | --- | --- |
| Rate limits | Lower (LinkedIn publishes per-product ceilings, e.g. hundreds of calls per app per day) | Raised |
| Analytics scope | Often unavailable | Available after review |
| Tokens | Same OAuth flow | Same OAuth flow |

LinkedIn issues **refresh tokens selectively** — Zybble assumes neither a
refresh token nor a permanent access token. `token_expires_at` is tracked, a
daily job warns 7 days before an unavoidable expiry, and an expired connection
blocks publishing with a **Reconnect LinkedIn** prompt rather than failing at
the API. Where a refresh token *is* issued it is used and rotated.

There is **no scraping and no browser automation** anywhere in this codebase.

### D.6 API version pinning

`LINKEDIN_API_VERSION` is pinned (`YYYYMM`) and sent on every request as
`Linkedin-Version`, alongside `X-Restli-Protocol-Version: 2.0.0`. LinkedIn
sunsets versions — the Marketing version `202511` retires **2026-11-16**. Check
the version you pin against LinkedIn's release notes before that date and
re-test after changing it.

---

## E. Inngest setup

### E.1 Create the app

1. Create an account at [app.inngest.com](https://app.inngest.com).
2. Create an app for the **production** environment.

### E.2 Keys

| Key | Variable | Purpose |
| --- | --- | --- |
| Signing key | `INNGEST_SIGNING_KEY` | Proves a request to `/api/inngest` came from Inngest |
| Event key | `INNGEST_EVENT_KEY` | Authenticates `inngest.send()` from your app |

Grab them from **Production → Manage → Signing key** and **… → Event keys**.

> **Never set `INNGEST_DEV` in production.** It disables signature
> verification.

The easiest path is Inngest's **Vercel integration**, which sets both variables
and re-syncs your functions on every deploy. If you configure it manually you
must sync after each deploy:

```bash
curl -X PUT https://zybble.app/api/inngest
```

### E.3 Deploy and verify

After the first production deploy:

```bash
# 1. The serve handler reports its own configuration.
curl -s https://zybble.app/api/inngest
# Expect hasSigningKey: true, hasEventKey: true, mode: "cloud"

# 2. Inngest Cloud → Apps shows your app with a green status and a recent sync.
# 3. Inngest Cloud → Functions lists all 17 functions.
```

The registered functions are:

| Function | Trigger |
| --- | --- |
| `publish-scheduled-post` | event `post/publish.requested` |
| `dispatch-due-posts` | cron `* * * * *` |
| `reconcile-stuck-publishes` | cron `*/15 * * * *` |
| `sync-post-analytics` | event `analytics/post.sync` |
| `sync-workspace-analytics` | event `analytics/workspace.sync` |
| `recompute-best-time` | event `analytics/best-time.recompute` |
| `nightly-analytics-sync` | cron `0 3 * * *` |
| `check-linkedin-connections` | cron `0 6 * * *` |
| `post-failure-digest` | cron `0 9 * * *` |
| `reconcile-subscriptions` | cron `17 4 * * *` |
| `notify-post-published`, `notify-post-failed`, `send-post-reminder`, `send-transactional-email`, `sync-workspace-seats`, `cancel-subscription-on-delete`, `delete-workspace` | events |

### E.4 Verify retries and scheduling

1. **Inngest Cloud → Send event** → send `analytics/best-time.recompute` with a
   real `workspaceId` and `linkedinAccountId`. Confirm the run succeeds in the
   **Runs** tab.
2. Schedule a post two minutes out in the app, close the browser, and confirm it
   publishes. This proves scheduling works without an open tab.
3. Point `LINKEDIN_CLIENT_SECRET` at an invalid value in a staging environment
   and confirm `publish-scheduled-post` retries and then marks the post
   `failed` with a reason — not `published`.

### E.5 Fallback if Inngest is unavailable

With `INNGEST_EVENT_KEY` unset, `inngest.send()` is a no-op and
`GET /api/cron/run` (Bearer `CRON_SECRET`) performs the same sweep.
`vercel.json` registers that cron every 5 minutes as a safety net. The app
reports `publishJobQueued: false` when it could not enqueue, so the UI never
implies a run that does not exist.

---

## F. Dodo Payments setup

### F.1 Create the Pro product

In the Dodo dashboard, create **one** paid product:

| Field | Value |
| --- | --- |
| Name | Zybble Pro |
| Price | **$15.00 USD** |
| Billing interval | **Monthly** |
| Pricing model | Per unit (quantity = seats) |

Copy the product ID (`pdt_…`) into `DODO_PRO_PRODUCT_ID`.

> Do not create extra plans, an annual tier, or a trial. The entitlement model
> in `src/features/billing/entitlements.ts` is pinned to Free and this single
> Pro product; adding a plan requires extending that module and its tests.

**Seat definition (exact):** one seat = one **active** member of the workspace,
with a floor of one. Pending invitations are not billed; removed members stop
being billed. The count is always computed server-side from `workspace_members`
and is never taken from a request.

### F.2 Test mode first

Dodo has two completely separate environments:

| | Test mode | Live mode |
| --- | --- | --- |
| API host | `test.dodopayments.com` | `live.dodopayments.com` |
| Checkout host | `test.checkout.dodopayments.com` | `checkout.dodopayments.com` |
| API key | Test key | Live key |
| Webhook secret | Test endpoint secret | Live endpoint secret |
| Product IDs | Test product IDs | Live product IDs |

**Everything must come from the same mode.** Mixing a test key with a live
product ID is the most common reason a Dodo integration "doesn't work".

Start with:

```bash
DODO_PAYMENTS_ENVIRONMENT=test_mode
```

### F.3 Configure the webhook

1. **Dashboard → Webhooks → Add endpoint**
2. URL: `https://zybble.app/api/webhooks/dodo`
3. Subscribe to:
   - `subscription.active`
   - `subscription.renewed`
   - `subscription.plan_changed`
   - `subscription.cancelled`
   - `subscription.failed`
   - `subscription.on_hold`
   - `payment.succeeded`
   - `payment.failed`
4. Copy the **signing secret** (starts with `whsec_`) into
   `DODO_PAYMENTS_WEBHOOK_KEY`.

Zybble verifies the **Standard Webhooks** signature: HMAC-SHA256 over
`{webhook-id}.{webhook-timestamp}.{raw body}`, compared in constant time, with a
5-minute timestamp tolerance. Two operational consequences:

- **The raw body must reach the handler unmodified.** The route reads it with
  `req.text()` before parsing; do not add body-parsing middleware in front of it.
- **Server clock must be accurate.** A clock skewed by more than five minutes
  rejects every valid webhook.

### F.4 Test the subscription lifecycle

Run the full loop in test mode before touching live mode:

```bash
# Forward real test-mode webhooks to your local server (preserves signatures)
dodo login          # select Test Mode
dodo wh listen      # forwards to http://localhost:3000/api/webhooks/dodo
```

1. Start checkout from **Settings → Billing** → complete with a test card.
2. Confirm `subscription.active` arrives and the workspace flips to Pro.
3. Replay the same event from the dashboard → confirm it is ignored (the
   `webhook_events.event_id` unique constraint is the dedupe; see
   `tests/webhooks/dodo-processing.test.ts`).
4. Cancel → confirm the workspace keeps Pro until `current_period_end`, then
   reverts automatically (`effectivePlan()` is expiry-aware).
5. `POST /api/billing/seats` → confirm the quantity changes to the active member
   count.

### F.5 Go live

1. Switch the dashboard to **Live mode**.
2. Create the product again in live mode and copy the **live** product ID.
3. Create the live webhook endpoint and copy the **live** signing secret.
4. Update all four variables together: `DODO_PAYMENTS_API_KEY`,
   `DODO_PAYMENTS_WEBHOOK_KEY`, `DODO_PAYMENTS_ENVIRONMENT=live_mode`,
   `DODO_PRO_PRODUCT_ID`.
5. Make a real purchase with your own card and refund it.

Live payouts require Dodo's account verification (business profile, KYC, bank
details). Start that early — it is independent of this codebase.

### F.6 Billing management

`POST /api/billing/portal` creates a Dodo customer-portal session for
self-serve card and invoice management. The customer ID is read from our own
`subscriptions` row; the browser never supplies one. If the portal is not
available on your account, the documented fallback is the API-driven flow under
`/api/billing/cancel` and `/api/billing/seats`.

---

## G. Resend setup

### G.1 Add the domain

1. **Resend → Domains → Add domain**
2. Choose a region close to your users (`us-east-1`, `eu-west-1`,
   `sa-east-1`, `ap-northeast-1`).
3. Resend shows the exact DNS records to add. Copy them **exactly** — extra
   quotes, truncated values or added spaces are the usual cause of a stalled
   verification.

Typical record set:

| Type | Host | Purpose |
| --- | --- | --- |
| TXT or CNAME | `send` (or as shown) | SPF — authorises the sending infrastructure |
| CNAME | `<token>._domainkey` (three of them) | DKIM |
| MX | `send` | Return path — routes bounces and complaints back to Resend |
| CNAME | `links` | Optional: branded open/click tracking |

> If you use Cloudflare, **turn off proxying (grey cloud)** for these records —
> an orange cloud prevents verification.

### G.2 Wait, then verify

Verification usually completes within about 15 minutes and can take up to 72
hours globally. Check the records yourself first:

```bash
dig +short TXT  send.zybble.app
dig +short MX   send.zybble.app
dig +short CNAME <token>._domainkey.send.zybble.app
```

If it has not verified after 24 hours, use **Restart verification** in the
dashboard or `dns.email` to confirm the records are publicly visible.

### G.3 Add DMARC (after verification)

DMARC is not required to send, but publish it — it materially improves
deliverability and stops spoofing:

```
_dmarc.zybble.app   TXT   v=DMARC1; p=none; rua=mailto:dmarc@zybble.app;
```

Start at `p=none` and read the aggregate reports. Once every legitimate sender
passes, tighten to `p=quarantine`, then `p=reject`.

### G.4 API key and sender

1. **Resend → API Keys → Create** → copy into `RESEND_API_KEY`.
2. Set `EMAIL_FROM` to an address on the **verified** domain, e.g.
   `Zybble <no-reply@zybble.app>`.
3. Optionally set `EMAIL_REPLY_TO` (e.g. `support@zybble.app`).

### G.5 Test every template

Twelve templates ship in `src/features/notifications/email.ts`: `welcome`,
`email_verification`, `password_reset`, `linkedin_connected`,
`linkedin_reauth_required`, `post_published`, `post_failed`, `post_reminder`,
`subscription_confirmed`, `payment_failed`, `subscription_cancelled`,
`team_invitation`.

Send each one to a **mailbox you control** before launch. Preferences in
`notification_preferences` are honoured per user; `welcome` and
`team_invitation` are transactional and always sent.

---

## H. Vercel setup

### H.1 Import the repository

1. **Vercel → Add New → Project → Import** the GitHub repository.
2. Framework preset: **Next.js** (detected automatically).
3. Build command: `npm run build` (from `vercel.json`).
4. Install command: `npm ci`.
5. Node version: **22** (**Settings → General → Node.js Version**).

### H.2 Environments

| Environment | Branch | Purpose |
| --- | --- | --- |
| Production | `main` | Live users |
| Preview | every other branch and PR | Review; uses preview-scoped variables |
| Development | local | `vercel env pull` |

Configure the **Production branch** as `main` under
**Settings → Git → Production Branch**.

### H.3 Add environment variables

**Settings → Environment Variables.** Add every variable from
[section I](#i-environment-variables), scoping each to the right environment:

- `NEXT_PUBLIC_*` — set for Production, Preview and Development.
- Server secrets — Production and (if you have a staging project) Preview.
- **Never** put a production secret in a Preview scope that untrusted
  contributors can reach.

Use different Supabase and Dodo projects for staging and production. Do not
point previews at the production database.

> Variables are read **lazily at request time** (`src/lib/env.ts`), so nothing
> is baked into the build. You still must **redeploy** after adding a variable —
> Vercel does not retro-apply it to an existing deployment.

### H.4 Connect the domain

1. **Settings → Domains → Add** `zybble.app` and `www.zybble.app`.
2. Add the A/ALIAS (or nameserver) records Vercel shows.
3. Vercel issues and renews the TLS certificate automatically; verify at
   `https://zybble.app` shows a valid certificate.
4. Set `NEXT_PUBLIC_SITE_URL=https://zybble.app` to match — it is used for
   OAuth redirects, email links and canonical URLs.

### H.5 Deploy

```bash
git push origin main        # production
git push origin feature/x   # preview
```

Or manually:

```bash
vercel --prod
vercel rollback            # revert to the previous deployment
```

### H.6 The `/api/cron/run` safety net (optional, Pro and above)

Inngest is the scheduler of record — it runs `dispatch-due-posts` every minute,
reconciles stuck publishes every 15 minutes, and drives the daily sweeps. If
Inngest is ever unavailable, `GET /api/cron/run` performs the same sweep on
demand. It verifies `Authorization: Bearer $CRON_SECRET` in constant time and
**fails closed** when `CRON_SECRET` is unset, so an unconfigured deployment
never exposes an unauthenticated job runner.

**Scheduling it with Vercel Cron requires a Pro or Enterprise plan.** Vercel's
own limits:

| Plan | Minimum interval | Precision |
| --- | --- | --- |
| Hobby | **Once per day** | Within the scheduled hour |
| Pro | Once per minute | Within the minute |
| Enterprise | Once per minute | Within the minute |

A cron expression more frequent than daily **fails the deployment** on Hobby
with *"Hobby accounts are limited to daily cron jobs"*. For that reason
`vercel.json` intentionally ships **without** a `crons` block — the config must
never be the reason a deployment fails.

Once the project is on Pro (which it must be — see the plan note at the top of
this document), add it back:

```json
{
  "crons": [{ "path": "/api/cron/run", "schedule": "*/5 * * * *" }]
}
```

Then redeploy and confirm under **Settings → Cron Jobs**.

Until then, invoke the sweep manually when you need it:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://zybble.app/api/cron/run
```

Note also that Vercel Cron runs against **production deployments only** — never
previews — and does not retry a failed invocation.

---

## I. Environment variables

Complete list, taken from `src/lib/env.ts` and `.env.example`. **Never commit
real values.**

### I.1 Public — safe to ship to the browser

These are inlined into the client bundle. They are safe by design: RLS, not the
key, is the security boundary.

```env
# Absolute origin (no trailing slash). Used for OAuth redirects, email links,
# canonical URLs and the sitemap.
NEXT_PUBLIC_SITE_URL=https://zybble.app

# Supabase project URL and publishable (anon) key.
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOi...
```

### I.2 Server-only secrets

None of these may ever carry a `NEXT_PUBLIC_` prefix.

```env
# --- Supabase -------------------------------------------------------------
# Bypasses RLS. Webhooks and background jobs only. Never import into a component.
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
# Pooled connection (port 6543) in production. Required for transactional SQL
# (webhook claim, publish claim) and for the shared rate-limit counters.
DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
# Optional: max connections in the SQL pool (default 5).
DATABASE_POOL_MAX=5

# --- Application ---------------------------------------------------------
# Optional override for links in transactional email (defaults to NEXT_PUBLIC_SITE_URL).
APP_URL=https://zybble.app

# --- LinkedIn -------------------------------------------------------------
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
# Must be registered in the LinkedIn portal exactly, including the path.
LINKEDIN_REDIRECT_URI=https://zybble.app/api/linkedin/callback
# Pinned API version, YYYYMM. Check sunset dates before changing.
LINKEDIN_API_VERSION=202604
# true ONLY after Community Management API approval. Requesting the scope
# without approval breaks the consent screen for every scope.
LINKEDIN_ANALYTICS_SCOPE_ENABLED=false

# --- Inngest -------------------------------------------------------------
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
# Never set INNGEST_DEV in production (it disables signature verification).
# INNGEST_DEV=true

# --- Dodo Payments -------------------------------------------------------
DODO_PAYMENTS_API_KEY=
DODO_PAYMENTS_WEBHOOK_KEY=whsec_...
DODO_PAYMENTS_ENVIRONMENT=live_mode
DODO_PRO_PRODUCT_ID=pdt_...
# Optional seat add-on product, only if you model seats as an add-on.
# DODO_PRO_SEAT_ADDON_ID=
# prorated_immediately | full_immediately | difference_immediately |
# do_not_bill | prorated_immediately_keep_cycle
DODO_SEAT_PRORATION_MODE=difference_immediately

# --- Resend --------------------------------------------------------------
RESEND_API_KEY=
EMAIL_FROM=Zybble <no-reply@zybble.app>
# EMAIL_REPLY_TO=support@zybble.app

# --- Security ------------------------------------------------------------
# 32 random bytes, base64. Encrypts LinkedIn tokens (AES-256-GCM).
# Generate with: openssl rand -base64 32
TOKEN_ENCRYPTION_KEY=
# Previous key, kept only during a rotation window.
# TOKEN_ENCRYPTION_KEY_PREVIOUS=
# Bearer token for GET /api/cron/run and the Vercel Cron job.
CRON_SECRET=
```

### I.3 Optional test-only variables

Used by the E2E suite, never by the application:

```env
E2E_REAL_BACKEND=1      # enable the authenticated E2E suites
E2E_LINKEDIN_LIVE=1     # allow tests that publish to a real account (dangerous)
E2E_ANALYTICS_SCOPE=1   # assert that r_member_postAnalytics is requested
E2E_BASE_URL=https://staging.zybble.app
```

### I.4 Quick audit

```bash
# Nothing that is not NEXT_PUBLIC_ may appear in a client bundle.
npm run build && grep -rl "SERVICE_ROLE\|TOKEN_ENCRYPTION_KEY\|DODO_PAYMENTS_API_KEY" .next/static || echo "clean"
```

---

## J. Production database migration

### J.1 Before you migrate

1. Take a **manual backup** (Supabase → Database → Backups → take a snapshot if
   your plan allows) or confirm today's automatic backup exists.
2. Rehearse on a **clone**: **Database → Backups → Restore to a new project**,
   then `supabase db push` against the clone.
3. Read the migration diff and classify it:
   - additive (new table/column, new index) → safe;
   - backfill (writes data) → can lock; run in batches outside peak hours;
   - destructive (drop column/table, tighten a constraint) → needs a two-phase
     deploy (see J.4).

### J.2 Apply

```bash
supabase db push --dry-run      # review the SQL
supabase db push                # apply
```

### J.3 Verify

```sql
-- Applied, in order, with no gaps.
select version from supabase_migrations.schema_migrations order by version;

-- RLS is still on everywhere (every row must be true).
select count(*) filter (where not rowsecurity) as rls_disabled
from pg_tables where schemaname = 'public';

-- No table lost its policies.
select t.tablename
from pg_tables t
left join pg_policies p on p.tablename = t.tablename and p.schemaname = 'public'
where t.schemaname = 'public' and p.tablename is null;
```

Then hit `GET /api/health` and confirm `checks.supabase` and
`checks.databaseUrl` are `true`, and sign up a throwaway account to prove the
auth → profile → workspace path still works.

### J.4 Roll back

**Rolling back application code is easy. Rolling back a schema is not.**

```bash
vercel rollback     # reverts the deployment; safe, instant
```

For the schema:

1. **Preferred:** write a *forward* migration that undoes the change:
   ```bash
   supabase migration new rollback_add_column_x
   # edit the generated file, then:
   supabase db push
   ```
   Never edit an already-applied migration file — the checksum in
   `schema_migrations` will not match.
2. **For data loss:** restore the affected rows from a backup restored to a
   **new** project and copy them across. Do not restore over the live database.
3. **For PITR:** choose the moment immediately before the migration.

Order matters: if the new code cannot run against the old schema, roll back the
**code first**, then the schema.

---

## K. Post-deployment smoke testing

Work through this in order. Each item can fail independently.

### K.1 Public surface (no credentials needed)

```bash
curl -s https://zybble.app/api/health | jq .
curl -sI https://zybble.app/           | grep -i "x-content-type\|x-frame\|referrer"
curl -s  https://zybble.app/robots.txt
curl -s  https://zybble.app/sitemap.xml | head -5
```

- [ ] Homepage, pricing, blog, privacy, terms all return 200 with one `<h1>` each
- [ ] `robots.txt` lists the sitemap and disallows `/dashboard`, `/settings`, `/api/`
- [ ] `sitemap.xml` contains no authenticated routes
- [ ] `/dashboard` redirects an anonymous visitor to `/login`
- [ ] Security headers present on every response

### K.2 Authentication

- [ ] Sign up with a real address → confirmation email arrives
- [ ] Click the link → land on `/onboarding`
- [ ] Create the workspace → land on `/dashboard`
- [ ] Log out → `/dashboard` redirects to `/login`
- [ ] Request a password reset → email arrives → set a new password → sign in
- [ ] Confirm `auth.users` and `public.profiles` both have the row

### K.3 LinkedIn

- [ ] **Settings → LinkedIn → Connect** → consent screen lists `w_member_social`
- [ ] Callback completes; the account shows `active`
- [ ] `linkedin_account_secrets` holds `v1.…` ciphertext, never a raw token
- [ ] Publish a **text** post → it appears on the real feed, with a permalink
- [ ] Publish an **image**, a **document** and a **video** post (video takes
      longest — Zybble waits for LinkedIn to finish processing before
      referencing the asset)
- [ ] Schedule a post 5 minutes out, **close the browser**, confirm it publishes
- [ ] Reschedule it, then cancel it, confirming only one post appears
- [ ] Revoke the app from the LinkedIn member's account → confirm the UI shows a
      reconnect prompt rather than a silent failure

### K.4 Analytics

- [ ] `GET /api/analytics?range=7d` returns real impressions/reactions/comments/reposts
- [ ] Best-time grid shows an **insufficient data** state until ≥ 12 observations
- [ ] With Pro, `range=12m` works and returns 365 days of history
- [ ] On Free, `range=12m` is refused or shortened — never served as paid data

### K.5 Billing

- [ ] Start checkout in **test mode** → complete → `subscription.active` arrives
- [ ] Workspace flips to Pro; entitlements change (5 accounts, unlimited
      scheduling, 12-month analytics, best-time)
- [ ] Replay the same webhook → no duplicate effect
- [ ] Cancel → Pro retained until period end, then automatic downgrade
- [ ] Invite a member → seat count and Dodo quantity both increase
- [ ] Remove them → both decrease
- [ ] Then repeat once in **live mode** with your own card, and refund it

### K.6 Email

Send each of the twelve templates to a mailbox you control and confirm
rendering, subject and plain-text alternative.

### K.7 Inngest

- [ ] All 17 functions appear in Inngest Cloud → Functions
- [ ] `dispatch-due-posts` runs every minute without errors
- [ ] A deliberately failing publish retries and then marks the post `failed`

---

## L. Monitoring

### L.1 Application errors

Structured JSON logs are emitted by `src/lib/logger.ts` with a request-scoped
`requestId`. View them under **Vercel → your project → Logs**, or:

```bash
vercel logs --follow
```

Events worth alerting on:

| Event | Meaning |
| --- | --- |
| `linkedin.publish_failed` | A post did not publish |
| `webhook.processing_failed` | Dodo event could not be applied (it will retry) |
| `seats.push_failed` | Local and Dodo seat counts have diverged |
| `posts.schedule_failed` | A post is scheduled but no run was queued |
| `email.send_failed` | Resend rejected or failed a send |
| `rate_limit.primary_unavailable` | Postgres limiter down; degraded to per-instance |
| `auth.unmapped_error` | A provider error string we did not recognise (logged, not shown) |

### L.2 Inngest job failures

**Inngest Cloud → Runs** shows every run, retry and failure with a full trace.
Alert on any function whose failure rate rises. `reconcile-subscriptions` and
`check-linkedin-connections` are daily sweep jobs — a gap in their run history
means the cron sync is broken.

### L.3 Supabase

- **Database → Backups** — confirm the daily backup ran.
- **Reports** — watch for slow queries; the hot paths are
  `posts(workspace_id, scheduled_at)` and `post_analytics(post_id)`.
- **Logs → Postgres** — watch for permission errors, which indicate a policy
  problem rather than an application bug.
- Set up **Database → Advisors** and resolve anything flagged as a security
  issue.

### L.4 Payment webhooks

Dodo's dashboard shows delivery attempts, response codes and lets you replay
events. Watch for:

- repeated 5xx responses → our handler is failing; check
  `webhook_events.status = 'failed'` for the stored error;
- `unmatched` events → an event arrived for a workspace that no longer exists
  (stored deliberately so Dodo stops retrying).

### L.5 Email delivery

Resend's dashboard shows delivered, bounced and complained events per email.
Watch bounce rate above ~2% — it usually means list quality or a DNS problem.
DMARC aggregate reports (`rua=`) tell you whether anything is spoofing your
domain.

### L.6 Health endpoint

`GET /api/health` returns a boolean per integration and always answers 200.
`ok: false` means a core integration (Supabase or token encryption) is missing.
Point an external uptime check at it.

---

## M. Rollback and recovery

### M.1 Roll back a deployment

```bash
vercel ls                       # find the previous good deployment
vercel rollback <deployment-url>
```

Or in the dashboard: **Deployments → … → Promote to Production** on a known-good
build. This is the fastest mitigation for a bad release and takes seconds.

### M.2 Recover from a failed migration

See [J.4](#j4-roll-back). Summary: roll the **code** back first, fix the schema
with a **forward** migration, and restore rows from a backup restored to a
**separate** project.

### M.3 Handle failed scheduled jobs

| Symptom | Action |
| --- | --- |
| Post stuck in `scheduled` past its time | `dispatch-due-posts` re-enqueues every minute; if it persists, check Inngest is synced (`curl -X PUT /api/inngest`) |
| Post stuck in `publishing` | `reconcile-stuck-publishes` resolves it as `UNKNOWN_OUTCOME` — the user must confirm against their feed before retrying, because a blind retry could double-post |
| Post `failed` with a retryable reason | The user can retry from the UI; a new attempt number is used, so the claim ledger never sees a duplicate |
| Job failed but the post published | Mark the post published manually; never auto-retry an `UNKNOWN_OUTCOME` |

### M.4 Rotate a compromised secret

| Secret | Rotation procedure |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → **Reset** the service-role key; update Vercel; redeploy. Nothing else stores it. |
| `TOKEN_ENCRYPTION_KEY` | Set `TOKEN_ENCRYPTION_KEY_PREVIOUS` to the current value and `TOKEN_ENCRYPTION_KEY` to the new one, redeploy, then run a re-encrypt job over `linkedin_account_secrets`. Only clear `…_PREVIOUS` once every row reads with the new key. The AAD binding (workspace + account id) means ciphertext cannot be moved between rows. |
| `INNGEST_SIGNING_KEY` | Inngest supports `INNGEST_SIGNING_KEY_FALLBACK` during rotation; set both, redeploy, then remove the fallback. |
| `DODO_PAYMENTS_WEBHOOK_KEY` | Rotate the endpoint secret in the Dodo dashboard, update Vercel, redeploy. Keep the old secret until in-flight retries drain. |
| `LINKEDIN_CLIENT_SECRET` | Regenerate in the developer portal; update Vercel; redeploy. Existing tokens stay valid. |
| `RESEND_API_KEY` | Create a new key, update Vercel, redeploy, then delete the old key. |
| `CRON_SECRET` | Generate a new value; update Vercel; redeploy. |

After any rotation, redeploy — Vercel does not apply a changed variable to an
existing deployment.

### M.5 Restore from backup

1. **Database → Backups**.
2. Prefer **Restore to a new project** — non-destructive, and lets you copy out
   just the rows you need.
3. Restoring over the live project is a last resort and is destructive.
4. Storage objects are **not** included in a database restore. Media in
   `post-media` must be restored separately (or is lost, in which case posts
   lose their attachments but keep their text and analytics).

### M.6 Reconnect expired LinkedIn integrations

LinkedIn access tokens expire and refresh tokens are not issued for every app
configuration, so expiry is a normal product state:

1. `check-linkedin-connections` runs daily at 06:00 UTC, refreshes what it can,
   and warns the workspace **7 days** before an unavoidable expiry.
2. Accounts LinkedIn rejects are flipped to `reauth_required` and stop being
   used for publishing.
3. The user reconnects through **Settings → LinkedIn → Reconnect**, which re-runs
   the normal OAuth flow. Scopes are granted at consent time — so if you have
   just enabled `r_member_postAnalytics`, every existing connection must be
   re-authorised to pick it up.

---

## N. Launch checklist

### N.1 Accounts and compliance

- [ ] Vercel on a **Pro** (or Enterprise) plan — Hobby is not licensed for commercial use
- [ ] Supabase on a **Pro** plan with daily backups enabled
- [ ] PITR enabled (if the RPO requires it) and a restore rehearsed on a clone
- [ ] Dodo Payments account verification submitted for live payouts
- [ ] Resend domain verified, DMARC published
- [ ] LinkedIn app linked to a verified Company Page
- [ ] Community Management API access applied for (Development tier, then Standard)
- [ ] Privacy policy and terms published and reviewed by a lawyer
- [ ] Legal pages' "pending owner review" markers removed once reviewed

### N.2 Code and CI

- [ ] `npm run lint` clean
- [ ] `npm run typecheck` clean
- [ ] `npm test` green (unit, integration, RLS isolation, webhook)
- [ ] `npm run build` succeeds
- [ ] `npm audit --omit=dev` shows no high or critical advisories
- [ ] GitHub Actions green on `main`
- [ ] Branch protection enabled on `main` with required status checks
- [ ] No secret in the repository history

### N.3 Configuration

- [ ] Every variable in [section I](#i-environment-variables) set in Vercel **Production**
- [ ] Preview environment uses a **separate** Supabase project and Dodo test mode
- [ ] `NEXT_PUBLIC_SITE_URL` matches the real domain
- [ ] `LINKEDIN_REDIRECT_URI` matches the portal entry byte for byte
- [ ] `CRON_SECRET` set (otherwise `/api/cron/run` fails closed)
- [ ] `INNGEST_DEV` **not** set in production
- [ ] `DODO_PAYMENTS_ENVIRONMENT=live_mode` and all four Dodo values from live mode
- [ ] Migrations applied to production and verified ([J.3](#j3-verify))

### N.4 Functional verification

- [ ] Every box in [section K](#k-post-deployment-smoke-testing) ticked
- [ ] One real post published to a real member account
- [ ] One real payment taken and refunded
- [ ] One real email from each critical template received
- [ ] Cross-tenant isolation proven against the production deployment
- [ ] Publishing failure path exercised (e.g. revoked permission) and shown to
      the user correctly

### N.5 Operational readiness

- [ ] Uptime check pointed at `/api/health`
- [ ] Log alerting on `linkedin.publish_failed`, `webhook.processing_failed`, `seats.push_failed`
- [ ] Inngest failure alerts configured
- [ ] Secret rotation runbook read and the owners named
- [ ] Rollback rehearsed once (`vercel rollback` on a preview)
- [ ] A documented support channel for users whose posts fail

### N.6 Known blockers to resolve before launch

- [ ] `w_member_social` confirmed **approved** on the production LinkedIn app
- [ ] Community Management API (`r_member_postAnalytics`) approved — or analytics
      explicitly shipped as capability-gated
- [ ] LinkedIn API version verified against the current sunset schedule
- [ ] Resend sending domain verified
- [ ] Dodo live-mode product and webhook created
- [ ] Production Postgres rate limiter confirmed active (`DATABASE_URL` set)
