# Zybble — Release notes

**Version:** 1.0.0-rc1 (release candidate)
**Date:** 31 October 2026
**Status:** Feature-complete. **Not yet deployed to production.** External
approvals and production credentials are outstanding — see
[`PRODUCTION_READINESS_REPORT.md`](./PRODUCTION_READINESS_REPORT.md).

---

## What Zybble 1.0 is

A LinkedIn post scheduler and analytics product with a real backend:

- schedule and publish text, image, multi-image, video and document posts to
  LinkedIn through the official APIs;
- read the analytics those APIs actually return, and derive a best-time-to-post
  recommendation from the account's own history;
- workspaces with roles, invitations and per-seat billing at $15/seat/month.

Free: 1 LinkedIn account, 10 scheduled posts/month, 7-day analytics, calendar,
unlimited drafts.
Pro: 5 accounts, unlimited scheduling, 12-month analytics, best-time insights,
team collaboration, $15 per active member per month.

---

## Release candidate 1 (this release)

### Security

- **Upgraded Next.js 16.2.6 → 16.4.3**, closing a set of advisories rated
  critical, including unauthenticated remote code execution in the Image
  Optimization API, Server-Side Request Forgery in Server Actions and rewrites,
  and cross-user cache poisoning of SSG/ISR pages. Upgraded
  `eslint-config-next` to match, and `postcss` 8.5.8 → 8.5.32.
- **Pinned `zod` to ^4.6.7** across the whole dependency tree via an npm
  `overrides` entry. `inngest` resolves `zod ^3.25.0` and there is no patched
  3.x release, so the transitive high-severity memory-exhaustion advisory could
  not otherwise be closed. The override also makes the nested copy dedupe to a
  single patched version.
- **Production dependency audit: 0 critical, 0 high.** Seven moderate advisories
  remain, all in build-time or telemetry-only paths (details in the readiness
  report).
- **Security headers added** for every response: `X-Content-Type-Options`,
  `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`,
  `X-Permitted-Cross-Domain-Policies` and `Cross-Origin-Opener-Policy`. HSTS is
  sent on production only, so local development is not pinned to HTTPS.
- **Authenticated routes are `no-store` and `X-Robots-Tag: noindex`** at the CDN
  layer, in addition to the per-layout metadata.
- **`X-Powered-By` removed.**
- **Unrecognised Supabase auth errors are no longer echoed to the user.** They
  are logged and replaced with a generic sentence — provider strings routinely
  contain host names and ports.
- **The production rate limiter is now wired up.** With `DATABASE_URL` set,
  counters live in Postgres and are shared across every serverless instance; if
  the database is unreachable the limiter degrades to per-instance protection
  instead of returning 500 to every request.

### Correctness fixes found by the audit

- **LinkedIn video and document assets are now awaited.** Previously the publish
  pipeline referenced the asset URN immediately after upload; LinkedIn transcodes
  asynchronously, so a video or document post could fail with an opaque error
  that looked like a publishing bug. The pipeline now polls the asset status
  (bounded: 6 attempts × 2 s), publishes as soon as it is `AVAILABLE`, and fails
  loudly with an actionable message on `PROCESSING_FAILED`. If LinkedIn will not
  report status for a member token, the pipeline proceeds and logs rather than
  stalling a scheduled post.
- **A non-existent DST wall time is rejected instead of silently shifted.**
  Scheduling 02:30 on a spring-forward date used to roll forward to 03:30,
  publishing an hour later than the author chose. `zonedWallTimeToUtc` gained an
  `onNonexistent` option; scheduling uses `"error"` and the user is told why.
- **A redirect to `/login?error=…` now explains itself.** The proxy was setting
  `error=auth_unavailable` and similar codes that no page ever read, so a
  misconfigured deployment silently bounced users onto a blank login form. The
  codes are now mapped through a whitelist and shown in the form's alert region.
- **Authenticated pages were indexable.** `/forgot-password`, `/reset-password`
  and `/onboarding` inherited the root layout's `index: true`. The `noindex` rule
  now lives on the auth layout, and `robots.txt` disallows every private path.

### Testing

- **213 unit and integration tests across 16 files**, up from 204, including a
  new suite for the rate limiter's failure behaviour.
- **369 Playwright end-to-end test cases** across 9 spec files and 3 device
  profiles (123 unique tests), covering authentication, the post lifecycle,
  analytics gating, billing entitlements, LinkedIn OAuth and CSRF, cross-tenant
  isolation, email safety, responsive layout and accessibility. Tests that need
  a real backend skip with a stated reason rather than passing vacuously.
  *These have not been executed — see the readiness report.*
- **New coverage:** auth security (open redirect, password policy, error
  disclosure), LinkedIn capability gating, post lifecycle and DST scheduling,
  notification preference gating, rate-limiter degradation.

### CI/CD

- **`.github/workflows/ci.yml`** — install, lint, typecheck, unit/integration
  tests, production build, dependency audit gated at `high`, and the E2E public
  surface on every push and pull request.
- **`.github/workflows/e2e-staging.yml`** — the full authenticated E2E suite,
  nightly and on demand, scoped to a protected `staging` GitHub Environment so
  project credentials are never exposed to pull requests.
- **`vercel.json`** — framework settings and git integration. Deliberately ships
  **without** a `crons` block: Vercel limits Hobby projects to daily cron jobs
  and fails the deployment on anything more frequent, and config should never be
  the reason a deploy fails. `DEPLOYMENT.md` §H.6 documents how to add the
  `/api/cron/run` safety net back once the project is on Pro.

### Documentation

- **`DEPLOYMENT.md`** — end-to-end deployment guide (sections A–N) covering
  prerequisites, GitHub, Supabase, LinkedIn (including the two-tier review
  process and the difference between development and production access),
  Inngest, Dodo, Resend, Vercel, the complete environment-variable reference,
  migration and rollback procedures, smoke tests, monitoring and a launch
  checklist.
- **`ARCHITECTURE.md`**, **`API_CONTRACTS.md`**, **`SECURITY.md`**,
  **`BACKEND_HANDOFF.md`** — from the backend build.

---

## Known limitations

1. **LinkedIn analytics is capability-gated.** Until the Community Management
   API is approved, `r_member_postAnalytics` cannot be requested, so
   impressions, reactions, comments and reposts stay empty and best-time shows
   an insufficient-data state. This is deliberate: the alternative is inventing
   numbers.
2. **No trial.** Dodo is configured for Free and a single monthly Pro product.
   A trial would require entitlement changes and is not advertised.
3. **No full Content-Security-Policy.** A CSP that does not match Next's own
   inline script output fails open in report-only browsers, so it is tracked as
   a follow-up rather than shipped half-done.
4. **Rate limiting is Postgres-backed, not Redis.** Correct across serverless
   instances, but a Postgres round-trip per limited request. Fine at Zybble's
   scale; revisit if request volume grows substantially.
5. **Seven moderate dependency advisories** remain, all in build-time or
   telemetry-only dependency paths.

---

## Breaking changes in this release

- Next.js 16.4.3 requires Node 22 or newer in CI and on Vercel.
- `zonedWallTimeToUtc` gained an `onNonexistent` option. The default
  (`"roll-forward"`) preserves existing behaviour; callers that want the strict
  behaviour must opt in.
- `friendlyAuthError` no longer returns unknown provider strings verbatim. Any
  code that relied on the raw message must read the log instead.
