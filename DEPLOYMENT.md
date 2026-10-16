# Zybble — Deployment

Everything below is the **correct sequence**, not the sequence that has been
performed. As of 14 October 2026, steps 4 onward have not been executed: no
provider account exists. See `LAUNCH_BLOCKERS.md`.

---

## 1. Requirements

| | |
| --- | --- |
| Node | 22.17+ (22.x) or 24+ |
| Package manager | npm, with the checked-in `package-lock.json` |
| Hosting | Vercel (Node runtime) |
| Database | Supabase Postgres, same region as the Vercel functions |

`proxy.ts` is Next 16's replacement for `middleware.ts`. It runs on the Node
runtime and refreshes the Supabase session cookie on every request; it is the
reason the auth cookie stays valid across a full page load.

---

## 2. First deploy, before any provider

```bash
npm ci
cp .env.example .env.local     # only NEXT_PUBLIC_SITE_URL is needed
npm run build
```

Deploy with **no secrets**. The app starts, every integration reports itself
unconfigured, and every page shows an honest empty or unavailable state. Use
this to verify the deploy pipeline before wiring anything real.

```bash
curl -s https://<your-domain>/api/health | jq
```

Returns `503` with `status: "not_configured"` and the list of missing variable
**names** (never values). This is the intended behaviour.

---

## 3. Supabase

### 3.1 Create the project

Pick a region inside India if your Vercel region allows (Mumbai / Bangalore), so
latency and data residency both suit an India-only marketplace.

### 3.2 API keys

Dashboard → Project Settings → API:

| Key | Where it goes |
| --- | --- |
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| Publishable key (`sb_publishable_…`) | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| Service-role key | `SUPABASE_SERVICE_ROLE_KEY` — **server only** |

> The service-role key bypasses RLS. It is used by the payment, webhook and
> email-outbox paths that must write across users. It must never be prefixed
> `NEXT_PUBLIC_`, never imported by a `"use client"` module, and never logged.

### 3.3 Apply migrations

```bash
npm i -g supabase
supabase login
supabase link --project-ref <project-ref>
supabase db push
```

Eleven migrations, in order:

| File | Contents |
| --- | --- |
| `20260101000100_extensions_and_enums.sql` | extensions, enums, `assert_inr()` |
| `20260101000200_schema.sql` | every table, index and constraint |
| `20260101000300_rls.sql` | row-level security, grants, triggers, `published_courses` view |
| `20260101000400_seed_configuration.sql` | **categories only** |
| `20260101000500_learner_rls_policies.sql` | owner-scoped policies for the eight learner-owned tables |
| `20260101000600_manual_payouts.sql` | encrypted manual payout destinations (`creator_payout_destinations`), payout requests (`payout_requests`), audit events (`payout_audit_events`), transition guards, and atomic reservation RPC (`create_creator_payout_request`) |
| `20260101000700_remove_refunds.sql` | drops the `refunds` table, rebuilds the refund-free enums, recreates `create_creator_payout_request` against them |
| `20260101000800_course_analytics_events.sql` | `course_events` (impressions / views / watch seconds), RLS enabled with **no** policies so only the service role can write, `prune_course_events`, and the service-only engagement aggregates |
| `20260101000900_creator_studio_preferences.sql` | `creator_studio_preferences`: creator alert choices, in-app bell switch and new-course defaults, own-row RLS plus admin read |
| `20260101001000_sync_email_verified.sql` | backfills `profiles.email_verified` from `auth.users.email_confirmed_at` |
| `20260101001100_creator_earnings_aggregates.sql` | `security definer` aggregates over **captured** sales for the calling creator (`creator_earnings_totals`, `_by_course`, `_daily`, `_monthly`), granted to `authenticated` only |

Migration `20260101000700_remove_refunds.sql` **destroys data**: it drops the
`refunds` table. Zybble has no refund policy, so this is intended, but take a
backup first if the project ever held live refund rows.

The fifth and sixth migrations are **not optional**. `20260101000300_rls.sql` grants those
tables to `authenticated` while enabling RLS globally, and `20260101000600_manual_payouts.sql`
adds column-level grants that exclude `encrypted_payload` and `destination_encrypted_payload`
from `anon` and `authenticated`.

`npm run test:rls` asserts grant/policy parity so this cannot silently recur: if
you add a table to the grants without giving it a policy, the suite fails.

