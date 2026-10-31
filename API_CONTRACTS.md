# Zybble — API contracts

Every route is a Next.js Route Handler under `src/app/api/**`. They are built
with `defineRoute` (`src/lib/api/http.ts`), which gives one response envelope,
one error path, Zod validation and rate limiting for all of them.

This document is the contract between the server and the browser. Shapes are
given as TypeScript; every example response body is the `data` member of the
envelope.

---

## 0. Conventions

### Envelope

```ts
type ApiSuccess<T> = { ok: true;  data: T };
type ApiFailure    = { ok: false; error: { code: string; message: string; details?: unknown } };
```

`details` is populated for `validation_failed` (flattened Zod issues) and for
rate limits. Nothing else is ever serialised from an exception.

### Status codes

| Status | Meaning |
| --- | --- |
| 200 | Success |
| 201 | Created (`POST /api/auth/signup`, `/api/auth/onboarding`, `/api/posts`, `/api/workspaces`) |
| 202 | Accepted — work queued (`POST /api/posts/[id]/publish`) or a non-committal success (`POST /api/auth/password`, `/api/auth/verify`) |
| 400 | `bad_request` / `validation_failed` |
| 401 | `unauthenticated` — no session or an expired one |
| 402 | `entitlement_required` — the plan does not include this |
| 403 | `forbidden` — authenticated, but the role forbids it |
| 404 | `not_found` — also used for other tenants' rows, so ids cannot be probed |
| 409 | `conflict` — wrong state (e.g. editing a published post) |
| 429 | `rate_limited` — `Retry-After`, `X-RateLimit-*` headers |
| 503 | `external_service_unavailable`, `integration_not_configured` |
| 500 | `internal_error` — logged with the cause, returned generically |

### Authentication

Session cookies, refreshed by `src/lib/supabase/proxy.ts` on every request
(`@supabase/ssr` on Next 16.2.6). `auth: "required"` routes answer 401 when
there is no user.

### Workspace resolution

The active workspace comes from the httpOnly `zybble_workspace` cookie, or from
`?workspaceId=` / `X-Workspace-Id` when present. **It is re-validated against
the caller's memberships on every request** (`resolveWorkspace`), so a forged
cookie can only ever select a workspace the caller already belongs to.
`minimumRole` in the route config decides whether a route needs
`viewer | editor | admin`.

### Rate limits

Per IP for unauthenticated routes, per user+workspace for authenticated ones,
keyed by the route's `scope`. Limits are listed per endpoint below; responses
carry `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` and, on
429, `Retry-After`. The default limiter is in-memory (per instance); production
installs should swap in the Postgres limiter via `setApiRateLimiter()`.

### Errors are safe by construction

Internal errors are logged with their cause and returned as
`{ code: "internal_error", message: "…" }`. Stack traces, SQL text, provider
payloads, tokens and secrets never appear in a response. Supabase auth strings
are rewritten into sentences by `friendlyAuthError`, and any unrecognised
provider string is replaced with a generic message rather than echoed.

---

## 1. Auth — `/api/auth/*`

### `GET /api/auth/session`
Auth: required · 120/min

Returns the entire state the UI renders from. **The client trusts this, not
cookies.**

```ts
type SessionState = {
  user: { id: string; email: string | null; emailConfirmed: boolean };
  profile: { id: string; fullName: string | null; avatarUrl: string | null; timezone: string };
  workspaces: Array<{ id: string; name: string; slug: string; plan: "free" | "pro"; role: TeamRole }>;
  workspace: { id: string; name: string; slug: string; seats: number; timezone: string } | null;
  role: TeamRole | null;
  requiresOnboarding: boolean;
  entitlements: Entitlements;
  usage: UsageSnapshot;
  capabilities: { linkedin: LinkedinCapabilities; billing: boolean; email: boolean };
};
```

### `POST /api/auth/signup`
Auth: none · **5 / 15 min per IP** · 201

```ts
// body
{ email: string; password: string; fullName?: string; timezone?: string; redirectTo?: string }
// 201 data
{ requiresEmailConfirmation: boolean; userId: string; sessionState: SessionState | null }
```

Password minimum is **12 characters**. When email confirmation is on, Supabase
mails the link and `sessionState` is `null`; the client shows a "check your
inbox" state with a resend action. The audit event `auth.signup` records only
the email domain, never the address.

