# Zybble

An India-only marketplace for practical AI courses, built on Next.js App Router
with a real backend: Supabase Postgres + Auth, Razorpay Standard Checkout for
INR learner payments, encrypted UPI/bank manual creator payouts, Bunny Stream for
video, private Cloudflare R2 for files, Resend for transactional email, and
DeepSeek (via OpenRouter) for the public course-discovery assistant.

**Read [`LAUNCH_BLOCKERS.md`](./LAUNCH_BLOCKERS.md) before enabling live payments.**
Live Razorpay credentials must remain gated until Razorpay Merchant Compliance
approves Zybble's marketplace / instructor payout model and Indian tax
(Section 194-O TDS and GST/TCS) sign-off is complete.

---

## What changed from the original demo

The previous build was a client-side prototype: a shared in-memory "document
session" with mock courses, a simulated card form, a fake chatbot, fake orders
and a fake certificate renderer. Everything below replaced that.

| Area | Before | Now |
| --- | --- | --- |
| Identity | In-memory session, lost on refresh | Supabase Auth with secure cookies, SSR session refresh, server-side role checks |
| Catalogue | Hard-coded mock array | Postgres, read under RLS; empty and honest when unconfigured |
| Checkout | `setTimeout` + a fake card field | Razorpay Checkout; signature **and** captured-payment verification |
| Entitlement | A local `completedOrder` call | Created only from verified payment or webhook state |
| Video | A simulated player with a thumbnail | Bunny Stream token URLs, authorised per request |
| Files | A generated `.txt` in the browser | Private R2, pre-signed URLs after an entitlement check |
| Email | None | Outbox-backed Resend dispatch |
| Chatbot | Rule-based, answered locally | DeepSeek via OpenRouter, streamed, grounded on published courses, slugs re-resolved server-side |
| Certificates | Rendered in the browser | Server-issued records with verification codes |
| Earnings | Mock arrays | Snapshotted commission/creator shares and a paise ledger |
| Search | Client-side over a mock array | `/api/catalog/search` against the published catalog |

Deliberately **preserved**: the design system, layouts, six interface languages,
course structure, category set, and the creator content (which is not machine
translated).

---

## Architecture

```
Browser
  │  Next.js App Router (16), React 19, Tailwind
  │
  ├─ proxy.ts ──── refreshes the Supabase session on every request
  │
  ▼
Server (Node runtime)
  ├─ server components ── src/lib/server/{catalog,learner,creator,admin}.ts
  ├─ server actions    ── src/app/(learner)/actions.ts, creator/, admin/
  └─ route handlers    ── src/app/api/**
        │
        ├─ Supabase (Postgres + RLS + Auth)   ── src/lib/supabase/*
        ├─ Razorpay Checkout + Manual Payouts ── src/lib/server/{razorpay,checkout,payouts,payout-crypto}.ts
        ├─ Bunny Stream                      ── src/lib/server/bunny.ts
        ├─ Cloudflare R2 (private)           ── src/lib/server/r2.ts
        ├─ Resend                            ── src/lib/server/email.ts
        └─ OpenRouter (DeepSeek)             ── src/lib/server/ai.ts
```

### The four invariants

Everything else follows from these.

1. **The browser is untrusted.** Price, currency, commission and creator share
   are read from Postgres on every call. Request bodies carry identifiers only.
2. **A redirect grants nothing.** `/checkout/success` reports what the database
   already says; entitlement comes from verified payment or webhook state.
3. **Money is integer paise.** Rupee strings convert decimal-safely. There is no
   currency picker and no conversion table anywhere in the codebase.
4. **Absence is stated, never faked.** No provider, no creator, no learner, no
   course — each renders an honest empty or unavailable state.

---

## Routes

| Shell | Paths |
| --- | --- |
| Public | `/`, `/courses/[slug]`, `/categories/[slug]`, `/instructors/[username]`, `/about`, `/help`, `/terms`, `/privacy` |
| Auth | `/login`, `/signup`, `/forgot-password`, `/auth/update-password`, `/auth/confirm` |
| Checkout | `/checkout/[courseId]`, `/checkout/success`, `/checkout/failed` |
| Learner | `/dashboard`, `/my-learning`, `/learn/[courseId]`, `/wishlist`, `/certificates`, `/messages`, `/orders`, `/orders/[orderId]`, `/settings` |
| Creator | `/creator/signup`, `/creator`, `/creator/onboarding`, `/creator/courses/*`, `/creator/profile`, `/creator/payouts`, `/creator/earnings`, `/creator/analytics`, `/creator/reviews`, `/creator/settings` |
| Admin | `/admin`, `/admin/courses`, `/admin/users`, `/admin/orders`, `/admin/payouts`, `/admin/categories`, `/admin/reports`, `/admin/reviews`, `/admin/settings`, `/admin/analytics` |
| API | `/api/health`, `/api/checkout`, `/api/razorpay/webhook`, `/api/webhooks/bunny`, `/api/chat`, `/api/catalog/search`, `/api/learn/[lessonId]/playback`, `/api/media/[kind]`, `/api/media/video/{grant,status}`, `/api/storage`, `/api/learner/*`, `/api/email/outbox` |

