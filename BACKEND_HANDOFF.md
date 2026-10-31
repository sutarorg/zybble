# Zybble — Backend handoff

**Status: backend complete and tested. Not yet verified against live external
credentials.** This document is the handoff for the next prompt: exactly what is
integrated, which credentials and permissions each integration needs, what has
been proven, and the blockers that remain before this can be called a working
production system.

---

## 1. What is done

| Area | State |
| --- | --- |
| Postgres schema, 10 ordered migrations, RLS, triggers, storage | ✅ Complete |
| Typed database access (`database.types.ts`) | ✅ Complete |
| Auth: signup, login, logout, reset, email confirmation, onboarding, erasure | ✅ Complete |
| Workspaces: create, switch, rename, members, invitations, roles | ✅ Complete |
| LinkedIn: OAuth (state/CSRF), encrypted token storage, expiry tracking, reconnect | ✅ Complete |
| LinkedIn: publishing (text / image / multi-image / video / document) | ✅ Complete — needs live verification |
| LinkedIn: member post analytics + best-time engine | ✅ Complete — **gated behind a pending permission** |
| Inngest: 14 durable functions, cron + event triggers, idempotent publishing | ✅ Complete |
| Dodo Payments: checkout, seats, portal, cancellation, signed webhooks | ✅ Complete — needs live verification |
| Resend: 12 templates, preference gating, failure handling | ✅ Complete — needs a verified sending domain |
| API surface: 44 route handlers, Zod, rate limits, one envelope | ✅ Complete |
| Observability: structured logs, redaction, audit trail, `/api/health` | ✅ Complete |

**Local verification status:** `tsc --noEmit` clean · `eslint .` clean ·
`next build` succeeds (every app page prerenders; API routes are dynamic) · `vitest run` → **15 files, 204 tests
passing**, including real-Postgres RLS isolation tests and webhook signature
tests. No network calls are made by the suite.

---

## 2. Integrations: exactly what is used

### 2.1 Supabase (Postgres + Auth + Storage)

**What we use**

* Postgres with RLS as the tenant boundary.
* Supabase Auth with `@supabase/ssr` cookie sessions, refreshed on every request.
* One private storage bucket, `post-media`.
* The service-role client **server-side only**, in webhooks and background jobs.

**Credentials**

| Variable | Where to find it | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API | Safe to ship |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project Settings → API | Publishable/anon key; safe to ship *because RLS is the boundary* |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API | **Server only.** Bypasses RLS — never import into a client component |
| `DATABASE_URL` | Project Settings → Database → Connection string | Pooled (port 6543) in production; used by the transactional paths (webhook claim, publish claim) |

**Setup steps**

1. Apply migrations in order (`supabase/migrations/0001…0010`) with the Supabase
   CLI: `supabase db push`, or `supabase migration up` against the project.
2. Create the `post-media` bucket if `0009_storage.sql` failed to (the migration
   is idempotent but the bucket create may be restricted on some plans).
3. In **Authentication → URL Configuration**, add:
   * Site URL: `https://your-domain.com`
   * Redirect URLs: `https://your-domain.com/auth/callback`,
     `https://your-domain.com/reset-password`
4. Enable email confirmation in **Authentication → Providers → Email**.
5. Confirm ** leaked password protection** and SMTP are configured (dashboard
   settings, not code).

**Not verified against a live project.** Migrations are validated against PGlite
in `tests/db/migrations.test.ts`, which catches ordering and syntax problems but
not plan-specific restrictions.

---

### 2.2 LinkedIn

**Endpoints called** (`src/lib/linkedin/config.ts`)

| Purpose | Endpoint |
| --- | --- |
| Authorization | `https://www.linkedin.com/oauth/v2/authorization` |
| Token exchange | `https://www.linkedin.com/oauth/v2/accessToken` |
| Identity (OpenID) | `https://api.linkedin.com/v2/userinfo` |
| Create posts | `https://api.linkedin.com/rest/posts` |
| Register/upload media | `/rest/images`, `/rest/videos`, `/rest/documents` |
| Post analytics | `https://api.linkedin.com/rest/memberCreatorPostAnalytics` |

