# DASHBOARD_HANDOFF — Prompt 2 (Application Frontend)

Status: **complete — frontend only.** No Supabase queries, OAuth, publishing, billing or email logic exists yet by design. The landing site from Prompt 1 is untouched and passing.

## Routes created

| Route | Type | Contents |
| --- | --- | --- |
| `/login` · `/signup` | (Prompt 1, kept) | Client-validated forms; "Forgot password?" now wired to the new route. |
| `/forgot-password` | Static | Reset form; honest notice that email delivery ships with Resend. |
| `/dashboard` | Static shell | Connect-LinkedIn hero, publishing overview (`StatCard`), upcoming content, recent performance (chart empty state), Pro best-time teaser, quick actions. |
| `/calendar` | Static shell | Month/week toggle, date-fns navigation, today highlighting, day-click quick-schedule dialog, unscheduled drafts strip, timezone label. |
| `/posts` | Static shell | Radix Tabs (Scheduled / Drafts / Published) with counts, row action menus, delete-confirmation dialog, per-tab empty states. |
| `/posts/new` | Dynamic (searchParams) | Full composer (below). Accepts `?date=` prefill from calendar. |
| `/posts/[postId]/edit` | Dynamic | Same composer hydrated from the local store; graceful not-found state. |
| `/analytics` | Static shell | Range tabs (7d / 28d / 12m-Pro), 4 metric cards, `TrendChart`, top-posts and `BestTimeHeatmap` with empty states, methodology note. |
| `/settings` | Static shell | Workspace identity + notification switches (Radix), save with honest "not persisted" notice. |
| `/settings/account` | Static shell | Profile form, security (sessions, disabled password change with reason), danger zone with destructive-action dialog. |
| `/settings/linkedin` | Static shell | Connections empty state, capability documentation, company-page option disabled with API-approval explanation. |
| `/settings/team` | Static shell | Members list (owner row), Pro-gated invite form with reason tooltips, upgrade panel. |
| `/settings/billing` | Static shell | Free/Pro plan cards with live local usage counter, payment/invoice honest empties, subscription status. |

All `/app/(app)/*` routes ship `robots: noindex` via the app layout.

## Architecture

- **Shell:** `(app)/layout.tsx` → fixed desktop sidebar + sticky topbar; mobile drawer (Radix Dialog). `SidebarContent` is shared by both. Route-aware topbar titles/actions come from `nav-config.ts`.
- **Interactivity:** Client Components only where the browser owns the state (composer, calendar, tabs, menus). Marketing pages remain server-rendered.
- **Local preview store:** `src/lib/app/local-posts.ts` — a `useSyncExternalStore`-backed localStorage store. Composer/calendar writes appear instantly on `/posts`, `/calendar`, `/dashboard`, `/notifications` and the sidebar plan card. **It is labelled "Local preview" everywhere it surfaces; nothing claims server persistence.**
- **Honesty mechanics:** no fabricated analytics anywhere; charts render `ChartFrame` empty/loading/error states; disabled controls always carry a tooltip explaining why; Pro features show value *and* the gate.

## Verification performed

`next typegen` ✓ · `tsc --noEmit` ✓ · `eslint .` ✓ (0 problems) · `next build` ✓ (all routes). Interaction paths verified by construction: dialog open/close, tab switching, calendar navigation, composer validation (3,000-char limit, future-time, image type/size ≤ 5 MB, ≤ 9 images), form error/alert roles, keyboard-focusable heatmap cells, reduced-motion respected.

---

# Data contracts required by Prompt 3

Canonical definitions live in **`src/lib/app/types.ts`** (import from there; do not redefine). Summary of what the backend must provide:

### Identity & workspace
- `UserProfile { id, name, email, avatarUrl|null, timezone }` — from Supabase Auth.
- `Workspace { id, name, slug, plan: "free"|"pro", seats, createdAt }`.
- `TeamMember { id, workspaceId, name, email, role: "owner"|"editor", status }`.

### LinkedIn connection (OAuth)
- `LinkedInAccount { id, workspaceId, kind: "member"|"organization", displayName, avatarUrl|null, profileUrn, status: "active"|"expired"|"revoked", connectedAt, scopes[] }`.
- Needed endpoints/routes: OAuth start/callback, `GET` list, `POST` reconnect, `DELETE` disconnect. Tokens encrypted at rest; `w_member_social` (+ OIDC profile) scopes.

### Posts (the `LocalPost` preview shape maps 1:1 onto this)
- `DashboardPost { id, workspaceId, authorAccountId, text, media: MediaAssetRef[], status: "draft"|"scheduled"|"published"|"failed", scheduledAt, timezone, publishedAt, linkedinPostUrn|null, failureReason|null, createdAt, updatedAt }`.
- `MediaAssetRef { id, kind: "image"|"video"|"document", name, mimeType, bytes, url|null }` — images only at launch (PNG/JPEG/GIF/WebP ≤ 5 MB, ≤ 9/post); video/document UI already gated for LinkedIn approval tiers.
- Endpoints: CRUD + list by status; **server-side Free-plan enforcement: 10 scheduled posts/month, 1 account** (Pro: 5 accounts, unlimited).
- Publishing: Inngest job at `scheduledAt` → LinkedIn API → set `publishedAt`/`linkedinPostUrn` or `failureReason` (drives the `failed` status + notification).

### Analytics
- `AnalyticsOverview { rangeDays: 7|28|365, totals, deltas, series: MetricPoint[], topPosts: TopPostRow[], bestTime: BestTimeCell[] }`.
- `MetricPoint { date, impressions, reactions, comments, reposts }` — verbatim LinkedIn API values.
- `BestTimeCell { weekday(0–6), hour, score: 0–1|null }`, audience-local, Pro-only.
- Chart components (`TrendChart`, `BestTimeHeatmap`) accept exactly these shapes, with `status: "ready"|"loading"|"empty"|"error"`.

### Billing & notifications
- `Subscription { plan, status, seats, currentPeriodEnd|null, paymentMethodBrand/Last4|null }`, `InvoiceRef[]` — from Dodo Payments webhooks.
- `NotificationItem { id, kind: "post_published"|"post_failed"|"token_expiring"|"system", title, body, createdAt, readAt|null }` — emitted by Inngest jobs; the topbar popover is ready for them.

## Replacement map (Prompt 3 work order)

1. Auth: Supabase email auth in `(auth)` forms → middleware guard on `(app)`.
2. Swap `local-posts.ts` reads for Supabase queries (keep `hooks.ts` signatures where convenient).
3. Wire connect dialog → LinkedIn OAuth start; store tokens; update `/settings/linkedin` list to real data.
4. Composer save → `POST /api/posts`; schedule → Inngest publish job.
5. Analytics page data props ← `GET /api/analytics?range=`.
6. Billing page ← Dodo webhook-synced `Subscription`; upgrade → checkout.
7. Settings forms → real mutations; notification switches → preferences table.

## Known notes

- Composer timezone: wall time is captured with the chosen IANA label for the backend; Prompt 3 must convert in canonical `Temporal`-safe logic.
- Uploaded image previews are session object-URLs (media metadata persists; binary syncs in Prompt 3).
- `/posts/new` and `/signup` are dynamic (await `searchParams`) by design.