`20260101001100_creator_earnings_aggregates.sql` is what Creator Studio's money
figures are built from, and it is granted to `authenticated` **only**. Those
functions derive the creator from `auth.uid()`, so they must be called with the
creator's own session client — under `service_role` there is no `auth.uid()` and
they would return zeros, which is why the grant is withheld rather than the
behaviour left to chance. They exist because `orders_own_read` hides an order
from its own creator, so no browser-role query can filter order items on
`orders.status`; the studio says "earnings could not be read" if they ever fail,
instead of showing ₹0.

The seed deliberately contains **categories and nothing else** — no courses, no
users, no reviews. Shipping demo business records would mean shipping fake ones.

**After applying, verify against a real database.** Static checks cannot prove
RLS behaviour. With migrations applied, open three sessions and confirm: an
anonymous session cannot read any learner row; a learner session cannot read
another learner's entitlements, notes or progress; neither can write
`profiles.role`; and neither `anon` nor `authenticated` can select
`creator_payout_destinations.encrypted_payload` or
`payout_requests.destination_encrypted_payload`.

### 3.4 Promote the first admin

```sql
insert into public.profiles (id, email, full_name, role, status, email_verified)
select id, email, raw_user_meta_data->>'full_name', 'admin', 'active', true
from auth.users
where email = 'you@example.com'
on conflict (id) do update set role = 'admin', email_verified = true;
```

Only do this **after** creating that user through `/signup`, so the profile row
already exists and the ids match.

### 3.5 Auth settings

- **Site URL**: your production origin.
- **Redirect URLs**: add `/auth/confirm` and `/auth/update-password` for both
  production and any preview deployments.
- **Email confirmation**: leave **on**. The confirm route exchanges the code for
  a session server-side.
- **Supabase SMTP is not required for the verification mail.** After `/signup`,
  the app generates the confirmation link itself with the service role
  (`auth.admin.generateLink`) and sends it as a branded Resend template, so a
  signed-up learner gets mail even with Supabase's own SMTP unconfigured.
  `SUPABASE_SERVICE_ROLE_KEY` is therefore load-bearing for signup, not just for
  media and analytics. If the link cannot be generated the signup still succeeds
  and `/settings` offers **Resend verification email** (rate-limited to three
  attempts per ten minutes).
- Add the production domain to the allowlist, or password reset silently fails.

---

## 4. Razorpay & Payout Destination Encryption

### 4.1 Keys

Dashboard → Settings → API keys.

| Key | Env |
| --- | --- |
| Publishable Key ID | `NEXT_PUBLIC_RAZORPAY_KEY_ID` (and `RAZORPAY_KEY_ID`) |
| Key secret | `RAZORPAY_KEY_SECRET` — **secret** |
| Webhook secret | `RAZORPAY_WEBHOOK_SECRET` — **secret** |
| Payout encryption key | `PAYOUT_DETAILS_ENCRYPTION_KEY` — **32-byte secret** (`openssl rand -hex 32`) |

Build and test with **test mode** (`rzp_test_...`) keys first. Do not enable live
Razorpay keys (`rzp_live_...`) until Razorpay Merchant Compliance approves
Zybble's marketplace / instructor payout model and Indian tax (Section 194-O TDS
and GST/TCS) sign-off is complete — see `LAUNCH_BLOCKERS.md`.

### 4.2 Webhook

Dashboard → Webhooks, add `https://<domain>/api/razorpay/webhook`.

| Setting | Value |
| --- | --- |
| Secret | same value as `RAZORPAY_WEBHOOK_SECRET` |
| Active events | `payment.captured`, `payment.failed`, `order.paid`, `transfer.reversed`, `transfer.partially_reversed`, `settlement.processed`, `settlement.failed` |
| Content type | `application/json` |

The handler reads the body as **text before parsing** — re-serialising changes
the bytes and breaks the HMAC.

Do **not** subscribe `refund.*` or `payment.refunded`: Zybble has no refund
policy. If they arrive anyway the handler records the event, answers `200` so
Razorpay stops retrying, and logs a warning — it never processes a refund.

### 4.3 Manual Creator Payouts (No Razorpay Route Dependency)

Zybble does **not** use Razorpay Route linked accounts or automatic order splits:
1. Learner payments settle in INR to Zybble's merchant account via standard Razorpay Checkout.
2. Creators can publish paid or free courses immediately; saving a UPI ID or Indian bank account in `/creator/payouts` is required only when requesting a payout.
3. Sensitive destination fields (beneficiary name, UPI VPA, bank account number, IFSC) are encrypted server-side with AES-256-GCM using `PAYOUT_DETAILS_ENCRYPTION_KEY` before being written to Postgres.
4. Administrators review payout requests in `/admin/payouts`, perform an audited reveal of the decrypted destination snapshot, execute the UPI/NEFT/IMPS transfer off-platform, and confirm the payout only after entering the bank/UPI UTR reference and confirming both the exact INR amount and transfer completion.