### `POST /api/auth/login`
Auth: none · **10 / 5 min per IP** · 200

```ts
// body
{ email: string; password: string }
// 200 data
SessionState
```

Wrong credentials return 401 `unauthenticated` with
`"That email and password combination is not correct."` Unconfirmed addresses
return 401 with a prompt to confirm. Both are deliberately indistinguishable
from each other for any other failure mode.

### `POST /api/auth/onboarding`
Auth: required · 10/min · 201

```ts
// body
{ workspaceName: string; timezone?: string; fullName?: string }
// 201 data
SessionState
```

Creates the first workspace through `public.create_workspace()` — workspace,
owner membership, subscription row and usage counter in one transaction.

### `POST /api/auth/password` — request a reset
Auth: none · **5 / 15 min per IP** · **202 always**

```ts
// body
{ email: string; redirectTo?: string }
// 202 data
{ requested: true }
```

The response is identical whether or not the address exists, so the endpoint
cannot be used to enumerate accounts. `redirectTo` is passed through
`safeReturnPath` (same-origin only).

### `PATCH /api/auth/password` — set a new password
Auth: required (recovery session) · 10 / 15 min · 200

```ts
// body
{ password: string }   // ≥ 12 characters
// 200 data
{ updated: true }
```

Only valid inside the recovery session established by
`GET /auth/callback?type=recovery`.

### `POST /api/auth/verify` — resend the confirmation email
Auth: none · 5 / 15 min per IP · **202 always** → `{ requested: true }`

### `PATCH /api/auth/profile` — name and timezone
Auth: required · 60/min · 200

```ts
// body (at least one field required)
{ fullName?: string | null; timezone?: string }
// 200 data
{ profile: { id, fullName, timezone, avatarUrl } }
```

**Email is not editable here.** Changing it in Supabase Auth requires
re-verification, and doing it silently would desynchronise `auth.users` from
`public.profiles`.

### `DELETE /api/auth/account` — erasure
Auth: required · **3 / hour** · 200

```ts
// body
{ password: string }
// 200 data
{ deleted: true; workspacesPurged: number; cancellationQueued: boolean }
```

Re-authenticates with the password first, then cancels billing for owned Pro
workspaces, purges owned workspace data, removes OAuth state rows and finally
deletes the auth user.

### `POST /api/auth/logout`
Auth: optional · 60/min → `{ signedOut: true }`

---

## 2. Workspaces — `/api/workspaces/*`

### `GET /api/workspaces` · 120/min
```ts
{ workspaces: Array<{ id, name, slug, plan, seats, timezone, createdAt }> }
```
RLS-scoped: only workspaces the caller belongs to.

### `POST /api/workspaces` · 10/min · 201
```ts
// body
{ name: string /* 1–80 */; timezone?: string }
// 201 data
{ workspace: { id, name, slug, plan, seats, timezone, createdAt } }
```

### `GET /api/workspaces/current` · 120/min
```ts
{
  workspace: { id, name, slug, plan, seats, timezone, createdAt },
  role: TeamRole,
  entitlements: Entitlements,
  usage: UsageSnapshot,
}
```

### `PATCH /api/workspaces/current` · admin only · 30/min
```ts
// body
{ name?: string; timezone?: string }
// 200 data — the same shape as GET
```

### `POST /api/workspaces/switch` · 60/min
```ts
// body
{ workspaceId: string /* uuid */ }
// 200 data
{ workspaceId: string }
```
Validated against real memberships before the cookie is written. The cookie is
httpOnly and server components read it during render, so the client must do a
full navigation (`window.location.reload()`) after switching — `router.refresh()`
alone leaves server components on the old workspace.

### `GET /api/workspaces/[workspaceId]/usage` · 120/min
```ts
UsageSnapshot = {
  plan: "free" | "pro";
  scheduledPostsUsed: number;
  scheduledPostsLimit: number | null;      // null = unlimited
  linkedinAccountsUsed: number;
  linkedinAccountsLimit: number;
  analyticsHistoryDays: 7 | 365;
}
```

### `GET /api/workspaces/[workspaceId]/members` · 120/min
```ts
{
  role: TeamRole;
  seats: number;
  members: Array<{
    id: string; userId: string; email: string; fullName: string | null;
    role: TeamRole; status: "active" | "pending" | "removed";
    joinedAt: string | null; invitedAt: string;
  }>;
}
```

