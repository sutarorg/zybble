# Zybble — Production readiness report

**Date:** 31 October 2026
**Scope:** Prompt 4 — end-to-end testing, security audit, production launch
preparation
**Repository state:** branch `arena/3a4aa931-zybble`

> **Bottom line: the code is release-candidate quality. The product is not
> launched.** Nothing in this repository has been deployed, and **no external
> integration has been exercised against a live provider.** Every credential-
> dependent item below is marked `BLOCKED` or `NOT TESTED` rather than `PASS`.
> A green build and 213 passing tests prove the logic is sound; they do not
> prove LinkedIn accepted a post or Dodo took a payment.

---

## 1. Status legend

| Status | Meaning |
| --- | --- |
| **PASS** | Executed here, with evidence, and the result was good |
| **FAIL** | Executed here and the result was not good |
| **BLOCKED** | Cannot be executed without an account, approval or credential this work did not have |
| **NOT TESTED** | Executable in principle, but the required runtime was unavailable in this environment |

---

## 2. Headline result

| Area | Status |
| --- | --- |
| Code quality gates (lint, typecheck, build, unit + integration tests) | **PASS** |
| Database migrations and RLS isolation | **PASS** |
| Dependency security (production tree) | **PASS** (0 critical, 0 high) |
| Application security review (static, OWASP-mapped) | **PASS with follow-ups** |
| Playwright end-to-end suite | **NOT TESTED** — suite written, browsers unavailable here |
| Lighthouse / Core Web Vitals | **NOT TESTED** — no Chromium available here |
| Accessibility audit | **PARTIAL** — axe assertions written and typechecked, not executed |
| Live external integrations (LinkedIn, Dodo, Resend, Inngest, Supabase) | **NOT TESTED** |
| Production deployment | **BLOCKED** |

---

## 3. Features implemented

| Feature | Status | Notes |
| --- | --- | --- |
| Marketing site (home, pricing, product pages, blog, legal) | PASS | Renders; SEO metadata, canonicals, sitemap and robots verified against the running app |
| Signup, login, logout, session refresh | BLOCKED | Implemented and unit-tested; never run against a live Supabase project |
| Email verification and password reset | BLOCKED | Flows implemented; reset is non-enumerable (verified by test) |
| First-time onboarding (workspace creation) | BLOCKED | Single-transaction RPC; verified in migration tests |
| Account deletion / erasure | BLOCKED | Re-authenticates first; purge order asserted in code review |
| Workspaces, roles, invitations, switching | BLOCKED | RLS isolation proven at SQL level |
| LinkedIn OAuth (state, CSRF, callback) | BLOCKED | Implementation complete; `state` is single-use, httpOnly + DB-backed |
| LinkedIn publishing (text/image/multi-image/video/document) | BLOCKED | Implemented; **video/document processing wait added in this release** |
| LinkedIn analytics + best-time engine | BLOCKED | Gated behind the pending API approval by design |
| Post lifecycle (draft, schedule, reschedule, cancel, publish, retry) | PASS (logic) | 19 lifecycle tests incl. DST and duplicate-prevention |
| Inngest durable jobs (17 functions) | BLOCKED | Defined; cron schedules and retry policies reviewed |
| Dodo Payments checkout, seats, portal, cancellation | BLOCKED | Implemented; signature verification unit-tested |
| Dodo webhooks (signature, idempotency, entitlements) | PASS (logic) | 25 webhook tests incl. replay and expiry |
| Resend transactional email (12 templates) | BLOCKED | Templates and preference gating unit-tested |
| Notifications and preferences | PASS (logic) | 14 tests incl. per-member gating and HTML escaping |
| Rate limiting | PASS | Postgres-backed in production with graceful degradation; 9 new tests |

---

## 4. Tests executed

### 4.1 Unit and integration — PASS

```
Test Files  16 passed (16)
     Tests  213 passed (213)
```

