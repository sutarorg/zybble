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

Five migrations, in order:

| File | Contents |
| --- | --- |
| `20260101000100_extensions_and_enums.sql` | extensions, enums, `assert_inr()` |
| `20260101000200_schema.sql` | every table, index and constraint |
| `20260101000300_rls.sql` | row-level security, grants, triggers, `published_courses` view |
| `20260101000400_seed_configuration.sql` | **categories only** |
| `20260101000500_learner_rls_policies.sql` | owner-scoped policies for the eight learner-owned tables |

The fifth migration is **not optional**. `20260101000300_rls.sql` grants those
tables to `authenticated` while enabling RLS globally, but originally shipped no
policies for them. Postgres treats *granted + RLS enabled + no matching policy*
as **deny**, so without migration 5 the application runs without errors and every
learner silently sees an empty wishlist, no progress, no notes, no resume
position and no entitlements.

`npm run test:rls` asserts grant/policy parity so this cannot silently recur: if
you add a table to the grants without giving it a policy, the suite fails.

The seed deliberately contains **categories and nothing else** — no courses, no
users, no reviews. Shipping demo business records would mean shipping fake ones.

**After applying, verify against a real database.** Static checks cannot prove
RLS behaviour. With migrations applied, open three sessions and confirm: an
anonymous session cannot read any learner row; a learner session cannot read
another learner's entitlements, notes or progress; neither can write
`profiles.role`; and an anonymous session gets **no columns at all** from
`creator_profiles` — the Razorpay `route_account_id` in particular must not be
reachable. This three-session check is an unclosed launch blocker —
`LAUNCH_BLOCKERS.md` §6.

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
- Add the production domain to the allowlist, or password reset silently fails.

---

## 4. Razorpay

### 4.1 Keys

Dashboard → Settings → API keys.

| Key | Env |
| --- | --- |
| Key ID | `RAZORPAY_KEY_ID` |
| Key secret | `RAZORPAY_KEY_SECRET` — **secret** |
| Webhook secret | `RAZORPAY_WEBHOOK_SECRET` — **secret** |

Build and test with **test mode** keys first. Do not put test keys anywhere near
the production deployment, and do not put live keys in CI.

### 4.2 Webhook

Dashboard → Webhooks, add `https://<domain>/api/razorpay/webhook`.

| Setting | Value |
| --- | --- |
| Secret | same value as `RAZORPAY_WEBHOOK_SECRET` |
| Active events | `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`, `transfer.processed`, `transfer.settled`, `transfer.failed`, `transfer.reversed`, `payout.processed`, `payout.reversed` |
| Content type | `application/json` |

The handler reads the body as **text before parsing** — re-serialising changes
the bytes and breaks the HMAC.

### 4.3 Enable Route

This is the hard part and it is **not an API key**.

1. Contact Razorpay to enable **Route** (and **Route (Standard/Express)**) on
   the merchant account. Sign the agreement.
2. Confirm linked accounts are enabled and that your account is authorised to
   create them.
3. Note Razorpay's documented constraints that the code already honours:
   - Route is **INR-only**.
   - There is a **24-hour cooling period** between creating a linked account and
     it becoming usable.
   - Order transfers are **API-only** — there is no dashboard equivalent, so all
     transfer state must come from the API.
   - Route does **not** support partial payments.

Until this is live, **paid checkout stays disabled everywhere** — which is the
correct behaviour, not a bug.

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

---

## 8. OpenRouter (Zybble AI)

Zybble AI runs on **DeepSeek**, reached with one OpenRouter key.

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

> **Before enabling analytics for real traffic**, implement a consent banner
> with deny-by-default. This is an open item in `LAUNCH_BLOCKERS.md` §8.

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