---

## 5. Bunny Stream (video)

1. Create a Stream account and a library.
2. Enable **token-based security** and copy the token authentication key.
3. Copy the library ID and create an API key with **Encode** permissions.

| Env | Value |
| --- | --- |
| `BUNNY_STREAM_LIBRARY_ID` | library id |
| `BUNNY_STREAM_API_KEY` | **secret** |
| `BUNNY_STREAM_TOKEN_AUTH_KEY` | **secret** |

4. Register the webhook on the library:
   `https://<domain>/api/webhooks/bunny`, version `v1`, algorithm
   `hmac-sha256`. Bunny signs the **exact raw body** with your library
   **Read-Only** API key.

A lesson is only playable when Bunny reports `Finished` (3) or
`Resolution finished` (4). `bunny_playback_ready` is set by the webhook — never
by the creator's upload completing, because an upload finishing is not the same
as an encode finishing.

---

## 6. Cloudflare R2 (private files)

1. Create a bucket. **Keep public access disabled.** A public bucket would make
   every course resource world-readable and silently bypass the entitlement
   check.
2. Create an R2 API token scoped to that bucket, with Object Read & Write.
3. Note the account id, bucket name, access key id and secret access key.

| Env | Value |
| --- | --- |
| `R2_ACCOUNT_ID` | account id |
| `R2_BUCKET_NAME` | bucket name |
| `R2_ACCESS_KEY_ID` | **secret** |
| `R2_SECRET_ACCESS_KEY` | **secret** |
| `R2_S3_ENDPOINT` | defaults to `https://<account>.r2.cloudflarestorage.com` |

Thumbnails and avatars stream through `/api/media/[kind]`. Course resources are
only ever handed out as short-lived pre-signed URLs after an entitlement check.

---

## 7. Resend (transactional email)

1. Create an account and add a sending domain.
2. Add the DNS records Resend gives you (SPF, DKIM, DMARC) and wait for
   verification.

| Env | Value |
| --- | --- |
| `RESEND_API_KEY` | **secret** |
| `RESEND_FROM_EMAIL` | e.g. `receipts@zybble.in` |

Transactional mail is **outbox-backed**: writes go to `email_outbox` first, a
dispatcher sends them, and the provider message id is recorded. Drain it on a
schedule:

```
POST /api/email/outbox   Authorization: <moderator or admin session cookie>
```

Only `moderator` and `admin` may call it, because the outbox holds learner email
addresses and receipt contents. Failures retry up to five times, then stay
`failed` for inspection rather than looping forever.

### 7.1 Scheduled mail rides the same call

There is no separate scheduler in this codebase. Every `POST /api/email/outbox`
first runs `queueScheduledLearnerEmails()`, then drains the outbox. Schedule that
one endpoint **daily** (a Vercel Cron, GitHub Action or any external timer) and
both halves work:

| Mail | When it is queued | Idempotency key |
| --- | --- | --- |
| Weekly learning report | UTC Mondays only | `weekly-report:<userId>:<yyyy-Www>` |
| Catalogue digest (new + discounted published courses) | UTC Mondays only | `catalog-digest:<userId>:<yyyy-Www>` |
| Study reminder | any day, skipped when the learner has no active entitlement or already completed a lesson today | `study-reminder:<userId>:<yyyy-mm-dd>` |

Bounds, so a large table cannot make one request unbounded: at most 200 learners
are considered per run, 10 000 preference rows and 5 000 already-queued keys are
read, and writes go in chunks of 50. Candidates are ordered so a run that hits
the cap does not always serve the same first 200 learners — the keys already
queued this period are excluded *before* the cap is applied.

**Consent is enforced twice.** Every template is gated by a learner preference
(`email_course_updates`, `email_promos`, weekly report, study reminders) or a
creator studio preference (new enrollment, new review, moderation decisions,
payout updates). `sendEmail` checks at dispatch, `enqueueEmail` checks before
writing the row, and `enqueueEmailBatch` resolves both preference tables in two
batched reads. A skipped mail is reported as `skipped: "consent"`, never as an
error, and never as a success.

---

## 8. OpenRouter (Zybble 2.0)

Zybble 2.0 — the public course-discovery assistant — runs on **DeepSeek**,
reached with one OpenRouter key.