| Suite | Tests | What it proves |
| --- | --- | --- |
| `tests/db/migrations.test.ts` | 6 | All 10 migrations apply in order against a real Postgres (PGlite) |
| `tests/db/rls-isolation.test.ts` | 15 | **Cross-tenant isolation** as real database roles: posts, tokens, analytics, media, subscription |
| `tests/webhooks/dodo-signature.test.ts` | 15 | Standard Webhooks HMAC verification, timestamp tolerance, constant-time compare |
| `tests/webhooks/dodo-processing.test.ts` | 10 | Idempotent event processing, rollback on failure, entitlement transitions |
| `tests/jobs/publish-claim.test.ts` | 10 | The claim ledger prevents double publishing; quota and retry transitions |
| `tests/jobs/seat-math.test.ts` | 14 | Seat counting, $15/seat pricing, idempotent sync, provider-failure behaviour |
| `tests/jobs/best-time.test.ts` | 11 | Insufficient-data thresholds, recency weighting, timezone correctness |
| `tests/api/entitlements.test.ts` | 15 | Plan resolution including expiry-aware downgrade |
| `tests/api/notifications.test.ts` | 14 | Preference gating, delivery failure handling, escaping |
| `tests/api/posts-lifecycle.test.ts` | 19 | DST scheduling, edit/delete/cancel rules, retry safety, workspace scoping |
| `tests/api/linkedin-capabilities.test.ts` | 13 | Capability gating when a scope is missing |
| `tests/api/auth-security.test.ts` | 13 | Open-redirect protection, password policy, error disclosure |
| `tests/api/validation.test.ts` | 20 | Zod schemas |
| `tests/lib/time.test.ts` | 18 | DST transitions, ambiguous and non-existent wall times |
| `tests/lib/crypto.test.ts` | 11 | AES-256-GCM envelope, AAD binding, key rotation |
| `tests/lib/rate-limit.test.ts` | 9 | Hashing, limits, and degradation when the primary limiter fails |

No network access is used by any of these.

### 4.2 End-to-end — NOT TESTED

**Written:** 123 unique Playwright tests (369 cases across 3 device profiles) in
9 spec files:

| Spec | Tests | Requires |
| --- | --- | --- |
| `e2e/public-site.spec.ts` | 14 | Nothing — runs anywhere |
| `e2e/responsive.spec.ts` | 18 | Nothing |
| `e2e/auth.spec.ts` | 10 | Supabase |
| `e2e/posts.spec.ts` | 11 | Supabase (+ LinkedIn for publishing) |
| `e2e/analytics.spec.ts` | 10 | Supabase |
| `e2e/billing.spec.ts` | 9 | Supabase + Dodo |
| `e2e/linkedin.spec.ts` | 11 | Supabase + LinkedIn |
| `e2e/workspace-isolation.spec.ts` | 4 | Supabase |
| `e2e/emails.spec.ts` | 5 | Supabase + Resend |

**Why not executed:** this environment has no Chromium and cannot reach
`cdn.playwright.dev` to download browsers (outbound access is limited to the npm
registry, GitHub and PyPI). `npx playwright test --list` parses the config and
enumerates all 369 cases successfully, and the suite typechecks and lints
cleanly — but **no test has been run.**

**What is verified vs assumed.** Tests that need a backend call
`needsBackend()`, which skips with an explicit reason when `E2E_REAL_BACKEND` is
unset. A green run without that flag proves the public surface only. This is
deliberate: a test that silently exercises nothing is worse than an honest skip.

### 4.3 Build and static gates — PASS

| Command | Result |
| --- | --- |
| `npm run lint` (eslint 9, Next + React Compiler rules) | clean |
| `npm run typecheck` (tsc --noEmit, strict) | clean |
| `npm run build` (Next 16.4.3, Turbopack) | succeeds; all app pages prerender, API routes dynamic |
| `npx playwright test --list` | 369 cases enumerated |
| `npm audit --omit=dev` | 0 critical, 0 high, 7 moderate |

---

## 5. Security findings

### 5.1 Dependency audit — PASS (with residual moderate findings)

**Before this release:** 1 critical, 4 high, 7 moderate in the production tree.

**After:**

| Severity | Count |
| --- | --- |
| Critical | **0** |
| High | **0** |
| Moderate | 7 |

**Fixed:**

