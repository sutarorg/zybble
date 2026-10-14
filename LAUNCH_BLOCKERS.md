# Zybble — Launch Blockers

**Date: 14 October 2026.** This file is the honest list of everything that
still requires a real account, a real provider, a human decision, or a DNS
record before Zybble can take money from an Indian learner.

Nothing in this repository has been executed against a live provider. No
payment, transfer, email, video encode, AI completion or account approval has
been observed. Every integration is implemented and wired, but **implemented is
not verified**. Nothing below is claimed to work.

---

## 1. Provider accounts and credentials (all outstanding)

Every row is required. Without it, the feature is unavailable and the UI says
so — it does not fall back to a fake.

| # | Provider | What is missing | What breaks without it | Where it is enforced |
| --- | --- | --- | --- | --- |
| 1 | Supabase | Project URL, publishable key, **service-role key** | No auth, no data, no RLS. The app serves empty states. | `src/lib/env.ts`, `/api/health` |
| 2 | Razorpay | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Paid checkout returns `503 payments_unavailable`. | `src/app/api/checkout/route.ts` |
| 3 | Razorpay | `RAZORPAY_WEBHOOK_SECRET` | Webhooks are rejected with 401. Entitlement then depends solely on the synchronous verification call. | `src/app/api/razorpay/webhook/route.ts` |
| 4 | Razorpay Route | A merchant account enabled for **Route**, with linked accounts enabled | No creator can ever be paid. Paid publication stays disabled. | `src/lib/server/checkout.ts` (`assertPurchasable`) |
| 5 | Bunny Stream | `BUNNY_STREAM_LIBRARY_ID`, `BUNNY_STREAM_API_KEY`, `BUNNY_STREAM_TOKEN_AUTH_KEY` | `/api/learn/[lessonId]/playback` returns 503. Lessons show "video hosting is not configured". | `src/app/api/learn/[lessonId]/playback/route.ts` |
| 6 | Cloudflare R2 | Account, **private** bucket, S3 API token | Uploads and downloads both fail. | `src/lib/server/r2.ts`, `/api/storage` |
| 7 | Resend | API key, verified sending domain | Receipts queue in `email_outbox` and stay `queued`. | `src/lib/server/email.ts` |
| 8 | OpenRouter | API key, chosen model | The chatbot replies "temporarily unavailable" with a Help Center link. | `src/app/api/chat/route.ts` |
| 9 | GA4 / PostHog / Sentry | Property keys | The scripts are simply not loaded. No crash reporting. | `src/components/analytics/*` |

### 1a. Razorpay Route KYC — the single hardest blocker

Route splits a learner's payment into a platform settlement and a linked-account
transfer at the moment the order is created (`transfers` on `POST /v1/orders`).
That requires, per creator:

- A Razorpay merchant account with Route enabled (a business-level decision and
  a signed agreement, not an API key).
- KYC completed for each creator: legal name, business type, registered address,
  PAN, bank account. **Zybble never receives the bank details** — Razorpay
  collects them; Zybble stores only the returned `account_id` and the status
  Razorpay reports.
- Razorpay's documented **24-hour cooling period** between account creation and
  the account becoming usable.
- Final activation of the linked account, which is a Razorpay decision.

Until all of that is done for at least one test creator, **no paid course can be
published**. This is enforced in three places, not just the UI:
`assertPurchasable()` in `src/lib/server/checkout.ts`, the course-publish action
in `src/app/creator/actions.ts`, and the moderation approval action in
`src/app/admin/actions.ts`.

### 1b. Razorpay product constraints that are implemented, not assumed

- Route is **INR-only**. `assertInr()` rejects any other currency at the type,
  schema and runtime layers.
- Route does **not** support partial payments or split payment captures. A
  failed capture therefore has no partial-transfer state to reconcile.
- Order transfers are **API-only**. There is no dashboard equivalent, so all
  transfer state must come from the API or webhooks — which is why nothing in
  this codebase marks a transfer "settled" on its own.

---

## 2. DNS and domain

| # | Record | Purpose | Status |
| --- | --- | --- | --- |
| 1 | `NEXT_PUBLIC_SITE_URL` pointing at the production domain | Email links, post-auth redirects | **Not set** |
| 2 | Supabase auth redirect allowlist (production domain) | Email-confirmation and recovery links | **Not configured** |
| 3 | Resend SPF, DKIM and DMARC on the sending domain | Receipt delivery | **Not configured** |
| 4 | Razorpay webhook endpoint registered in the Razorpay dashboard | Payment events | **Not registered** |
| 5 | Bunny Stream webhook URL on the library | Encode-status events | **Not registered** |
| 6 | Vercel domain + SSL | Hosting | **Not configured** |

Until (1) and (2) are done, password reset and email confirmation do not work at
all — the redirect will point at a placeholder origin.

---

## 3. Unresolved legal, tax and commercial decisions

These are **not** decided, and the code does not pretend they are. They are
recorded here rather than guessed at in the product.

| # | Question | Status | Where it shows in the code |
| --- | --- | --- | --- |
| 1 | **Is the 10% commission final?** | No. It is a planned default held in `marketplace_settings.commission_bps` (1000 bps) and is only a default until the launch terms are approved. | `getMarketplaceCommissionBps()`, `splitCommission()` |
| 2 | **How is commission taxed — GST on the marketplace fee, TDS on creator income, both?** | Unknown. **No tax logic has been written.** Razorpay's reported `fee` and `tax` on a payment are stored verbatim as observed values, not reinterpreted. | `payments.fee_paise`, `payments.tax_paise` |
| 3 | **Who is the merchant of record, and who bears chargebacks and disputes?** | Unknown. Affects terms of service and the refund wording. | — |
| 4 | **Is there any refund or dispute liability at all?** | The marketplace publishes **no refund policy and has no refund flow**. A provider-initiated reversal is handled as an accounting correction (entitlement revoked, ledger reversed, `payment_reversed` email) — not as a customer refund promise. | `refundOrder()` in `src/lib/server/checkout.ts` |
| 5 | **What does creator tax paperwork require (TDS Form 16A, 26Q)?** | Unknown. Route may withhold at source; Zybble does not model it. | — |
| 6 | **DPDP Act 2023 consent and erasure SLAs** | Partially drafted in the privacy policy; operational process not defined. | `src/app/(app)/privacy/page.tsx` |

