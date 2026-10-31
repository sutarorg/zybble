# Zybble — Security model

This document is the security posture of the backend: what protects what, where
the boundaries are, and which controls are still the operator's responsibility.
It is written to be auditable — every claim points at a file.

---

## 1. Trust boundaries

| Boundary | What crosses it | Enforcement |
| --- | --- | --- |
| Browser → route handler | JSON, cookies, multipart uploads | Zod schemas, session validation, rate limits |
| Route handler → Postgres | SQL via PostgREST (user-scoped client) | **RLS** on every tenant table |
| Background job / webhook → Postgres | SQL via service-role client | Service-role key server-only, never bundled |
| Server → LinkedIn | OAuth, REST calls with tokens | Tokens decrypted in server code only |
| LinkedIn/Dodo → server | Redirects, signed webhooks | `state` validation, HMAC signature verification |
| Server → Resend | Email API | Key server-only, content escaped |

**The Supabase service-role key never reaches the browser.** It is read in
`src/lib/env.ts` (server-only module) and used only by
`src/lib/supabase/admin.ts`. The client bundle contains just
`NEXT_PUBLIC_SUPABASE_URL` and the publishable/anon key, which are safe to ship
because RLS, not the key, is the boundary.

---

## 2. Authentication

* Cookie sessions via `@supabase/ssr` on Next 16.2.6, refreshed in
  `src/lib/supabase/proxy.ts` on **every** request — including server component
  renders, so a session cannot expire while a tab is open.
* Route gating: `PROTECTED_PREFIXES` (app + `/onboarding`) redirect
  unauthenticated users; `AUTH_ROUTES` bounce signed-in users away from
  login/signup/reset.
* Password policy: **12 characters minimum**, enforced by Zod at signup and
  password update.
* Password reset is **non-enumerable**: `POST /api/auth/password` always answers
  202 with the same body whether or not the address exists.
* Email confirmation is supported end-to-end (resend via
  `POST /api/auth/verify`).
* Account deletion (`DELETE /api/auth/account`) **re-authenticates with the
  password first** — a session left open on a shared machine cannot erase an
  account.
* An email change is deliberately not exposed: it requires Supabase's
  re-verification flow, and doing it silently would desynchronise `auth.users`
  from `public.profiles`.

### Redirect safety (open redirect)

Every caller-supplied redirect target goes through `safeReturnPath`
(`src/features/auth/service.ts`), which keeps only same-origin paths:
absolute URLs, protocol-relative `//host`, and anything not starting with `/`
fall back to a fixed default. Covered by `tests/api/auth-security.test.ts`.

---

## 3. Authorisation and multi-tenant isolation

Defence in depth, three independent layers that must all be bypassed for a leak:

### Layer 1 — Row Level Security (`supabase/migrations/0008_rls.sql`)

Every tenant table has RLS enabled with policies built on SECURITY DEFINER
helpers:

```sql
workspace_ids_for_user()   -- workspaces the caller belongs to
can_read_workspace(id)     -- any member
can_write_workspace(id)    -- owner / admin / editor
can_manage_workspace(id)   -- owner / admin
```

Membership is derived from `workspace_members` with `status = 'active'`; removed
members lose access immediately, without a second delete.

### Layer 2 — Server-side role checks

Feature services re-check the role (`assertCanWrite`, `assertCanManage`) so a
caller receives **403** rather than an empty result set that looks like "no
data". Routes declare the minimum role in `defineRoute`'s `workspaceContext({ minimumRole })`.

### Layer 3 — Database constraints

Plan limits and invariant-breaking writes are enforced *inside the transaction*,
so they cannot be raced or bypassed by calling the API directly:

* `enforce_linkedin_account_limit()` — 1 account on Free, 5 on Pro;
* `posts_guard_schedule_quota()` — 10 scheduled posts per calendar month on
  Free, reading the same usage counter the UI reads;
* `guard_workspace_owner()` — the last owner cannot be demoted or removed.

### Proven by test

`tests/db/rls-isolation.test.ts` executes against a real Postgres (PGlite) with
real database roles and asserts that workspace A cannot read or write workspace
B's posts, LinkedIn tokens, analytics, media or subscription. It also asserts
that the service-role client can, which is what makes the background jobs work.

### Workspace selection

The `zybble_workspace` cookie is httpOnly and is re-validated against real
memberships on every request (`resolveWorkspace`); `POST /api/workspaces/switch`
checks membership before writing it. A forged cookie can only ever select a
workspace the caller already belongs to.

---

## 4. OAuth security (LinkedIn)