Every request sends `Linkedin-Version: $LINKEDIN_API_VERSION` and
`X-Restli-Protocol-Version: 2.0.0`, both of which LinkedIn requires.

**Permissions**

| Scope | Needed for | Status |
| --- | --- | --- |
| `openid`, `profile`, `email` | Identify the member | Granted by default with the product |
| `w_member_social` | **Publish posts as the member.** Hard requirement — without it the product cannot publish at all | Requires the *Share on LinkedIn* product; verify it is approved, not merely requested |
| `r_member_postAnalytics` | Read the member's own post analytics | **Requires Community Management API approval.** Off by default (`LINKEDIN_ANALYTICS_SCOPE_ENABLED=false`) because requesting an unapproved scope aborts the entire consent screen |

**Critical:** developer-portal access is **not** production access. The app must
be reviewed and the products approved for the production client id; the API
version in use must also not be past its sunset date (Marketing version `202511`
sunsets 2026‑11‑16, so pin and re-check before then).

**Credentials**

| Variable | Notes |
| --- | --- |
| `LINKEDIN_CLIENT_ID` | Developer portal → app → Auth |
| `LINKEDIN_CLIENT_SECRET` | Server only |
| `LINKEDIN_REDIRECT_URI` | Must be registered **exactly**: `https://your-domain.com/api/linkedin/callback` |
| `LINKEDIN_API_VERSION` | `YYYYMM`, pinned |
| `LINKEDIN_ANALYTICS_SCOPE_ENABLED` | `true` **only after** Community Management API approval |

**Token lifecycle, as implemented:** refresh tokens are issued selectively by
LinkedIn, so the code assumes neither a refresh token nor a permanent access
token. Expiry is tracked, a daily job warns at 14 days, and an expired
connection blocks publishing with a reconnect prompt. Where a refresh token *is*
present it is used and rotated. There is **no scraping and no browser
automation** anywhere in the codebase.

**Rate limits** are respected by backoff on 429 and by keeping the per-account
call volume low (analytics sync is batched per account, not per post).

**Not verified:** no live token has been exchanged, no post has been published to
a real member account, and analytics has never returned real data.

---

### 2.3 Inngest

14 durable functions in `src/inngest/functions/`, served from
`POST /api/inngest`:

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

**Credentials:** `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` (the latter
validates that requests to `/api/inngest` really came from Inngest).

**Degraded mode:** with `INNGEST_EVENT_KEY` unset, `inngest.send()` is a no-op
and `GET /api/cron/run` (Bearer `CRON_SECRET`) drives the same sweep. The app
reports `publishJobQueued: false` when it could not enqueue, so the UI never
implies a run that does not exist.

**Setup:** create the app in Inngest Cloud, set the serve URL to
`https://your-domain.com/api/inngest`, and copy the keys. Cron triggers are
declared in code, so nothing to configure in the dashboard.

---

### 2.4 Dodo Payments

**What we use:** hosted checkout sessions, subscription retrieval and
cancellation, seat quantity updates, the customer portal, and **Standard
Webhooks** for entitlement state.

**Product configuration**

* **Exactly one paid product.** Pro, **$15 per seat per month**, monthly
  billing interval. Quantity = billable seats.
* No annual plan. **No trial is configured**, so none is advertised — do not
  enable one without also implementing the trial state in `effectivePlan()`.
* `DODO_PRO_PRODUCT_ID` = the Pro product id (`pdt_…`).
* `DODO_SEAT_PRORATION_MODE` defaults to `difference_immediately`; change it
  only if finance wants different seat-change behaviour.

**Seat definition (exact):** one seat = one **active** member of the workspace,
floored at 1. Pending invitations are not billed; removed members stop being
billed. The count is always computed server-side from `workspace_members` — never
from a request.

**Credentials**