### `POST /api/workspaces/[workspaceId]/members` · admin only · 10/min · 201
```ts
// body
{ email: string; role?: "admin" | "editor" | "viewer" /* default editor */ }
// 201 data
{ member: Member; seatSyncQueued: boolean }
```
Inviting beyond the Free plan's single seat returns 402. Seat sync is queued,
not awaited — the seat becomes billable when the invitation is accepted.

### `PATCH /api/workspaces/[workspaceId]/members/[memberId]` · admin · 30/min
```ts
// body
{ role: "admin" | "editor" | "viewer" }
```
409 when the change would leave the workspace without an owner
(`guard_workspace_owner()`).

### `DELETE /api/workspaces/[workspaceId]/members/[memberId]` · admin · 30/min
Marks the membership `removed`, which stops it counting as a billable seat.
Refuses to remove the last owner.

Identical endpoints exist under `/api/workspaces/current/members*` for the
cookie-resolved workspace.

---

## 3. LinkedIn — `/api/linkedin/*`

### `GET /api/linkedin/accounts` · 120/min
```ts
{
  accounts: Array<{
    id: string;
    providerMemberId: string;
    displayName: string | null;
    profileUrl: string | null;
    status: "active" | "expired" | "revoked" | "reauth_required";
    expiresAt: string | null;          // ISO instant, null when unknown
    refreshable: boolean;              // LinkedIn issues refresh tokens selectively
    capabilities: { canPublish: boolean; canReadAnalytics: boolean };
    tokenExpiresAt: string | null;
    lastVerifiedAt: string | null;
    lastErrorCode: string | null;
    lastErrorMessage: string | null;
    connectedAt: string;
  }>;
  capabilities: {
    configured: boolean;
    publishing: boolean;
    analytics: boolean;                // requires r_member_postAnalytics
    scopes: string[];
    blockers: string[];                // human-readable, shown in the UI
  };
  limits: { accountsUsed: number; accountsLimit: number };
}
```

### `GET /api/linkedin/connect` · admin · 10/min
Not JSON: **302** to LinkedIn's consent screen. A CSRF `state` is stored
(hashed) in `linkedin_oauth_states` and mirrored in a short-lived httpOnly
cookie. Returns 503 `integration_not_configured` when the app credentials are
missing — the UI shows the blocker rather than a dead button.

### `GET /api/linkedin/callback`
Called by LinkedIn. Verifies `state` against **both** the cookie and the stored
row, deletes the row (single use), exchanges the code, fetches
`/v2/userinfo`, stores the connection and encrypts the tokens. On any failure it
redirects to `/settings/linkedin?error=…` with a safe, enumerated reason —
never the raw provider error.

### `DELETE /api/linkedin/accounts/[accountId]` · admin · 30/min
Deletes the encrypted secrets row and marks the connection `revoked`
(`disconnected_at` set, `last_verified_at` cleared).
→ `{ disconnected: true }`. Posts that are already published keep their
analytics history; scheduled posts on a revoked account are never published,
because the publish pipeline only ever uses `active` connections.

### `POST /api/linkedin/accounts/[accountId]/recheck` · admin · **20/min**
Makes one LinkedIn call through the stored credential. A 401/403 flips the
account to `reauth_required`; anything else reports the failure without
changing the stored status.

```ts
// 200 data
{ status: "active" | "expired" | "revoked" | "reauth_required"; message: string | null }
```

---

## 4. Posts — `/api/posts/*`

### `GET /api/posts` · 180/min
```ts
// query
{ status?, from?, to?, accountId?, limit? /* 1–200, default 50 */ }
// 200 data
{
  posts: Array<{
    id: string;
    body: string;
    status: "draft" | "scheduled" | "publishing" | "published" | "failed" | "cancelled";
    scheduledAt: string | null;        // UTC instant
    timezone: string;                  // IANA zone the author chose
    publishedAt: string | null;
    authorAccount: { id: string; displayName: string | null } | null;
    permalink: string | null;          // derived from the LinkedIn URN
    media: Array<{ id: string; kind: "image" | "video" | "document"; url: string /* signed */ }>;
    failureCode: string | null;
    failureReason: string | null;
    attempts: number;
  }>;
}
```