| Control | Implementation |
| --- | --- |
| CSRF | `state` is 32 random bytes; a SHA-256 hash is stored in `linkedin_oauth_states` **and** the raw value is set in a short-lived httpOnly cookie. The callback requires both to match. |
| Single use | The state row is deleted inside the callback before the code exchange — a replayed callback fails closed. |
| Expiry | State rows carry an expiry; expired rows are rejected and purged. |
| Token exchange | Server-side only, using the client secret, over TLS. |
| Scope minimisation | `openid profile email w_member_social` only. `r_member_postAnalytics` is requested **only** when `LINKEDIN_ANALYTICS_SCOPE_ENABLED=true`, because requesting an unapproved scope breaks the consent screen for every scope. |
| Redirect URI | Registered exactly, per environment; `redirectUri()` builds it from config so it cannot drift. |
| No implicit flow, no token in the URL | Authorization code flow with PKCE-capable exchange; tokens never reach the browser, `localStorage` or a log. |

### Token storage

Tokens are encrypted at the **application layer** with AES-256-GCM before they
touch the database (`src/lib/crypto.ts`):

```
v1.<keyId>.<iv>.<authTag>.<ciphertext>      (base64url segments)
```

* Key material: 32 bytes from `TOKEN_ENCRYPTION_KEY` (base64),
  validated at first use — a misconfigured key fails loudly rather than
  silently writing plaintext.
* The workspace id and account id are bound in as **additional authenticated
  data**, so a ciphertext copied from one row cannot be replayed into another.
* Rotation: `TOKEN_ENCRYPTION_KEY_PREVIOUS` allows a window where old rows still
  decrypt while new writes use the current key.
* Plaintext tokens live only in server memory for the duration of one API call,
  in a separate table (`linkedin_account_secrets`) that application queries
  never select by accident.

### Token lifecycle

LinkedIn issues refresh tokens selectively — this implementation assumes
**neither** a refresh token nor an indefinite access token exists. Expiry is
tracked and surfaced, a daily job warns at 14 days and marks accounts expired
past due, and an expired connection blocks publishing with a reconnect prompt
instead of failing at the API. Recovery is always the official reconnect flow;
there is no scraping and no browser automation anywhere in the codebase.

---

## 5. Webhook security (Dodo Payments)

`POST /api/webhooks/dodo` verifies the **Standard Webhooks** signature:

1. read `webhook-id`, `webhook-timestamp`, `webhook-signature` (raw body — the
   bytes that were signed, never a re-serialised object);
2. HMAC-SHA256 over `{id}.{timestamp}.{body}` with the `whsec_…` secret;
3. compare with `timingSafeEqual`;
4. reject timestamps outside the tolerance window (replay protection).

Then:

* **Durable inbox** — the event is inserted into `webhook_events` with
  `status = 'received'` to claim the unique `event_id`. A duplicate insert is
  the duplicate-delivery signal: no work is done and 200 is returned.
* **Entitlements come only from verified events.** `public.subscriptions` is
  never written from a browser claim; checkout only *starts* a session.
* **Unmatched workspaces** are stored with a null workspace rather than
  rejected, so Dodo stops retrying an event that can never succeed.
* **Processing failures return 5xx** so the provider retries; the row records
  the error and the attempt count.
* A nightly `reconcile-subscriptions` job compares local state against the
  provider and is the backstop for anything a missed webhook should have done.

Covered by `tests/webhooks/dodo-signature.test.ts` and
`tests/webhooks/dodo-processing.test.ts`.

---

## 6. Input validation