| Variable | Notes |
| --- | --- |
| `DODO_PAYMENTS_API_KEY` | Server only |
| `DODO_PAYMENTS_WEBHOOK_KEY` | `whsec_…`, from Dashboard → Webhooks → Secret |
| `DODO_PAYMENTS_ENVIRONMENT` | `test_mode` until you are live, then `live_mode` |
| `DODO_PRO_PRODUCT_ID` | The single Pro product |

**Webhook setup:** register `https://your-domain.com/api/webhooks/dodo` and
subscribe to `subscription.active`, `subscription.renewed`,
`subscription.plan_changed`, `subscription.cancelled`, `subscription.failed`,
`subscription.on_hold`, `payment.succeeded`, `payment.failed`. Verification is
HMAC-SHA256 over `{id}.{timestamp}.{body}` compared in constant time with a
timestamp tolerance; duplicates are deduped on `webhook_events.event_id`.

**Entitlements are never granted from the browser.** Checkout only starts a
session; `public.subscriptions` is written by verified webhooks and the
reconciler only.

**Not verified:** no live checkout session has been created, no real webhook
signature has been validated against Dodo's signer.

---

### 2.5 Resend

**Credentials:** `RESEND_API_KEY`, `EMAIL_FROM`
(e.g. `Zybble <no-reply@yourdomain.com>`), optional `EMAIL_REPLY_TO`.

**Hard requirement:** a **verified sending domain**. Without it every send
fails, and `EMAIL_FROM` must use that domain.

**Templates** (`src/features/notifications/email.ts`): `welcome`,
`email_verification`, `password_reset`, `linkedin_connected`,
`linkedin_reauth_required`, `post_published`, `post_failed`, `post_reminder`,
`subscription_confirmed`, `payment_failed`, `subscription_cancelled`,
`team_invitation`.

All user content is HTML-escaped. Delivery failures are counted and logged,
never fatal to the operation they report on.

---

## 3. Environment variables (complete)

```
# App
NEXT_PUBLIC_SITE_URL=            # absolute origin, no trailing slash
APP_URL=                         # optional override for email links

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # server only
DATABASE_URL=                    # pooled, port 6543 in production

# LinkedIn
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_REDIRECT_URI=           # .../api/linkedin/callback, registered exactly
LINKEDIN_API_VERSION=202604
LINKEDIN_ANALYTICS_SCOPE_ENABLED=false

# Inngest
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

# Dodo Payments
DODO_PAYMENTS_API_KEY=
DODO_PAYMENTS_WEBHOOK_KEY=       # whsec_...
DODO_PAYMENTS_ENVIRONMENT=test_mode
DODO_PRO_PRODUCT_ID=
DODO_SEAT_PRORATION_MODE=difference_immediately

# Resend
RESEND_API_KEY=
EMAIL_FROM=                      # verified sending domain

# Security
TOKEN_ENCRYPTION_KEY=            # openssl rand -base64 32
TOKEN_ENCRYPTION_KEY_PREVIOUS=   # during rotation only
CRON_SECRET=                     # Bearer for /api/cron/run
```

`GET /api/health` returns the `checks` object (always HTTP 200; `ok` covers
only the core — Supabase and token encryption), which is the fastest way to
spot a half-configured deploy.

---

## 4. Verification checklist before calling this production-ready

Do these in order; each one can fail independently.

1. **Migrations** — `supabase db push` against the real project, then
   `GET /api/health` shows `supabase: true`.
2. **Auth round trip** — sign up with a real address, receive the confirmation
   email, confirm, land on `/onboarding`, create a workspace. Then reset the
   password end to end.
3. **LinkedIn OAuth** — connect a real member account. Confirm the consent
   screen lists `w_member_social` and that the callback stores an encrypted
   token (`linkedin_account_secrets` should contain `v1.…`, never a raw token).
4. **Publishing** — publish one post of each type (text, image, multi-image,
   video, document) and confirm the URN comes back, the permalink works and the
   post lands. **This is where an unapproved `w_member_social` shows up.**