### `POST /api/posts` · 60/min · 201
```ts
// body
{
  authorAccountId: string;             // uuid
  body?: string;                       // ≤ 3000 chars
  intent?: "draft" | "schedule" | "publish_now";   // default draft
  scheduleDate?: string;               // YYYY-MM-DD, required when intent=schedule
  scheduleTime?: string;               // HH:mm,     required when intent=schedule
  timezone?: string;                   // IANA; defaults to the workspace zone
  idempotencyKey?: string;             // 8–128 chars
  mediaAssetIds?: string[];            // ≤ 9
}
// 201 data
{ post: Post; publishJobQueued: boolean }
```

* `scheduleDate` + `scheduleTime` are interpreted in `timezone` and stored as a
  UTC instant. A slot inside a DST gap is **rejected** (400) rather than
  silently shifted an hour.
* `idempotencyKey` makes a retried submit return the original post
  (`UNIQUE (workspace_id, idempotency_key)`).
* Exceeding the Free plan's 10 scheduled posts returns **402**
  `entitlement_required`. The same rule is enforced by a SQL trigger, so a
  direct API call cannot bypass it.
* `publishJobQueued: false` means the post is scheduled but the Inngest run
  could not be enqueued; the dispatcher sweep will pick it up. The UI says so
  instead of implying success.

### `GET /api/posts/[postId]` · 180/min → `{ post: Post }`
404 for another workspace's post.

### `PATCH /api/posts/[postId]` · editor · 60/min
```ts
// body — any subset, plus:
{ status?: "draft" | "scheduled" | "cancelled"; /* …other create fields… */ }
// 200 data
{ post: Post; publishJobQueued: boolean }
```