Because (1)–(5) are open, the creator-facing text says "planned commission", and
the payout screens say "settlement and tax treatment to be confirmed".

---

## 4. Capabilities that have never been executed

Everything below is written and typechecked. None of it has been run.

| # | Capability | Why it is unverified |
| --- | --- | --- |
| 1 | Migrations applied to a real Postgres | No Supabase project exists. `supabase/migrations/*.sql` has never been executed. |
| 2 | RLS policies | Written but never exercised. `supabase/migrations/*_rls.sql` needs a live database plus a role-by-role test pass. |
| 3 | Razorpay order creation + Route transfers | No merchant account, no test key. |
| 4 | Webhook signature verification against real traffic | The HMAC implementation follows the documented algorithm and is unit-reasoned, but no real Razorpay payload has crossed it. |
| 5 | Idempotency under replay | `webhook_events.event_id` and `ledger.idempotency_key` both have unique constraints. Replay behaviour has not been exercised against a live provider. |
| 6 | Bunny TUS upload → encode → playback token | Never run end to end. |
| 7 | R2 pre-signed upload and download | Never run. |
| 8 | Resend delivery | Never sent. A delivery receipt has never been observed. |
| 9 | OpenRouter completion + grounded recommendations | Never called. |
| 10 | GA4 / PostHog / Sentry ingestion | No keys, no events observed. |
| 11 | The Playwright E2E walkthrough (`npm run test:e2e`) | The suite was written against the demo UI and **has not been rewritten for the server-backed product**. It is expected to fail and is not part of `npm test`. See §6. |

---

## 5. What *has* been verified

Honest accounting of what passed, on this branch:

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | **0 errors** across the whole repository |
| `npm run lint` (ESLint, incl. the React Compiler rules) | **0 errors, 0 warnings** |
| `npm run build` (Next.js 16 production build) | **Succeeded**; all routes compile |
| `npm run test:unit` (money + AI contract) | **23/23 passing** |
| Client-bundle secret scan | No server secret is referenced from any `"use client"` module |
| Currency scan | No USD, EUR, GBP or PayPal reference remains in `src/` |

That is a compile-time and unit-test guarantee only. It is **not** a claim that
the product works against Supabase, Razorpay, Bunny, R2, Resend or OpenRouter.

---

## 6. Test gaps that a human must close

These are real holes, not oversights:

1. **No database/RLS integration test.** Needs a live (or ephemeral) Postgres.
   Every policy in `supabase/migrations/*_rls.sql` should be tested as three
   roles: anonymous, learner A, learner B. Learner B must never read learner A's
   orders, notes, progress, entitlements or wishlist.
2. **No authorization test for server actions.** `src/app/(learner)/actions.ts`,
   `src/app/creator/actions.ts` and `src/app/admin/actions.ts` re-check the
   session server-side, but no automated test asserts that a learner calling a
   creator action, or a creator calling an admin action, is rejected.
3. **No webhook replay/ordering test.** Razorpay does not guarantee event order;
   `applyWebhookEvent` must be shown to converge regardless of arrival order.
4. **No upload test.** Malicious content types, oversize files, path traversal in
   file names, and cross-course key access are all unexercised.
5. **The E2E walkthrough is stale.** `tests/walkthrough.mjs` drives the old demo
   (localStorage accounts, a fake checkout). It must be rewritten against seeded
   test data before it can be trusted.
6. **No live Razorpay test-mode run.** The full path — create order, pay,
   capture, webhook, entitlement, Route transfer, reconciliation — has never
   executed end to end.

Test fixtures must stay isolated from production data. No live credentials may
appear in CI.

---

## 7. Dependency advisories

`npm audit` reports **5 high-severity findings**, all in a single dev-only
chain:

```
eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces
```

- Advisory: `GHSA-vfj7-8cjw-p6xm` (stack exhaustion in `braces`).
- `braces@3.0.3` is the **latest published version**, so there is no upstream
  fix to install.
- The chain is reachable only from ESLint at development time. It is **not**
  part of the production build, not bundled, and not served to a browser.

Recorded here rather than suppressed. Mitigation: keep the dependency
development-only; re-check when `braces` publishes a fix.

The critical `next` advisories from the initial audit were resolved by
upgrading to Next.js 16.4.0, and the `postcss` advisories by upgrading PostCSS.

---

## 8. Product gaps that remain

Honest list of things a user can still notice:

1. **The catalogue is empty until creators publish.** There are no seeded
   courses, deliberately — shipping sample courses would mean shipping fake
   business records.
2. **Free-course enrolment works with only Supabase configured.** Paid
   enrolment is blocked until Razorpay Route is live.
3. **Certificates have no public verification page yet.** A certificate is a
   real server record with a verification code, but there is no route a third
   party can check that code against.
4. **The chatbot is course-discovery only.** It cannot see a learner's account,
   orders or progress, by design.
5. **Analytics consent.** No consent banner is implemented. Analytics load only
   when a key is configured; before enabling them for real traffic, a banner and
   a documented default (deny until consent) are required.
6. **No refund policy or refund UI**, by decision. Do not add one without a
   commercial decision recorded in §3.