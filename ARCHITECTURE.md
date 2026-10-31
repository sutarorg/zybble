# Zybble — Architecture

Zybble is a Next.js 16 App Router application with a real backend: Supabase
(Postgres + Auth + Storage), Inngest for durable work, Dodo Payments for
subscriptions, Resend for transactional email and the official LinkedIn
Community Management / Posts APIs for publishing and analytics.

This document describes *how the system is put together*. Endpoint contracts live
in [`API_CONTRACTS.md`](./API_CONTRACTS.md), the threat model and controls in
[`SECURITY.md`](./SECURITY.md), and what still blocks launch in
[`BACKEND_HANDOFF.md`](./BACKEND_HANDOFF.md).

---

## 1. Shape of the system

```
                     ┌──────────────────────────────┐
   browser  ────────▶│  Next.js App Router (RSC)    │
   (React 19)        │  server components + routes  │
                     └──────────────┬───────────────┘
                                    │
        ┌───────────────────────────┼──────────────────────────┐
        ▼                           ▼                          ▼
  Route Handlers             Server Actions-free          Inngest functions
  /api/** (Zod-validated)    data layer (src/features)    (durable, retried)
        │                           │                          │
        └──────────┬────────────────┴──────────────────────────┘
                   ▼
        Supabase Postgres (RLS) + Auth + Storage
                   ▲
                   │ service role (server only)
        ┌──────────┴───────────┬──────────────┬─────────────────┐
        ▼                      ▼              ▼                 ▼
   LinkedIn REST         Dodo Payments     Resend          Inngest Cloud
   (publish/analytics)   (checkout+webhooks) (email)      (scheduler)
```

Two rules hold everywhere:

1. **The database is the source of truth.** Queues, cache and provider state are
   all derived. A job that fails to enqueue is reported to the caller, never
   hidden behind a "success" response.
2. **Nothing privileged runs in the browser.** The Supabase service-role key,
   LinkedIn client secret, Dodo API key, Resend key and `TOKEN_ENCRYPTION_KEY`
   are read only from server modules; LinkedIn access tokens are decrypted in
   server code and never serialised into a response.

---

## 2. Request layers

| Layer | Location | Responsibility |
| --- | --- | --- |
| Proxy / session refresh | `src/lib/supabase/proxy.ts` | Refresh the Supabase session on every request, gate protected routes, redirect unauthenticated users |
| Route handler | `src/app/api/**/route.ts` | Parse + validate (Zod), authorise, rate limit, call the feature service, serialise one envelope |
| Feature service | `src/features/**/service.ts` | Business rules, entitlement checks, cross-table writes, audit logging |
| Query layer | `src/features/**/queries.ts` | Read models shaped for the UI (no raw rows leaking secrets) |
| Data access | `src/lib/supabase/{server,admin,client}.ts` | Typed Supabase clients; admin client bypasses RLS and is **never** imported into a client component |
| Background work | `src/inngest/functions/**` | Durable, retried, idempotent jobs |

Every route is built with `defineRoute` (`src/lib/api/http.ts`), which gives a
single response envelope, one error path and one log shape:

```ts
{ ok: true,  data }                                 // success
{ ok: false, error: { code, message, details? } }   // failure
```

Error codes are a closed set (`src/lib/errors.ts`): `bad_request`,
`validation_failed`, `unauthenticated`, `forbidden`, `not_found`, `conflict`,
`rate_limited`, `entitlement_required`, `external_service_unavailable`,
`integration_not_configured`, `internal_error`. Unknown exceptions are logged
with their cause and returned as a generic `internal_error` — stack traces,
provider payloads and SQL text never cross the wire.

---

## 3. Multi-tenancy and the workspace model

A **workspace** is the tenant. A user may belong to several; the active one is
pinned by the httpOnly `zybble_workspace` cookie and validated against
membership on every request (`src/lib/api/workspace.ts`).

* `workspaces` — name, slug, timezone, seats.
* `workspace_members` — `(workspace_id, user_id)` with a role of
  `owner | admin | member | viewer` and a status of `active | pending | removed`.