---

## Getting started

```bash
npm ci
cp .env.example .env.local     # fill in what you have
npm run dev                    # http://localhost:3000
```

The app **boots with no credentials at all**. Every page renders an honest empty
or unavailable state, and `GET /api/health` returns a per-integration readiness
report naming missing variables without revealing any value.

To get real data you need a Supabase project:

```bash
supabase link --project-ref <ref>
supabase db push               # applies supabase/migrations/*.sql
```

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for the full sequence.

---

## Money and payouts

- **INR only.** `₹` everywhere, integer paise underneath.
- **Commission** is a server setting (`marketplace_settings.commission_bps`),
  currently defaulting to **1000 bps = 10%** as a *planned* default, and is
  **snapshotted onto every order item** so a later change cannot rewrite history.
- **The split always reconciles:** `creator_paise = gross_paise − commission_paise`,
  so the halves sum back to the gross exactly.
- **Standard Razorpay Checkout + Manual Creator Payouts:** Learners pay Zybble
  in INR via standard Razorpay Checkout (no Razorpay Route `transfers` array).
  Creators can publish and earn without Route onboarding or pre-saved bank/UPI
  details; saving an AES-256-GCM encrypted UPI ID or Indian bank account is
  required only when requesting a payout.
- **Audited off-platform payout confirmation:** Admins review payout requests in
  `/admin/payouts`, perform an audited `no-store` reveal of the encrypted
  destination snapshot, execute the bank/UPI transfer off-platform, and can mark
  a request `paid` only after entering the bank/UPI UTR reference and confirming
  both the exact INR amount and transfer completion.
- **Refund & reversal adjustments:** Refunds debit the creator's share
  proportionally (`computeCreatorRefundAdjustmentPaise`). If a refund occurs
  after a manual payout has already been paid, the negative balance is tracked
  explicitly as `negativeAdjustmentPaise` against future earnings rather than
  pretending funds were automatically recovered from the creator's bank account.

Full detail: [`PAYMENT_FLOW.md`](./PAYMENT_FLOW.md) and [`LAUNCH_BLOCKERS.md`](./LAUNCH_BLOCKERS.md).

---

## Zybble AI

The launcher appears only on `/`, `/explore` and `/categories/[slug]` — public
discovery, never on course detail, checkout, learner, creator or admin routes.

Requests go to `POST /api/chat`, which:

1. rate-limits per client,
2. reads **only published courses** from the `published_courses` view,
3. sends that as the *entire* catalog context to DeepSeek and streams the
   reply back token by token,
4. re-resolves every slug the model returns against that same list — **an
   invented slug is dropped, never rendered**,
5. clamps any link to a small same-origin allowlist,
6. falls back to an honest "temporarily unavailable" message rather than
   guessing when OpenRouter is unconfigured or fails.

Set `OPENROUTER_API_KEY` and Zybble AI is live; `OPENROUTER_MODEL` defaults to
`deepseek/deepseek-chat`.

It cannot see accounts, orders or progress.

---

## Performance

Navigation speed is a product feature here, so the hot path is deliberately
kept small. What the app does:

| Where | What | Why |
| --- | --- | --- |
| `next.config.ts` | `experimental.staleTimes.dynamic: 30` | The default is `0`, which refetches a page on every visit. Thirty seconds makes back/forward and repeat visits instant. |
| `next.config.ts` | `experimental.dynamicOnHover` | Hovering a link starts the server render, so the click has nothing to wait for. |
| `loading.tsx` per shell | Streaming skeletons | A click paints immediately and the page streams into place. |
| `AppShell` | Suspense around the sidebar count and the notification bell | Page content no longer waits on per-user reads for chrome. |
| `AppShell` | `next/dynamic` for the assistant | The chatbot's dialog and icons stay out of the first-load bundle. |
| `instrumentation-client.ts` | Sentry behind a DSN check | ~390 KB of error-reporting JavaScript is not fetched when no DSN is set. |
| `app/layout.tsx` | Fonts loaded non-blocking | The Google Fonts stylesheet is fetched without blocking first paint; text renders in the system stack and settles onto Inter. |
| catalog grids | `priority` on the first card thumbnails | The LCP image is fetched with the document rather than after layout. |

---

## Testing

```bash
npm run typecheck     # tsc --noEmit
npm run lint          # ESLint, incl. React Compiler rules
npm run test:unit     # all four node:test suites below
npm test              # typecheck + lint + test:unit
npm run build         # production build

npm run test:money     # INR paise, conversion, formatting, commission & payout accounting
npm run test:chatbot   # grounded catalogue assistant, fail-closed
npm run test:security  # payment/Bunny/upload/object-key + AES-256-GCM payout crypto & confirmation guards
npm run test:rls       # migration + authorization + payout column-grant/RLS static contracts
npm run test:e2e       # Playwright walkthrough against current architecture
```