| Env | Value |
| --- | --- |
| `OPENROUTER_API_KEY` | **secret** — from <https://openrouter.ai/keys> |
| `OPENROUTER_MODEL` | `deepseek/deepseek-chat` (the default; any OpenRouter slug works) |
| `OPENROUTER_SITE_URL` | your origin, sent as `HTTP-Referer` |
| `OPENROUTER_APP_NAME` | `Zybble` |

Replies stream to the browser as tokens arrive, so the visitor reads along
instead of watching a spinner. Suggestions come from a `SLUGS:` trailer the
model appends, and every slug is re-resolved against `published_courses`
before a card is rendered — a hallucinated course is dropped, never shown.

Without a key the chatbot replies honestly and links to the Help Center. It
never invents an answer.

Verify after deploying:

```bash
curl -sN https://<host>/api/chat \
  -H 'content-type: application/json' \
  -d '{"sessionId":"deploy-check-0001","stream":true,
       "messages":[{"role":"user","content":"Any free AI courses?"}]}'
```

You should see a sequence of `data: {"type":"delta",…}` frames followed by a
single `data: {"type":"done",…}`.

---

## 9. Analytics (optional, but gated)

| Env | Purpose |
| --- | --- |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | GA4 |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog (host defaults to `https://eu.i.posthog.com`) |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry |

When a key is absent the script is not loaded at all. A DSN is write-only by
design; keep the Sentry auth token server-side.

This section is about **third-party** product analytics. It is unrelated to
Creator Studio analytics, which is first-party and needs no extra key: the
browser posts impressions, views and lesson watch seconds to
`/api/analytics/track`, the route writes them to `course_events` with the service
role, and `/creator/analytics` aggregates them in SQL. `course_events` has RLS
enabled with **no** policies, so no signed-in user can read or write it directly
— only `SUPABASE_SERVICE_ROLE_KEY` can. Without that key the page says the data
is unavailable instead of showing zeros.

> **Before enabling analytics for real traffic**, implement a consent banner
> with deny-by-default. This is an open item in `LAUNCH_BLOCKERS.md` §4.

---

## 10. Vercel

1. Import the repository.
2. Framework preset: **Next.js**. Build `npm run build`, output default.
3. Add every environment variable for **Preview** and **Production** separately.
   Test-mode Razorpay keys belong to Preview; live keys to Production.
4. Do **not** add `SUPABASE_SERVICE_ROLE_KEY` as public.
5. Deploy.

### Post-deploy verification

```bash
# 1. Health: every service reports ok, no secret values in the body
curl -s https://<domain>/api/health | jq

# 2. A draft course is not public
curl -s -o /dev/null -w '%{http_code}\n' https://<domain>/courses/<draft-slug>

# 3. The lesson player 404s without an entitlement
curl -s -o /dev/null -w '%{http_code}\n' https://<domain>/learn/<any-course-id>

# 4. Webhook rejects a forged signature
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  https://<domain>/api/razorpay/webhook \
  -H 'x-razorpay-signature: 00000000000000000000000000000000' \
  -d '{"event":"payment.captured"}'          # expect 401

# 5. The success redirect grants nothing
curl -s -o /dev/null -w '%{http_code}\n' \
  'https://<domain>/checkout/success?order=Zyb-XXXXXXXXXX'
```

---

## 11. CI

`npm test` runs typecheck → lint → unit tests. All three currently pass on this
branch. Add to CI:

```yaml
- run: npm ci
- run: npm run typecheck
- run: npm run lint
- run: npm run test:unit
- run: npm run build
```

**Never put live provider credentials in CI.** The test suite uses pure
functions and test-only fixtures; it must stay runnable with no secrets at all.

The Playwright E2E suite (`npm run test:e2e`) is **stale** — it drives the
removed demo UI. Do not wire it into CI until it is rewritten against seeded
test data.

---

## 12. Rollback

The app is stateless apart from Postgres. Rolling back to the previous Vercel
deployment is immediate.

Schema migrations are **additive by design**. If one has been applied and the
previous build cannot read the new schema, roll the deployment back first and
write a compensating migration — do not drop columns on a live database.

Because entitlement, ledger and webhook rows are idempotent on unique keys, a
replay after a rollback is safe: re-delivering Razorpay's webhooks converges on
the same terminal state rather than double-granting or double-crediting.

---

## 13. What is still blocked

DNS records, Razorpay Route KYC, the sending domain, the linked-account 24-hour
cooling period, and the consent banner. The full list with owners and
consequences is in `LAUNCH_BLOCKERS.md`.