* Every tenant-owned table carries `workspace_id` and is protected by RLS (below).

Roles are enforced in three places that must agree:

1. **RLS policies** (`supabase/migrations/0008_rls.sql`) using the SECURITY
   DEFINER helpers `workspace_ids_for_user()`, `can_read_workspace()`,
   `can_write_workspace()`, `can_manage_workspace()`.
2. **Server-side checks** in the feature services (`canWrite`, `canManage`) so a
   caller gets a 403 instead of an empty result.
3. **SQL constraints** — e.g. `guard_workspace_owner()` stops the last owner from
   being demoted or removed, `enforce_linkedin_account_limit()` and
   `posts_guard_schedule_quota()` enforce plan limits inside the transaction so
   they cannot be raced or bypassed by calling the API directly.

Because the workspace cookie is httpOnly and server components read it during
render, switching workspaces requires a full navigation
(`window.location.reload()`); `router.refresh()` alone leaves server components
on the previous workspace.

---

## 4. Data model

Twenty tables across ten ordered migrations in `supabase/migrations/`.

| Domain | Tables |
| --- | --- |
| Identity | `profiles` (mirrors `auth.users`, application-owned) |
| Tenancy | `workspaces`, `workspace_members` |
| LinkedIn | `linkedin_accounts`, `linkedin_account_secrets` (AES-256-GCM ciphertext, separate table so tokens can never be selected by accident), `linkedin_oauth_states` (CSRF `state`, single use, short TTL) |
| Content | `posts`, `media_assets` |
| Delivery | `post_publish_attempts` (one row per attempt — the idempotency ledger) |
| Analytics | `post_analytics`, `analytics_snapshots`, `best_time_recommendations` |
| Billing | `subscriptions`, `billing_payments` |
| Platform | `webhook_events` (durable inbox + processed-event ids), `notifications`, `notification_preferences`, `audit_logs`, `usage_counters`, `rate_limit_counters` |

### Constraints that carry meaning

* `posts` has `UNIQUE (workspace_id, idempotency_key)` — a retried submit returns
  the original row instead of creating a twin.
* `post_publish_attempts` has `UNIQUE (post_id, attempt)` — an at-least-once
  queue cannot produce a second LinkedIn call for the same attempt.
* `webhook_events.event_id` is unique — a replayed provider delivery is a no-op.
* `linkedin_oauth_states.state` is unique and has an expiry — replaying a
  callback fails closed.
* `usage_counters (workspace_id, period, metric)` is maintained by trigger, and
  the Free-plan quota trigger reads it inside the same transaction as the insert.

### Storage

One private bucket, `post-media`, with `file_size_limit` and
`allowed_mime_types` configured at the bucket level plus four RLS policies
(insert / select / update / delete). Objects live under
`{workspace_id}/…`, and `storage_workspace_id(object_name)` derives the owning
workspace from the path so the policy cannot be sidestepped by renaming.

---

## 5. Authentication and sessions

Implemented with `@supabase/ssr` on the installed Next version (16.2.6): a
cookie-based session refreshed in `proxy.ts` on every request, so both server
components and route handlers see a valid session and no refresh depends on an
open tab.

| Flow | Path |
| --- | --- |
| Sign up | `POST /api/auth/signup` → creates the user, upserts `profiles`, audits `auth.signup` |
| Email confirmation | Supabase mails the link; `GET /auth/callback` exchanges `token_hash` (or PKCE `code`) |
| Log in | `POST /api/auth/login` → sets the session cookie, returns `requiresOnboarding` |
| Onboarding | `POST /api/auth/onboarding` → RPC `public.create_workspace()` (creates workspace + owner membership + preferences in one transaction) |
| Password reset | `POST /api/auth/password` (request, always 202 — non-enumerable) → email → `GET /auth/callback?type=recovery` → `PATCH /api/auth/password` inside a recovery session |
| Log out | `POST /api/auth/logout` |
| Erasure | `DELETE /api/auth/account` (re-authenticates first; see below) |