| Package | Change | Advisories closed |
| --- | --- | --- |
| `next` | 16.2.6 → **16.4.3** | Critical: unauthenticated RCE (Image Optimization API, `next/og`), SSRF in Server Actions and rewrites, cache poisoning of SSG/ISR, unauthenticated disclosure of internal Server Function endpoints, DoS, and more |
| `postcss` | 8.5.8 → **8.5.32** | High: XSS via unescaped `</style>`; arbitrary file read via `sourceMappingURL` |
| `zod` (transitive via `inngest`) | pinned to **^4.6.7** via npm `overrides` | High: memory exhaustion validating oversized constrained collections. `inngest` resolves `zod ^3.25.0` and no patched 3.x exists, so an override was the only closure. The nested copy now dedupes to the patched version. |

**Residual moderate (7) — accepted, with evidence:**

| Path | Advisory | Why accepted |
| --- | --- | --- |
| `inngest → @opentelemetry/auto-instrumentations-node → @opentelemetry/resource-detector-gcp → gcp-metadata → gaxios → rimraf → glob → minimatch` | Glob `AbortSignal` cancellation bypass; minimatch DoS via globparts amplification | Telemetry auto-instrumentation that Zybble does not enable; not reachable from any HTTP request path; no fix available without an upstream release |
| `@tailwindcss/typography → postcss-selector-parser` | ReDoS in selector parsing | Build-time CSS transform for blog prose; input is our own CSS, not user data; npm's suggested "fix" is a downgrade to 0.5.4 |

None of the residual findings are reachable with attacker-controlled input on a
request path. They are listed here rather than hidden.

### 5.2 OWASP Top 10 review — PASS with follow-ups

| Category | Status | Evidence |
| --- | --- | --- |
| A01 Broken Access Control | PASS | RLS on every tenant table, proven by 15 tests against real Postgres roles; server-side role checks return 403 rather than empty results; plan limits enforced by SQL triggers so a direct API call cannot bypass them |
| A02 Cryptographic Failures | PASS | LinkedIn tokens AES-256-GCM encrypted with the workspace + account id bound as AAD; 11 crypto tests; key rotation supported |
| A03 Injection | PASS | All input through Zod; all SQL through parameterised queries or PostgREST; no string-concatenated SQL anywhere in `src/` |
| A04 Insecure Design | PASS | Entitlements derive only from verified webhooks; `UNKNOWN_OUTCOME` refuses blind retries; capability gating instead of fabricated analytics |
| A05 Security Misconfiguration | PASS (improved here) | Security headers added; `X-Powered-By` removed; HSTS production-only; `/api/cron/run` fails closed without `CRON_SECRET`; authenticated routes `no-store` + `noindex` |
| A06 Vulnerable Components | PASS | 0 critical, 0 high; audit gated at `high` in CI |
| A07 Auth Failures | PASS | 12-char minimum; non-enumerable reset; re-authentication before account deletion; unrecognised provider errors never echoed |
| A08 Integrity Failures | PASS | Webhook signature verification; unique event ids; unique `(post_id, attempt)` claim ledger; deterministic Inngest ids |
| A09 Logging Failures | PASS | Structured JSON with request id; redactor strips secret-looking keys and values; audit log for security-relevant actions |
| A10 SSRF | PASS | No user-controlled URL is fetched by the server. Media is uploaded to LinkedIn-provided upload URLs only |

**Follow-ups (not blockers):**

1. A full **Content-Security-Policy** is not deployed. A CSP that does not match
   Next's own inline-script output fails open in report-only browsers, so
   shipping a half-configured one would be security theatre. Tracked.
2. **Supabase Auth hardening** (leaked-password protection, MFA, custom SMTP) is
   dashboard configuration that must be verified by the operator.
3. **Penetration testing** has not been performed.

### 5.3 Manual checks performed

- No secrets in the repository. `.gitignore` excludes `.env*` except
  `.env.example`; all server-only variables are read lazily at request time.
- No service-role key in any client-reachable module (verified by import
  analysis and asserted by an E2E test).
- No dead controls: no `href="#"`, no empty `onClick`, no `TODO`/`FIXME` in
  `src/`.
- Environment-variable whitelist for redirect error messages, so a crafted
  `?error=` cannot inject text into the UI.

---

## 6. Correctness fixes made in this release

Found by auditing the code against its own documentation, then fixed:

1. **LinkedIn videos and documents are now awaited.** The publish pipeline
   referenced the asset URN immediately after upload; LinkedIn transcodes
   asynchronously, so those posts could fail with an opaque error that looked
   like a publishing bug. Bounded polling (6 × 2 s) now runs before publish,
   fails loudly on `PROCESSING_FAILED`, and proceeds with a warning if LinkedIn
   will not report status for a member token.