5. **Scheduling** — schedule a post 5 minutes out and let Inngest deliver it
   with the tab closed. Confirm exactly one post appears on LinkedIn, then
   reschedule and cancel another to prove the pending run is replaced.
6. **Analytics** — request Community Management API access; once approved set
   `LINKEDIN_ANALYTICS_SCOPE_ENABLED=true`, reconnect the account (the scope is
   only granted at consent time) and confirm real impressions/reactions/
   comments/reposts land in `post_analytics`.
7. **Billing** — run a real checkout with a test card in `test_mode`, confirm
   `subscription.active` arrives and flips the workspace to Pro, then cancel and
   confirm it reverts at period end. Replay a webhook and confirm the duplicate
   is ignored.
8. **Seats** — invite a member, confirm the seat count and the Dodo quantity
   increase; remove them and confirm it drops.
9. **Email** — verify the sending domain, then trigger each template at least
   once.
10. **Failure paths** — revoke the LinkedIn app from the member's account and
    confirm the UI shows the reconnect prompt rather than a silent failure;
    point `DODO_PAYMENTS_API_KEY` at an invalid value and confirm billing
    degrades to `provider_unavailable` rather than a 500.

---

## 5. Remaining launch blockers

Ordered by how much of the product they disable.

| # | Blocker | Impact | Owner action |
| --- | --- | --- | --- |
| 1 | **`w_member_social` not verified on the production LinkedIn app** | Without it the product cannot publish at all | Confirm the *Share on LinkedIn* product is **approved** (not just requested) for the production client id |
| 2 | **Community Management API access not granted** (`r_member_postAnalytics`) | Analytics and best-time stay capability-gated with a visible blocker | Apply for access; only then set `LINKEDIN_ANALYTICS_SCOPE_ENABLED=true` and reconnect accounts |
| 3 | **LinkedIn API version sunset** | `202511` retires 2026‑11‑16; calls fail after that | Pin a supported version in `LINKEDIN_API_VERSION` and re-test before the date |
| 4 | **Live Dodo product and webhook not configured** | No revenue, and Pro entitlements never activate | Create the single $15/seat Pro product, register the webhook URL, copy the signing secret |
| 5 | **Resend sending domain not verified** | Every transactional email fails | Add and verify the DNS records for the sending domain |
| 6 | **Inngest not connected in production** | Scheduled posts are not delivered; `/api/cron/run` is the stopgap | Create the Inngest app, set the serve URL, add the keys |
| 7 | **Postgres rate limiter not wired up** | Limits are per-instance only | Call `setApiRateLimiter(postgresRateLimiter(...))` at boot |
| 8 | **Supabase Auth hardening** (leaked-password protection, SMTP, MFA) | Account-takeover resistance is default-level | Dashboard configuration |
| 9 | **Token-encryption key rotation runbook** | Rotation is supported in code but undocumented operationally | Write the runbook: add `TOKEN_ENCRYPTION_KEY_PREVIOUS`, re-encrypt, retire |
| 10 | **No penetration test or dependency audit** | Unknown residual risk | Schedule before launch |

---

## 6. Notes for the next prompt

* **Do not add pricing plans, trials or analytics metrics.** The entitlement
  model in `src/features/billing/entitlements.ts` and the best-time engine in
  `src/features/analytics/best-time.ts` are both pinned to what is real; adding
  to either requires re-deriving the tests.
* **Do not reorganise the frontend.** The Prompt 1/2 pages are intact and wired
  to these APIs; `src/lib/app/types.ts` is the contract between them and the
  backend — change it there, not in the components.
* **The database is the source of truth.** Any new background work should follow
  the same pattern: claim with a unique constraint, do the work, record the
  outcome, and never report success for something that did not happen.
* Useful entry points: `src/features/**/service.ts` (business rules),
  `src/lib/api/http.ts` (route plumbing), `supabase/migrations/` (schema),
  `tests/` (behaviour, including the RLS isolation suite).