* 409 when the post is `published` ("already live") or `publishing` ("being
  published right now").
* Rescheduling cancels the pending run **before** queueing a new one and uses
  the next attempt number, so the claim ledger never sees a duplicate.

### `POST /api/posts/[postId]/publish` · editor · 20/min · **202**
Moves the draft through `scheduled` (a few seconds out) so immediate publishing
uses the same durable, idempotent pipeline as scheduled publishing.
→ `{ post: Post; publishJobQueued: boolean }`

### `POST /api/posts/[postId]/cancel` · editor · 30/min
→ `{ post: Post }`. Cancels a scheduled post, emits `post/publish.cancelled`
and refunds the Free-plan slot through the usage trigger.

### `POST /api/posts/[postId]/retry` · editor · 20/min
→ `{ post: Post; publishJobQueued: boolean }`.

**409** when `failure_code === "UNKNOWN_OUTCOME"`: the previous attempt reached
LinkedIn and the outcome is unknown, so only the user can confirm whether it
published. Retrying automatically would risk a duplicate post.

### `POST /api/posts/media` · editor · 20/min · 201
```ts
// multipart/form-data
file: File; kind: "image" | "video" | "document"
// 201 data
{ asset: { id, kind, mimeType, sizeBytes, url /* signed, short-lived */ } }
// 400 on anything outside MEDIA_LIMITS
```

| Kind | MIME types | Max size | Max per post |
| --- | --- | --- | --- |
| image | `image/jpeg`, `image/png`, `image/gif` | 5 MB | 9 |
| video | `video/mp4` | 200 MB | 1 |
| document | `application/pdf` | 100 MB | 1 |

WebP is rejected deliberately: LinkedIn's Images API accepts JPG/GIF/PNG only,
so accepting it would fail *after* the user waited for the upload.

---

## 5. Calendar — `/api/calendar`

### `GET /api/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD&timezone=…` · 120/min

```ts
{
  timezone: string;                    // echoed back
  days: Array<{ date: string; posts: CalendarPost[] }>;
  bestTime: { cells: BestTimeCell[]; insufficientData: { requiredPosts: number; observedPosts: number } | null };
  usage: UsageSnapshot;
}
```

Day boundaries are computed in the requested IANA zone, so a post scheduled for
23:30 in `Asia/Kolkata` lands on the right day.

---

## 6. Analytics — `/api/analytics`

### `GET /api/analytics?range=7d|28d|12m&accountId=` · 120/min

```ts
{
  rangeDays: 7 | 28 | 365;             // 12m collapses to 28 on Free
  totals: { impressions: number; reactions: number; comments: number; reposts: number };
  deltas: { impressions: number | null; engagement: number | null };   // null = no prior period
  series: Array<{ date: string; impressions: number; engagement: number; engagementRate: number }>;
  topPosts: Array<{ id: string; body: string; publishedAt: string; impressions: number;
                    reactions: number; comments: number; reposts: number;
                    engagementRate: number; permalink: string | null }>;
  bestTime: {
    cells: Array<{ weekday: number; hour: number; score: number | null; sampleSize: number; confidence: number }>;
    insufficientData: { requiredPosts: number; observedPosts: number } | null;
    meta: { observations: number; topSlots: Array<{ weekday: number; hour: number; score: number }> } | null;
  };
  capabilities: {
    analyticsPermission: boolean;
    connectedAccounts: number;
    bestTimeUnlocked: boolean;
    historyDays: 7 | 365;
    note: string | null;
  };
}
```

* `range=12m` is a Pro entitlement; on Free it is **refused** (402) rather than
  silently truncated.
* Every number comes from `post_analytics` / `analytics_snapshots`, which are
  only ever written from LinkedIn API responses. Missing metrics stay `null`;
  nothing is estimated or back-filled.
* `bestTime` returns an explicit `insufficientData` object until the account has
  at least 12 observations. Scores are labelled as estimates in the UI.

### `POST /api/analytics/sync` · admin · 10/min · 202
Queues an analytics sync for the workspace. → `{ queued: true; posts: number }`

---

## 7. Billing — `/api/billing/*`

All billing reads are admin-only and reflect `public.subscriptions`, which is
written **only** by verified Dodo webhooks and the reconciler. No entitlement is
ever granted from a client claim.

### `GET /api/billing` · admin · 60/min
```ts
{
  plan: "free" | "pro";
  status: "none" | "pending" | "active" | "past_due" | "cancelled" | "trialing" | "expired";
  seats: number;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  customerId: string | null;
  subscriptionId: string | null;
  configured: boolean;                 // false = Dodo env vars missing
  entitlements: Entitlements;
  role: TeamRole;
}
```

### `POST /api/billing/checkout` · admin · 10/min
```ts
// body
{ seats?: number /* ignored: computed from active members */; returnPath?: string }
// 200 data
{ checkoutUrl: string; seats: number; monthlyAmountCents: number }
```
The seat count is derived server-side from active `workspace_members`
(minimum 1) and `metadata.workspace_id` is attached to the session. The
workspace becomes Pro when the verified `subscription.active` webhook lands —
not here.

### `POST /api/billing/portal` · admin · 10/min
```ts
{ portalUrl: string }        // 503 integration_not_configured when unavailable
```
The Dodo customer id comes from our own row; the browser never supplies one.

### `POST /api/billing/cancel` · admin · 10/min
```ts
// body
{ immediately?: boolean /* default false */ }
// 200 data
{ cancelAtPeriodEnd: boolean; cancelledAt: string | null; effectiveUntil: string | null }
```
Default is cancellation at period end; the workspace keeps Pro until then and
`effectivePlan()` demotes it automatically.

### `GET /api/billing/seats` · admin · 60/min
```ts
{
  seats: number;                       // active members, minimum 1
  seatPriceCents: 1500;
  monthlyAmountCents: number;          // 1500 × max(seats, 1)
  definition: "One seat = one active member of this workspace (minimum 1).";
}
```

### `POST /api/billing/seats` · admin · 10/min
Recomputes and pushes the seat count to Dodo (the same job membership events
enqueue).
```ts
{ seats: number; reason: "unchanged" | "updated" | "no_subscription" | "provider_unavailable" }
```
When the provider call fails the local count is still updated first, and the
error is retried — never swallowed.

---

## 8. Notifications — `/api/notifications/*`

### `GET /api/notifications?limit=` · 120/min
```ts
{
  notifications: Array<{
    id: string; type: string; title: string; body: string;
    read: boolean; createdAt: string; href: string | null;
  }>;
  unreadCount: number;
}
```
`limit` is 1–100, default 30. Rows are RLS-scoped to the caller, so a
workspace-wide notification can be read by every member without leaking
anything between workspaces.

### `PATCH /api/notifications` · 60/min
```ts
// body
{ ids?: string[]; read: boolean; all?: boolean }
// 200 data
{ updated: number; readAt: string }
```

### `GET /api/notifications/preferences` · 60/min · `PATCH` · 30/min
```ts
type NotificationPreferences = {
  email_post_published: boolean;
  email_post_failed: boolean;
  email_post_reminder: boolean;
  email_token_expiring: boolean;
  email_billing: boolean;
  email_product_updates: boolean;
  quiet_hours_start: number | null;    // 0–23, local hour
  quiet_hours_end: number | null;
};
```
PATCH accepts any subset. A missing row defaults to **enabled** for everything
except product updates. `welcome` and `team_invitation` are transactional and
are always sent regardless of preferences.

---

## 9. Invitations

### `GET /api/invitations?token=…` · auth optional · 30/min
Previews an invitation before sign-in. The raw token is hashed (SHA-256) before
it touches the query, and only the **email domain hint** is returned — the full
address is a login hint, not a public fact.

```ts
// 200 data
{
  valid: boolean;
  expired: boolean;
  role: TeamRole;
  workspaceName: string;
  invitedAt: string | null;
  emailHint: string;            // e.g. "****@acme.com"
}
```

An unknown, already-accepted, revoked or expired token returns
`{ valid: false }` — indistinguishable from every other rejection, so tokens
cannot be probed.

### `POST /api/invitations` · required · 10/min
```ts
// body
{ token: string }               // 10–200 chars
// 200 data
{ workspaceId: string; role: TeamRole }
```
Accepts the invitation (RPC `accept_workspace_invitation`), flips the membership
to `active` — which makes the seat billable — and queues a seat sync.

---

## 10. Webhooks and jobs

### `POST /api/webhooks/dodo`
Auth: **signature**, not session. Verifies the Standard Webhooks headers
(`webhook-id`, `webhook-signature`, `webhook-timestamp`) with HMAC-SHA256 over
`{id}.{timestamp}.{body}` using `whsec_…`, compared in constant time, with a
timestamp tolerance window.

Behaviour:

| Situation | Response |
| --- | --- |
| Signature invalid / stale | 401 / 400, body logged as `webhook.signature_invalid` |
| `event_id` already present | 200, no work performed (duplicate) |
| New event | 200 after processing; row marked `processed` |
| Processing failure | 500 so Dodo retries; row marked `failed` with the error |
| Unknown workspace | stored as `unmatched`, 200 (retrying can never help) |

Handled types: `subscription.active`, `subscription.renewed`,
`subscription.plan_changed`, `subscription.cancelled`, `subscription.failed`,
`subscription.on_hold`, `payment.succeeded`, `payment.failed`.

### `GET /api/cron/run` · Bearer `CRON_SECRET`
Runs the same sweep Inngest runs (dispatch due posts, reconcile stuck
publishes, seat sync, connection expiry) for deployments without Inngest.
→ `{ ran: string[]; at: string }`. 401 without the secret.

### `POST /api/inngest`
The Inngest serve endpoint. Not called by the browser.

### `GET /api/health` · none
```ts
{
  ok: boolean;                 // core only: Supabase + token encryption
  service: "zybble";
  environment: string;
  analyticsScopeEnabled: boolean;
  checks: {
    supabase: boolean; supabaseAdmin: boolean; linkedin: boolean;
    dodoPayments: boolean; resend: boolean; inngest: boolean;
    databaseUrl: boolean; tokenEncryption: boolean;
  };
}
```
Always **200**. `ok: false` means the app is up but a core integration is not —
which is the honest signal during a staged rollout. No secrets, no version
strings.

---

## 11. Failure semantics

The server never marks a failed operation successful. Concretely:

| Failure | What the client sees |
| --- | --- |
| LinkedIn down / 5xx | post `failed`, `failure_code: "LINKEDIN_UNAVAILABLE"`, retry offered |
| LinkedIn 429 | post stays `scheduled`, next attempt deferred with backoff |
| Token revoked/expired | account status `expired`/`revoked`, post `failed` with `TOKEN_INVALID`, reconnect prompt |
| Permission missing | capability-gated UI with the documented blocker; no publish attempt |
| LinkedIn returned after the call but we lost the response | `UNKNOWN_OUTCOME`, **no** automatic retry, user asked to confirm |
| Media upload failed | asset stays unattached, 400/503 with the specific reason |
| Supabase down | 503 `external_service_unavailable`, no partial write claimed |
| Dodo webhook failed | 500 so it retries; `webhook_events` row records the attempt |
| Resend failed | counted and logged; never fails the underlying operation |
| Inngest retry exhausted | post `failed` with a reason and a manual retry button |
| Inngest unreachable | `publishJobQueued: false` on the response |