* Every request body and query string is parsed with **Zod** before the handler
  runs (`defineRoute`'s `body`/`query` config). Validation failures return 400
  with a flattened issue list.
* Timezones are validated with `isValidTimeZone()` against the runtime zone
  database, not a regex — a syntactically valid but non-existent zone would
  otherwise blow up in the scheduling maths.
* Ids are UUIDs; enums are closed; numbers are bounded (`limit` ≤ 200).
* LinkedIn post bodies are capped at 3,000 characters, matching the API.
* Uploads are checked against `MEDIA_LIMITS` (type, size, count) **before** any
  storage write, and again at the storage bucket via `allowed_mime_types` and
  `file_size_limit`.

---

## 7. File uploads

* Private bucket `post-media`; objects are stored under `{workspace_id}/…`.
* Four storage RLS policies (insert / select / update / delete) derive the
  owning workspace from the object path with `storage_workspace_id(object_name)`,
  so renaming an object cannot move it between tenants.
* The browser receives **short-lived signed URLs**, never the bucket path as a
  public URL.
* Media is uploaded to LinkedIn through the official register-then-upload
  workflow; no file is written to a public location at any point.

---

## 8. Secrets and configuration

| Secret | Where it lives | Exposure |
| --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Server env | Never bundled; import guarded to server modules |
| `LINKEDIN_CLIENT_SECRET` | Server env | Never bundled |
| `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_WEBHOOK_KEY` | Server env | Never bundled |
| `RESEND_API_KEY` | Server env | Never bundled |
| `TOKEN_ENCRYPTION_KEY[_PREVIOUS]` | Server env | Never bundled; never logged |
| `CRON_SECRET` | Server env | Bearer token for `/api/cron/run` |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser env | Safe by design (RLS is the boundary) |

Environment variables are read **lazily at request time** (`src/lib/env.ts`),
so no secret is baked into a build artefact. `.env.example` documents every
variable; a filled copy must never be committed.

---

## 9. Logging and error handling

* Structured JSON logs (`src/lib/logger.ts`) with a request-scoped child logger
  carrying `requestId`.
* A **redactor** runs on every log call: keys matching
  `token|secret|password|authorization|cookie|api[-_]?key|signature|bearer|otp|refresh`
  are replaced, and values that look like `ghp_`, `sk_`, `whsec_`, JWTs or
  60+ character opaque strings are redacted too.
* Errors reaching a client are a closed set of codes with safe sentences
  (`src/lib/errors.ts`). Unknown exceptions are logged with their cause and
  returned as `internal_error`. **Provider strings are never echoed** —
  `friendlyAuthError` maps the known ones to sentences and replaces anything
  unrecognised with a generic message, because Supabase errors routinely carry
  host names and ports.
* Emails are a common leak channel too: the signup audit event records the email
  **domain only**.

---

## 10. Rate limiting

`src/lib/rate-limit.ts` exposes one interface with two implementations:

* `postgresRateLimiter` (production) — fixed-window counters in
  `public.rate_limit_counters`, bumped by a SECURITY DEFINER function, so every
  Vercel instance shares counters without Redis.
* `memoryRateLimiter` — tests, and the fallback when Postgres is unavailable, so
  a database outage degrades to per-instance limiting instead of taking the
  endpoint down.

**Keys are SHA-256 hashes** — raw emails and IP addresses never sit in the
counter table.

Notable limits: signup 5/15 min per IP, login 10/5 min, password reset and
verification resend 5/15 min, account deletion 3/hour, checkout and invite
10/min, publish 20/min, reads 120–180/min.

---

## 11. Audit logging

`public.audit_logs` records security- and billing-relevant actions with actor,
workspace, entity, request id, IP and user agent:

`auth.signup`, `auth.login`, `auth.profile_updated`, `workspace.created`,
`workspace.updated`, `workspace.switched`, `workspace.delete_requested`,
`member.invited`, `member.role_updated`, `member.removed`, `post.created`,
`post.updated`, `post.deleted`, `post.publish_requested`, `post.cancelled`,
`post.retried`, `media.uploaded`, `media.deleted`, `linkedin.disconnected`,
`billing.checkout_started`, `billing.cancellation_requested`,
`billing.seats_synced`, `billing.cancelled_on_delete`.

Two properties worth stating explicitly:

* The **email domain** is logged, never the address.
* Audit rows are workspace-scoped and are therefore deleted with the workspace
  during erasure — the deletion itself is recorded by the caller before the
  purge, so there is always a trace that a deletion happened without retaining
  the deleted tenant's data.

---

## 12. Idempotency and integrity

| Mechanism | Guarantees |
| --- | --- |
| `UNIQUE (workspace_id, idempotency_key)` on `posts` | A retried create returns the original post |
| `UNIQUE (post_id, attempt)` on `post_publish_attempts` | At-least-once delivery cannot produce a second LinkedIn call for the same attempt |
| Deterministic Inngest event ids | Redeliveries de-duplicate at the queue |
| `UNIQUE (event_id)` on `webhook_events` | A replayed provider delivery is a no-op |
| `UNIQUE (state)` + expiry on `linkedin_oauth_states` | Callback replay fails closed |
| `UNKNOWN_OUTCOME` handling | A lost response is never retried blindly; the user confirms |

---

## 13. What is *not* covered here

Honest gaps, most of which are operational rather than code:

1. **Rate-limit deployment** — the Postgres limiter must be wired up in
   production (`setApiRateLimiter`); the default in-memory limiter only protects
   a single instance.
2. **Token-encryption key rotation** — supported by the code, but the rotation
   runbook (write with the new key, re-encrypt, retire the old one) is an
   operator procedure.
3. **Supabase Auth hardening** — leaked-password protection, MFA and SMTP
   settings are configured in the Supabase dashboard, not in this repo.
4. **WAF / bot protection** at the edge, and DDoS protection, are Vercel-level
   concerns.
5. **Penetration testing and dependency scanning** have not been performed.
6. **LinkedIn Community Management API approval** is pending, so
   `r_member_postAnalytics` is disabled by default; the app degrades to a
   capability-gated state rather than faking analytics.