**Status on this branch:** typecheck 0 errors · lint 0 errors / 0 warnings ·
production build succeeds · `test:unit` **76/76 passing** (12 money · 11
chatbot · 21 security · 32 RLS/authorization).

### What each suite actually proves

| Suite | Proves | Does **not** prove |
| --- | --- | --- |
| `test:money` | Paise arithmetic, decimal-safe conversion, INR-only rejection, commission snapshot | That Razorpay ever charged the right amount |
| `test:chatbot` | Grounded answers, slug resolution, allowlist, fail-closed on unconfigured OpenRouter | That OpenRouter ever returned a token |
| `test:security` | HMAC verification, Route eligibility rules, Bunny encode-state mapping, playback-token shape, upload limits, object-key isolation, malformed-signature handling | That any provider signed anything |
| `test:rls` | Grant/policy parity, RLS enablement, privilege-escalation guards, tautology-free predicates, no Route identifiers reachable by `anon`, session guards and ownership checks in every server action | **Live database behaviour — see below** |

### Two security defects this branch found and fixed

Writing `test:rls` surfaced two real bugs that nothing else would have caught.

**1. Eight learner tables were granted but had no policy.** `entitlements`,
`wishlist`, `lesson_progress`, `lesson_notes`, `course_resume`,
`learner_preferences`, `recent_course_views` and `notifications` were granted to
`authenticated` while RLS was enabled globally, **but had no policies at all**.
Postgres resolves that combination to *deny*: the grant is irrelevant without a
matching policy. Applying the migrations would have silently emptied
entitlements, progress, notes, resume state, the wishlist, preferences, recent
views and notifications for every learner, with no error anywhere.

`supabase/migrations/20260101000500_learner_rls_policies.sql` adds
`user_id = auth.uid()` owner policies. Entitlements and notifications are
**select/update only** — the browser can read and dismiss what it owns, but
cannot mint a paid entitlement or fabricate a notification; those stay
service-role-only.

**2. Every creator's Razorpay Route account ID was world-readable.**
`creator_profiles` mixes a creator's public profile with their Route onboarding
state, was granted `select` to `anon`, and had a `using (true)` read policy. RLS
filters *rows*, not columns, so anyone could enumerate `route_account_id`,
`route_settlement_verified` and `route_error` for every creator in the country —
a live financial-account identifier belonging to a real KYC'd entity.

Fixed by splitting the table: `anon` now has **no grant** on
`creator_profiles`, `authenticated` may read only its own row, and the public
fields are served from a new `creator_public_profiles` view — the same
`security_invoker = false` pattern already used for `published_courses`, where
the column list *is* the access rule. Public reads (instructor page, catalogue
search, creator count) were moved to the view.

Two smaller findings came out of the same review: `published_courses` exposed
the creator's internal `user_id` to anonymous readers (removed — nothing read
it), and the privilege-escalation guard on `profiles.role` had only one of the
two layers its own comment claimed (the column-level `revoke` is now present
alongside the trigger). A verified Route status was also being persisted through
a session client whose write the grants already blocked, so it silently never
saved — that now goes through the service role.

**This is static analysis, not proof.** Parsing SQL cannot show that a policy
behaves correctly against a live database. The three-session test — anonymous,
learner A, learner B, against a real Postgres with the migrations applied — is
still unrun and remains a launch blocker. See `LAUNCH_BLOCKERS.md` §6.

**`npm run test:e2e` is not part of `npm test` and will fail.** The Playwright
suite still drives the removed demo UI. It must be rewritten against seeded test
data. Listed honestly in `LAUNCH_BLOCKERS.md` §6, along with the missing
live-database RLS tests.

Test fixtures stay isolated from production data; no live credentials belong in
CI.

---

## Accessibility and languages

Six interface languages (English, Hindi, Spanish, French, Japanese, Portuguese)
cover chrome and product copy. **Creator-authored content is not machine
translated** — a course description is the author's words in their language.
The lesson player, curriculum rail and checkout honour
`prefers-reduced-motion`, keyboard navigation and labelled controls.

---

## Repository layout

```
src/
  app/
    (app)/          public storefront        (auth)/        authentication
    (learner)/      learner area + actions   creator/       studio + actions
    admin/          moderation portal        api/           route handlers
    checkout/       purchase flow            learn/         lesson player
  components/       design system + product components
  lib/
    server/         catalog, learner, creator, admin, checkout,
                    razorpay, bunny, r2, email, ai, session
    supabase/       browser, SSR, service-role, cookie clients
    i18n/           six interface dictionaries
  proxy.ts          Next 16 session refresh
supabase/migrations/  schema, RLS + grants, category-only seed
tests/                unit and contract suites
```

---

## License

See `package.json`. Creator content belongs to the creators who wrote it.