`GET /api/auth/session` returns the full `SessionState` the UI renders from:
user, profile, active workspace, role, entitlements, usage and
`requiresOnboarding`. Route gating lives in `proxy.ts`
(`PROTECTED_PREFIXES`, `AUTH_ROUTES`); redirect targets go through
`safeRelativePath` so `?redirectTo=` cannot become an open redirect.

**Account deletion order** matters and is fixed in
`src/features/auth/service.ts`: re-authenticate → read memberships → queue
`billing/subscription.cancel` for every owned Pro workspace → mark
non-owned memberships `removed` → `purge_workspace_data()` per owned workspace
(secrets, media, posts, analytics, audit rows) → delete `linkedin_oauth_states`
→ `admin.auth.admin.deleteUser`.

---

## 6. LinkedIn integration

`src/lib/linkedin/` holds the transport and the documented API surface;
`src/features/linkedin/` holds the product logic.

### OAuth 2.0 authorization code flow

1. `POST /api/linkedin/connect` → generate `state`, persist a hash in
   `linkedin_oauth_states`, set a `zybble_linkedin_state` cookie, return the
   authorization URL with `openid profile email w_member_social`
   (+ `r_member_postAnalytics` **only** when approved).
2. `GET /api/linkedin/callback` → verify `state` against both cookie and DB row,
   delete the row (single use), exchange the code, fetch `/v2/userinfo`,
   then persist the connection.
3. Tokens are encrypted with AES-256-GCM before they are written to
   `linkedin_account_secrets` (`src/lib/crypto.ts`, key from
   `TOKEN_ENCRYPTION_KEY`, key rotation via `TOKEN_ENCRYPTION_KEY_PREVIOUS`).

### Token lifecycle

LinkedIn issues refresh tokens only to approved partners, and long-lived access
tokens expire after roughly a year. The implementation therefore assumes
**neither** and states which case it is in:

* `token_expires_at` is tracked and surfaced in the UI;
* `check-linkedin-connections` runs daily: it refreshes tokens inside the
  refresh window, flips anything LinkedIn rejects to `reauth_required`, and
  warns the workspace **7 days** before an unavoidable expiry;
* a non-`active` account blocks publishing with a reconnect prompt rather than
  failing at the API (scheduled posts stay put — they are never published
  through a dead connection);
* when a refresh token *is* present it is used and rotated; when it is not, the
  only supported recovery is the reconnect flow. No scraping, no browser
  automation, no token sharing.

### Publishing

`POST /api/linkedin/…`-adjacent publishing goes through
`src/features/posts/publish.ts` and supports what the Posts API actually allows
for a member: text, single image, multi-image, video and document posts.
Validation happens before any network call (`MEDIA_LIMITS`: JPEG/PNG/GIF ≤ 5 MB
and ≤ 9 images, MP4 ≤ 200 MB, PDF ≤ 100 MB), uploads follow LinkedIn's
register-then-upload workflow, and every request sends `Linkedin-Version` and
`X-Restli-Protocol-Version: 2.0.0`.

### Analytics

`memberCreatorPostAnalytics` is queried for impressions, reactions, comments and
reposts only. Aggregate follower or demographic metrics are **not** requested
because the approved scope does not return them — the UI shows a
capability-gated empty state instead of inventing numbers.

### Best-time-to-post

`src/features/analytics/best-time.ts` computes a 7×24 grid from the account's
*own* published history: engagement per (weekday, hour) with a 180-day
half-life, a per-cell minimum sample of 2, a global minimum of 12 observations,
and neighbour smoothing. Below the thresholds the API returns
`insufficientData { requiredPosts, observedPosts }` and the UI says so; above
them the cells are labelled as estimates derived from the account's history in
its own IANA timezone.

---

## 7. Background work (Inngest)

Durable functions in `src/inngest/functions/` (registered in `index.ts`):