2. **A non-existent DST wall time is rejected, not shifted.** Scheduling 02:30 on
   a spring-forward date used to silently become 03:30.
3. **Redirect errors are now explained.** `/login?error=auth_unavailable` was set
   by the proxy and read by nobody, so a misconfigured deployment showed a blank
   login form.
4. **Three authenticated pages were indexable** (`/forgot-password`,
   `/reset-password`, `/onboarding`). Fixed at the layout level and in
   `robots.txt`.
5. **The production rate limiter was never installed** — a documented blocker
   from the previous phase. It is now Postgres-backed when `DATABASE_URL` is set
   and degrades gracefully instead of failing requests.

---

## 7. Performance findings

**Status: NOT TESTED.** Lighthouse requires a Chromium binary, which could not be
installed here. Nothing has been measured, so no Core Web Vitals figure is
reported — inventing one would be worse than reporting nothing.

**Static assessment:**

| Aspect | Assessment |
| --- | --- |
| Image optimisation | Uses `next/image` with a static OG image and pre-generated blog covers; no remote image hosts whitelisted |
| Fonts | Inter via `next/font` (self-hosted at build time) — note: **the build needs network access to Google Fonts**; in an offline build environment this fails, which is why the sandbox build required a temporary stub |
| Caching | Authenticated routes are `no-store`; static assets use Next's default immutable caching |
| JavaScript bundle | Not measured. Radix primitives are the largest client dependency |
| Metadata / SEO | Canonical URLs on every marketing page; OG and Twitter tags; JSON-LD present; authenticated pages `noindex` at both metadata and CDN layers |
| Sitemap / robots | Verified against the running app |

**To run before launch:**

```bash
npm run build && npm run start
npx lighthouse http://localhost:3000 --preset=desktop --view
npx lighthouse http://localhost:3000/pricing --form-factor=mobile --view
```

---

## 8. Accessibility findings

**Status: PARTIAL.** Axe-core assertions are written into
`e2e/public-site.spec.ts` covering `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`
and `wcag22aa` on four public pages, plus keyboard-reachability and
focus-visibility checks. **They have not been executed.**

Static evidence that the codebase takes accessibility seriously:

- Landmarks (`header`, `nav` with `aria-label="Main navigation"`, `main`,
  `footer`), `aria-current` on nav items, labelled icon-only buttons,
  `role="alert"` on form errors, `aria-label` on the calendar, composer,
  workspace switcher and charts.
- `prefers-reduced-motion` handled in CSS.
- Playwright is configured with `reducedMotion: "reduce"` so animations cannot
  cause flaky tests or hide content.

Unverified: contrast ratios in practice, screen-reader behaviour, focus order in
dialogs.

---

## 9. Outstanding issues

| # | Issue | Severity | Blocker? |
| --- | --- | --- | --- |
| 1 | `w_member_social` not verified on a production LinkedIn app | Critical for the product | **Yes** |
| 2 | Community Management API (`r_member_postAnalytics`) not approved | High — disables analytics | **Yes** (or ship analytics gated) |
| 3 | LinkedIn API version sunset (`202511` on 2026-11-16) | High if unpinned | **Yes** before that date |
| 4 | No production Supabase project | High | **Yes** |
| 5 | No Dodo live-mode product or webhook | High | **Yes** |
| 6 | Resend sending domain not verified | High | **Yes** |
| 7 | No Inngest production app | Medium — `/api/cron/run` is the stopgap | No |
| 8 | E2E suite never executed | Medium | No, but reduces assurance |
| 9 | No Content-Security-Policy | Medium | No |
| 10 | Seven moderate dependency advisories | Low | No |
| 11 | No penetration test | Low | No (recommended) |

---

## 10. API approval dependencies

| Approval | Needed for | Granting body | Notes |
| --- | --- | --- | --- |
| **Sign In with LinkedIn (OpenID Connect)** | `openid`, `profile`, `email` | Self-serve | Instant on app creation |
| **Share on LinkedIn** | `w_member_social` — **publishing** | Self-serve product | Must be **added and confirmed** on the production app. Without it the product cannot publish at all |
| **Community Management API — Development tier** | `r_member_postAnalytics` | LinkedIn review | Registered legal organisation, verified business email, verified organisation and website, app linked to a verified Company Page |
| **Community Management API — Standard tier** | Higher rate limits | LinkedIn review | Requires Development tier first, then an access form **plus a screen recording** demonstrating the OAuth flow, a member post, and how the resulting analytics are shown in-app |