| Function | Trigger | Purpose |
| --- | --- | --- |
| `publish-scheduled-post` | event `post/publish.requested` | Claim, publish, record attempt, notify |
| `dispatch-due-posts` | cron `* * * * *` | Safety net: re-enqueue anything due with no run |
| `reconcile-stuck-publishes` | cron `*/15 * * * *` | Resolve attempts left `started` (crash) as `UNKNOWN_OUTCOME` |
| `sync-post-analytics` / `sync-workspace-analytics` | event + cron | Pull member post analytics |
| `recompute-best-time` | event / nightly | Recompute the heatmap |
| `nightly-analytics-sync` | cron `0 3 * * *` | Refresh every workspace that published in the last 30 days (LinkedIn's analytics cover a rolling window, so older posts are not re-read) |
| `check-linkedin-connections` | cron `0 6 * * *` | Refresh where possible, expiry warnings at 7 days, `reauth_required` on rejection |
| `post-failure-digest` | cron `0 9 * * *` | Morning summary of posts that failed overnight |
| `notify-post-published` / `notify-post-failed` / `send-post-reminder` / `post-failure-digest` | events | Notifications |
| `send-transactional-email` | event | Resend delivery with per-template preference gating |
| `sync-workspace-seats` | event | Push seat quantity to Dodo |
| `reconcile-subscriptions` | cron `17 4 * * *` | Compare local subscription state against the provider |
| `cancel-subscription-on-delete` | event | Cancel billing before a workspace is deleted |
| `delete-workspace` | event | Purge data and storage objects |

**Exactly-once publishing** is achieved with three cooperating mechanisms:

1. `post_publish_attempts` has a unique `(post_id, attempt)`; the insert *is*
   the claim — a second execution of the same attempt loses the race and exits.
2. The job is sent with a deterministic `id` derived from the post and attempt,
   so Inngest itself de-duplicates redeliveries.
3. A network failure after the LinkedIn call is recorded as `UNKNOWN_OUTCOME`
   and is **not** auto-retried; the user is asked to confirm against their feed
   (see `retryPost`), because guessing risks a duplicate post.

Timestamps are stored as UTC (`timestamptz`) with the author's IANA zone kept on
the row; `src/lib/time.ts` converts exactly once, and rejects wall times that
fall in a DST gap rather than silently publishing an hour later.

**Degraded mode:** if `INNGEST_EVENT_KEY` is unset, `inngest.send()` is a no-op
and `GET /api/cron/run` (Bearer `CRON_SECRET`) drives the same sweep. The app
never pretends the queue delivered when it did not — `createPost` returns
`publishJobQueued: false` so the UI can say so.

---

## 8. Billing (Dodo Payments)

* **One paid plan.** Pro at **$15 per seat per month**, billed monthly. Free is
  the default state. No annual plan, no invented trial.
* Checkout creates a hosted **checkout session** (`checkoutSessions.create`)
  with `product_cart: [{ product_id: PRO, quantity: billableSeats }]`,
  `billing_currency: "USD"`, a `return_url` and
  `metadata = { workspace_id, plan: "pro", seats }`. The browser is redirected
  to the returned `checkout_url`.
* **Seats = active workspace members.** `billableSeats` counts
  `workspace_members` with status `active`, floored at 1 (the owner is always
  billable). Pending invitations and removed members are not billed.
  `syncSeats` upserts the local row *before* calling the provider, so a provider
  outage leaves the local count correct and the failure is retried.
* Entitlements are derived server-side from the subscription row
  (`src/features/billing/entitlements.ts`) — never from a client claim.

| | Free | Pro |
| --- | --- | --- |
| LinkedIn accounts | 1 | 5 |
| Scheduled posts | 10 / month | unlimited |
| Drafts | unlimited | unlimited |
| Analytics history | 7 days | 12 months |
| Best-time insights | — | ✓ |
| Team collaboration | — | ✓ |
| Price | $0 | $15 / seat / month |

*Plan resolution:* `effectivePlan()` treats `active`, `past_due` and `trialing`
as Pro; `pending` and everything terminal as Free, and it is expiry-aware — a
`current_period_end` in the past collapses back to Free even if the provider
never sent a cancellation webhook.

### Webhooks

`POST /api/webhooks/dodo` verifies the Standard Webhooks signature
(`webhook-id`, `webhook-signature`, `webhook-timestamp`, HMAC-SHA256 over
`{id}.{timestamp}.{body}` with `whsec_…`, compared in constant time, with a
timestamp tolerance). It then performs a two-phase insert into
`webhook_events`:

1. insert with `status = 'received'` to claim `event_id` (unique violation =
   duplicate → 200, no work);
2. process, then mark `processed` or `failed` with the error.

A missing workspace no longer blocks the insert (the row is stored with a null
workspace and marked `unmatched`), so Dodo stops retrying an event that can
never succeed. `reconcile-subscriptions` is the backstop for anything missed.
`GET /api/billing/portal` links to the Dodo customer portal; if it is not
available in the account, the doc'd fallback is the API-driven cancel/change
flow under `/api/billing/*`.

---

## 9. Notifications and email

Templates live in `src/features/notifications/email.ts` (branded HTML + plain
text): `welcome`, `email_verification`, `password_reset`, `linkedin_connected`,
`linkedin_reauth_required`, `post_published`, `post_failed`, `post_reminder`,
`subscription_confirmed`, `payment_failed`, `subscription_cancelled`,
`team_invitation`.

Preferences live in `notification_preferences` per user; `welcome` and
`team_invitation` are always sent (transactional), everything else is gated by
its switch (`email_post_published`, `email_post_failed`, `email_post_reminder`,
`email_token_expiring`, `email_billing`), and a missing row defaults to
**enabled**. Delivery failures are counted, logged and surfaced — never thrown
in a way that marks the underlying operation successful. All user-supplied
content is HTML-escaped before interpolation.

---

## 10. Observability

`src/lib/logger.ts` emits structured JSON lines (`level`, `event`, `time`,
`service`, plus context) with a request-scoped child logger. Every log call
passes through a redactor that strips fields named like secrets, tokens and
passwords. Events worth alerting on: `linkedin.publish_failed`,
`webhook.processing_failed`, `seats.push_failed`, `posts.schedule_failed`,
`email.send_failed`, `auth.unmapped_error`. `GET /api/health` reports which
integrations are configured so a half-configured deploy is obvious.

---

## 11. Testing strategy

`vitest` — 15 files, 204 tests, no network.

| Suite | What it proves |
| --- | --- |
| `tests/db/migrations.test.ts` | Migrations apply in order against a real Postgres (PGlite) |
| `tests/db/rls-isolation.test.ts` | **Workspace isolation**: one tenant cannot read or write another's posts, tokens, analytics, media or subscription — executed as real database roles |
| `tests/jobs/publish-claim.test.ts` | The claim ledger prevents double publishing; quota and retry transitions |
| `tests/jobs/seat-math.test.ts` | Seat counting, $15/seat pricing, idempotent sync, provider failure handling |
| `tests/jobs/best-time.test.ts` | Insufficient-data thresholds, recency weighting, timezone correctness |
| `tests/webhooks/dodo-*.test.ts` | Signature verification, replay safety, entitlement transitions |
| `tests/api/entitlements.test.ts` | Plan resolution incl. expiry, gating behaviour |
| `tests/api/notifications.test.ts` | Preference gating, delivery failure handling, template escaping |
| `tests/api/posts-lifecycle.test.ts` | DST-safe scheduling, edit/delete/cancel rules, retry safety |
| `tests/api/linkedin-capabilities.test.ts` | Capability gating when a scope is missing |
| `tests/api/auth-security.test.ts` | Open-redirect protection, password policy, error disclosure |
| `tests/api/validation.test.ts`, `tests/lib/*` | Schema and primitive coverage |

---

## 12. Deployment topology

Next.js on Vercel. Env vars are read lazily at request time (`src/lib/env.ts`),
so no secret is baked into the build. Required configuration is documented in
`.env.example` and [`BACKEND_HANDOFF.md`](./BACKEND_HANDOFF.md); a sending
domain in Resend and the exact LinkedIn redirect URI are hard prerequisites,
not optional polish.