**Critical:** developer-portal access is not production access. LinkedIn's
review runs on its own timeline with no SLA, rejections usually concern how the
use case is described rather than the code, and a rejected app must be
replaced — you cannot re-apply with the same one. **Start this now**, before any
other launch work, because it is entirely independent of the codebase.

---

## 11. Missing production credentials

Every one of these is absent from this environment:

| Variable | Needed for | Status |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` | Everything | Missing |
| `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_REDIRECT_URI` | Connecting accounts, publishing | Missing |
| `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | Durable jobs | Missing |
| `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_WEBHOOK_KEY`, `DODO_PRO_PRODUCT_ID` | Subscriptions | Missing |
| `RESEND_API_KEY`, `EMAIL_FROM` | Transactional email | Missing |
| `TOKEN_ENCRYPTION_KEY`, `CRON_SECRET` | Token encryption, cron auth | Self-generated — **you must generate these** |

The application degrades honestly without them: `/api/health` reports each
integration as `false`, and every feature shows a capability-gated state with the
reason instead of a dead button. That behaviour was verified by running the app
with no credentials at all.

---

## 12. Deployment status

**BLOCKED.** No environment has been provisioned. Nothing has been deployed to
Vercel, Supabase, Inngest, Dodo, Resend or LinkedIn.

What *is* ready:

- `.github/workflows/ci.yml` — runs on every push and PR
- `.github/workflows/e2e-staging.yml` — full suite, nightly and on demand
- `vercel.json` — framework, region, cron
- `DEPLOYMENT.md` — step-by-step provisioning guide, sections A–N

**A licensing note that is not optional:** Vercel's Hobby plan is for personal,
non-commercial use. Zybble is a paid SaaS product, so the production project
must be on **Pro** (or Enterprise). This is a contractual requirement, not a
technical one.

---

## 13. Recommended next actions

**Do these in parallel, starting today:**

1. **Apply for LinkedIn Community Management API access (Development tier).**
   It has the longest lead time and depends on nothing in this repository.
2. **Create the Supabase production project** (Pro plan), apply the migrations,
   and verify RLS with the two SQL checks in `DEPLOYMENT.md` §C.5.
3. **Verify the Resend sending domain.** DNS propagation alone can take up to 72
   hours.
4. **Add the *Share on LinkedIn* product** to the LinkedIn app and confirm
   `w_member_social` appears on the production consent screen.

**Then, in order:**

5. Create the Inngest app; set the signing and event keys; sync and confirm all
   17 functions appear.
6. Create the Dodo Pro product ($15/seat/month) in **test mode** and run the full
   subscription loop with `dodo wh listen` forwarding to local development.
7. Import the repository into Vercel (**Pro**), add every variable from
   `DEPLOYMENT.md` §I scoped to the right environment, and connect the domain.
8. Install Playwright browsers (`npx playwright install --with-deps chromium`)
   and run `npm run test:e2e` against the preview deployment.
9. Work through `DEPLOYMENT.md` §K (smoke tests) top to bottom, including one
   real post to a real account and one real payment that you refund.
10. Run Lighthouse on the production URL and record the Core Web Vitals.
11. Set `E2E_REAL_BACKEND=1` for the nightly staging workflow so the
    authenticated E2E suites start proving something every night.
12. Only then, switch Dodo to live mode and open signups.

**Do not skip steps 1 and 4.** Everything else can be finished in a day; those
two run on LinkedIn's calendar.

---

## 14. Final statement

Zybble's backend is complete, internally consistent, and free of known critical
defects. Its security posture has been materially strengthened in this release:
every critical and high-severity dependency advisory is closed, security headers
are in place, and four real correctness bugs were found and fixed by auditing the
code rather than trusting it.

**It is not live, and it has not been proven against a single external API.**
Until steps 1–4 above are complete and the smoke tests in `DEPLOYMENT.md` §K
pass against a real deployment, the honest status of every external integration
in this document remains `NOT TESTED`.
