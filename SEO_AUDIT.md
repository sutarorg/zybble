# Zybble — Complete SEO Audit & Corrections

**Date:** 2026-11-01
**Scope:** Entire public surface of zybble.com (marketing pages, product pages, blog, sitemap, robots.txt, structured data, redirects, private-route isolation), the full repository (`src/`, `next.config.ts`, deployment configuration) and the live production deployment.
**Method:** Repository review, live-site inspection of zybble.com (rendered HTML, `robots.txt`, `sitemap.xml`), index inspection via web search, and end-to-end verification against a production build of this branch. Where a claim in this document says "verified", it was tested against the running production build. No rankings or traffic data are claimed — no Search Console access exists in this environment; see `SEO_ACTION_PLAN.md` for the measurement plan.

---

## 1. Executive summary

The codebase was already structurally sound (per-page canonicals, OG/Twitter metadata, JSON-LD, noindex on private areas, SSG blog). The audit found and fixed **one critical live-production bug**, **one critical identity problem inherited from Zybble's previous website**, **six accurate-marketing violations**, and a set of sitemap/blog-quality issues.

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| 1 | **Critical** | Production `sitemap.xml` and `robots.txt` emitted `http://zybble.com` (no TLS) — confirmed on the live site before this work | ✅ Fixed + regression-tested |
| 2 | **Critical** | Google still indexes Zybble's **previous identity** ("Zybble AI Academy" — an AI-courses site) on zybble.com, including AI-prompt blog posts and fake-statistic marketing | ⚠️ Old URLs correctly 404; redirects + cleanup plan in place (partly manual, see §4) |
| 3 | **Critical** | `zybble.app` (retired domain) was the **fallback canonical** in marketing metadata (`src/lib/site.ts`), appeared in visible UI copy, and had no redirect to zybble.com | ✅ Fixed |
| 4 | **High** | `/signup` and `/login` were listed in the XML sitemap **while simultaneously disallowed in robots.txt** — a direct contradiction | ✅ Fixed |
| 5 | **High** | Sitemap `lastModified` used the **build timestamp** (`2026-11-01T09:53:26.185Z` live) — fake freshness on every deploy | ✅ Fixed |
| 6 | **High** | Marketing claimed capabilities that do not exist: drag-and-drop calendar, analytics export, scheduling in the audience's time zone | ✅ Copy corrected |
| 7 | **Medium** | 4 blog articles were thin (~300–350 words) with **inflated reading times**; 4 category archives held a single post each | ✅ Fixed |
| 8 | **Medium** | 12 of 20 articles had no target-keyword mapping; only 3 external citations existed across the whole blog | ✅ Improved (no fabricated sources) |
| 9 | **Low** | `next/font/google` made builds depend on reaching fonts.googleapis.com | ✅ Inter self-hosted (also removes a render dependency) |
| 10 | **Low** | No Google Search Console verification mechanism | ✅ Env-var support added |

---

## 2. Domain strategy (before → after)

### Before
- `src/lib/site.ts`: `const fallbackUrl = "https://www.zybble.app"` — every environment that lacked `NEXT_PUBLIC_SITE_URL` (and all metadata derived from it) silently pointed at the **retired** domain.
- Production set `NEXT_PUBLIC_SITE_URL=http://zybble.com` — no scheme upgrade anywhere, so canonical tags, OG URLs, `sitemap.xml` and `robots.txt` all emitted **HTTP** URLs on the live site (confirmed: `Sitemap: http://zybble.com/sitemap.xml` was served live).
- `www.zybble.com`, `zybble.app`, `www.zybble.app` had no redirects; visible UI said "Back to zybble.app" (auth pages) and `app.zybble.app/composer` (product preview illustration).

### After
- **`https://zybble.com` (apex, HTTPS) is the single canonical host**, encoded in one place (`CANONICAL_HOST` in `src/lib/site.ts`).
- `normaliseSiteUrl()` sanitises the configured URL defensively: forces HTTPS on every non-local host, folds `www.zybble.com` into the apex, strips trailing slashes, falls back to the canonical domain on garbage input. A repeat of the `http://` incident is now impossible even with a mistyped environment variable. (Unit-tested in `tests/lib/site.test.ts`.)
- Host-level permanent redirects added in `next.config.ts`:
  - `www.zybble.com/*` → `https://zybble.com/*`
  - `zybble.app/*` → `https://zybble.com/*`
  - `www.zybble.app/*` → `https://zybble.com/*`
  Verified: all three hosts return **308 → `https://zybble.com/<path>`** (308 is Next.js's permanent redirect; it is the method-preserving twin of 301 and is treated identically by Google).
- Visible copy corrected ("Back to zybble.com"; preview shows `zybble.com/posts/new`).
- `DEPLOYMENT.md` and `.env.example` updated to the canonical domain throughout (30 replacements in the deployment runbook).
- Default email sender changed from `no-reply@zybble.app` to `no-reply@zybble.com` (`src/lib/env.ts`). **Ops note:** the Resend sending domain must be verified for `zybble.com` (see Unresolved issues).

---

## 3. Live sitemap & robots.txt (before → after)

### Before (verified on the live site)
```
http://zybble.com/...                      ← HTTP, not HTTPS
http://zybble.com/signup                   ← auth page, robots-disallowed, in sitemap
http://zybble.com/login                    ← auth page, robots-disallowed, in sitemap
lastmod 2026-11-01T09:53:26.185Z (×9)      ← build timestamp, fake freshness
8 category archives                        ← four of them contain exactly 1 post
```

### After (verified on the production build)
```
https://zybble.com/                        ← 7 static routes, launch-dated, no auth routes
https://zybble.com/blog/<slug> ×20         ← lastModified = article publish/revision date
https://zybble.com/blog/category/<slug> ×4 ← lastModified = newest article in that category
robots.txt → Sitemap: https://zybble.com/sitemap.xml
```
- **31 entries total. Every URL is `https://zybble.com`.** Login, signup, dashboard, calendar, posts, analytics, settings, onboarding are excluded (and remain noindexed + robots-disallowed + `X-Robots-Tag`-protected).
- `lastModified` is now derived from real content dates; rebuilds no longer fake freshness. Blog-index `lastModified` tracks the newest article; category archives track the newest article they contain.
- Regression-guarded by `e2e/public-site.spec.ts` (no auth paths, all `https://zybble.com/`, ≥20 entries, articles present).

---

## 4. Previous-identity index cleanup ("Zybble AI Academy")

Search-engine inspection confirmed the old identity is still indexed on zybble.com, e.g.:

| Old indexed URL | What Google shows | Current status | Action |
|---|---|---|---|
| `zybble.com/` | "Zybble AI Academy — Master AI Skills…" with student testimonials ("4.9/5 from 1,200+ students") and brand logos | Homepage now serves the LinkedIn scheduler identity; old content replaced | None possible in code — recrawl replaces it (accelerate via GSC, see action plan) |
| `zybble.com/blog/viral-wealth-money-finance-videos` | AI prompt pack article | **Verified: returns a true HTTP 404** with a helpful custom 404 page | Correct response — no equivalent content exists, so a redirect would be misleading. Let it decay out of the index; optionally request removal in GSC |
| Old nav pages (`/courses`, `/about`, `/reviews`, `/faq`) | AI-course pages | **Verified representative URLs return 404** | Same — correct 404s; no relevant equivalent to redirect to |

**Principles applied:** redirects are only used where a genuinely relevant page exists (never to fake relevance — that is treated as soft spam); retired unrelated content 404s properly with a navigable, branded 404 page; the new identity is consolidated at the host level (§2) so any `zybble.app` links also flow to zybble.com.

**Manual follow-ups** (cannot be done from this repository): request removal of the highest-profile stale snippets in Search Console once verified, and re-request indexing of the homepage. Listed in `SEO_ACTION_PLAN.md`.

---

## 5. Indexing, canonicals and private-surface isolation

Verified against the production build — **all 31 public URLs** (7 static + 20 articles + 4 archives):

- ✅ HTTP 200, exactly **one `<h1>`** each.
- ✅ `<link rel="canonical">` present on every page, pointing at its own `https://zybble.com/…` URL (homepage canonical is `https://zybble.com`).
- ✅ `meta robots` **absent (indexable)** on every public page; no stray `noindex`.
- ✅ OG + Twitter card tags on every page (`og:title`, `og:description`, `og:url`, `og:image`, `article:published_time`/`modified_time` on articles, 1200×630 OG image verified present at `/og/og-image.png`).
- ✅ Unique `<title>` per page via the root template (`%s · Zybble`).
- Private surfaces (verified):
  - `/dashboard`, `/settings/*`, `/onboarding`, `/calendar`, `/posts`, `/analytics` → unauthenticated requests redirect (307) **with `X-Robots-Tag: noindex, nofollow`** header; authenticated app shell metadata also sets `noindex`.
  - `/login`, `/signup`, `/forgot-password`, `/reset-password` → **verified `noindex, nofollow` meta robots**; excluded from sitemap; disallowed in robots.txt; `no-store` cache headers via next.config.
  - `/api/*` → robots-disallowed, `no-store`.
- ✅ Unknown routes (old-identity URLs, garbage slugs) return a **true 404** (not soft-200), with the branded not-found page.

### Google Search Console readiness
- `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` env var added: when set, the `google-site-verification` meta tag renders on every page (documented in `DEPLOYMENT.md` and `.env.example`).
- robots.txt is served at the canonical host with an absolute HTTPS sitemap pointer, as GSC expects.

---

## 6. Structured data (all blocks parsed and validated)

| Template | JSON-LD emitted | Notes |
|---|---|---|
| Homepage | `Organization`, `WebSite`, `SoftwareApplication` (two honest `Offer`s: $0 and $15/seat), `FAQPage` | No ratings/reviews fabricated — no `aggregateRating` anywhere, correctly |
| `/linkedin-scheduler`, `/linkedin-analytics`, `/pricing` | `WebPage` | Claims in copy match entitlements (see §9) |
| Blog article | `Article` (author/publisher = the Zybble Organization, dates, optional `dateModified` only when genuinely revised, keywords), `BreadcrumbList`, `FAQPage` (only when the article contains real Q&A) | |
| Blog category | `BreadcrumbList` | |
| 404 | none | Correct |

- FAQ structured data is only emitted where visible Q&A pairs exist on the page (matches Google's guidelines).
- Every block was JSON-parsed and validated in testing; `<` escaping follows Next.js guidance.

---

## 7. Blog audit (20 articles)

### 7.1 Reading times — fixed at the root
Four articles carried **inflated hand-written estimates** (a ~350-word article labelled "6 min read"); eleven long reads were labelled a flat "16 min read". The `readingTime` string field was **removed from the data model entirely** and replaced by `readingTimeFor()`, which computes minutes from the article's actual word count (~210 wpm, floored at 1). Estimates can no longer drift. Regression-tested in `tests/lib/site.test.ts`.

### 7.2 Thin articles — expanded with substance (no filler)
The four thinnest articles (~300–350 words) targeted valuable informational queries and could not compete. Each was rewritten to a genuinely useful length, **preserving all original prose and its voice**, adding: worked examples, decision frameworks, tables, FAQs (rendered + FAQPage schema), internal links, and honest product ties:

| Article | Before | After |
|---|---|---|
| `how-to-find-your-best-time-to-post-on-linkedin` | ~350 words | ~1,300 words: why generic advice fails (3 mechanisms), worked 3-slot experiment table, how to read results without fooling yourself, 4-question FAQ, links to engagement-rate & impressions-vs-reach articles |
| `linkedin-content-calendar-for-busy-founders` | ~350 words | ~1,100 words: 45-minute weekly agenda, filled-in example week (table), recovery protocol for bad weeks, 4-question FAQ, links to build-a-calendar guide and the free template |
| `linkedin-analytics-beyond-vanity-metrics` | ~300 words | ~1,300 words: metrics defined honestly, worked engagement-rate calculation (explicitly framed as arithmetic illustration), why benchmarks are folklore, buyer-quality comment tally, 4-question FAQ, links to metrics articles |
| `why-consistency-beats-virality-on-linkedin` | ~330 words | ~1,000 words: three hidden costs of virality-chasing, honest timeline, myth-retirement on scheduling & reach, 4-question FAQ, links to thought-leadership and founder-calendar articles |

Each revised article carries `updatedAt: 2026-11-01` (its genuine revision date) — surfaced in the byline, OG `article:modified_time`, `dateModified`, and the sitemap.

### 7.3 Category architecture — consolidated from 8 thin archives to 4 useful hubs
| Before (8) | Posts | After (4) | Posts |
|---|---|---|---|
| Strategy | 6 | **Strategy** | 7 |
| Analytics | 5 | **Analytics** | 5 |
| Tools | 3 | **Tools** | 5 |
| Writing | 2 | **Writing** | 3 |
| Formats / How-to / Resources / Scheduling | 1 each | *(merged)* | — |

Merges: Scheduling→Strategy, How-to→Tools, Resources→Tools, Formats→Writing. All four surviving archives have ≥3 posts and function as real topical hubs. **Retired archive URLs permanently redirect** (verified 308): `/blog/category/scheduling→strategy`, `/blog/category/how-to→tools`, `/blog/category/resources→tools`, `/blog/category/formats→writing`. The sitemap lists only the four live archives.

### 7.4 Author credibility & sources
- Article pages now show an explicit **"About the author"** note: written by the team that builds the product — honest, no invented personas or borrowed credentials.
- A `sources` field was added and renders as a visible **"Sources and further reading"** section. The two articles that make claims about LinkedIn mechanics (impressions/reach definitions; format specs) now list LinkedIn's official help-centre documentation — the only external citations that could be verified, so nothing was invented.
- Fabrication guardrails retained: no invented statistics, studies, benchmarks, reviews or testimonials anywhere in the content or structured data.

### 7.5 Internal linking
The four revised articles now interlink each other and the relevant long-form pillars (engagement rate, impressions vs reach, build-a-calendar, content ROI, thought leadership, does-scheduling-kill-reach) plus the two product pages. **Verified: every internal `href` across all 31 public pages resolves (no broken links).**

### 7.6 All published articles live
All 20 articles render at `/blog/<slug>` (verified 200 + canonical + JSON-LD) and all 20 appear in the sitemap.

---

## 8. Duplicate pages & keyword overlap

- No duplicate content templates exist (each URL has a unique title/description/canonical; no pagination or parameterised duplicates).
- **Cannibalisation risk resolved for the highest-overlap cluster** — three articles previously competed for "LinkedIn content calendar": the keyword map (`SEO_KEYWORD_MAP.md`) now assigns the head term to the pillar guide (`/blog/how-to-build-linkedin-content-calendar`), "for founders"-modified queries to the founders article, and the template/download intent to the template post. "Best time to post", "engagement rate" and "scheduler tool" clusters were similarly assigned primary/secondary owners.
- Product pages own all commercial/modifier keywords; blog articles own informational queries and link commercial intent to the product pages (every revised article does exactly this).

---

## 9. Content & product accuracy (claims vs. verified capabilities)

Every marketing claim was checked against the entitlements code (`src/features/billing/entitlements.ts`), the publishing pipeline and the app UI:

| Claim | Verdict | Evidence |
|---|---|---|
| Free: 1 account, 10 scheduled posts/mo, unlimited drafts, 7-day analytics, calendar | ✅ True | `PLAN_ENTITLEMENTS.free`; usage snapshot tests |
| Pro: $15/seat, 5 accounts, unlimited scheduling, 12-month analytics, best-time insights, team collab | ✅ True | `PLAN_ENTITLEMENTS.pro` (`analyticsHistoryDays: 365`), `PRO_SEAT_PRICE_CENTS = 1500` |
| Publishing via official LinkedIn OAuth/API; "never asks for your password" | ✅ True | `src/lib/linkedin/oauth.ts`; no password flows exist |
| Analytics shown "never substitute invented numbers" | ✅ True | capability-gated analytics service; documented constraint handling |
| **"Drag a draft onto a day and it becomes a plan"** (homepage bento) | ❌ **False — fixed** | No drag implementation exists anywhere. Copy now: "Tap any day to start a post right there — a plan in two clicks." (true: day tap → prefilled schedule dialog, verified in `calendar/page.tsx`) |
| **"…drag onto the calendar…"** (scheduler page) | ❌ **False — fixed** | Rewritten to the real flow: queue from composer, tap a day, or pick exact time |
| **"Export when you need the numbers elsewhere"** (homepage) | ❌ **False — fixed** | No export feature exists. Copy: "read at a glance, no spreadsheet required" |
| **Analytics FAQ: "Can I export my analytics? — Yes…"** | ❌ **False — fixed** | Replaced with a truthful "Where does my analytics data come from?" answer (LinkedIn API, no invented figures) |
| **"Schedule in your audience's time zone… their Tuesday 9:30"** (homepage showcase) | ❌ **False — fixed** | Scheduling uses the *user's* detected local timezone (`useLocalTimezone`). Copy now describes exact-moment publishing in your own timezone. Product preview now reads "your local time" |
| **Privacy policy: "Export your data … from workspace settings at any time"** | ❌ **False — fixed** | No self-serve export exists in settings. Reworded truthfully (data visible in workspace; portable copy on request) |
| Blog article "schedule first comment" | ✅ Honest | The article explicitly describes manual workflows and "the honest limits of scheduling tools"; it never claims Zybble auto-posts first comments (which the product does not do) |

Remaining `[owner to confirm]` placeholders in `privacy` and `terms` (hosting regions, retention, contact addresses) are flagged in Unresolved issues — they are legal-content gaps, not SEO blockers, but they should not ship to a production privacy policy unresolved.

---

## 10. Technical SEO & performance

- **Rendering:** homepage, product pages, pricing, legal pages, blog index, **all 20 articles and all 4 archives are statically prerendered (SSG)** — verified in the build output. Fast, cacheable, fully crawlable HTML without client-side rendering dependencies.
- **Fonts:** Inter self-hosted as a variable woff2 (latin + latin-ext, 130 KB total) via `next/font/local` with `display: swap` — eliminates the fonts.googleapis.com build/runtime dependency and a blocking third-party request (helps LCP).
- **Images:** all covers served through `next/image` (responsive `sizes`, lazy by default, `priority` on the article hero); OG image verified at exactly 1200×630; blog covers are pre-sized 1376×768 JPEGs (84–170 KB).
- **Security/SEO headers** (verified on the production build): HSTS `max-age=63072000; includeSubDomains; preload` (production only), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN`, `Permissions-Policy`, `X-Powered-By` absent, `no-store` on private/API surfaces.
- **Mobile-first:** responsive layouts are covered by the repo's three-viewport e2e matrix (desktop/mobile Chromium + tablet) and responsive specs; viewport meta with `width=device-width, initial-scale=1`.
- **Accessibility:** axe-based e2e tests exist for public pages; the marketing surface passed this repo's WCAG 2.x A/AA checks in CI. (Re-run in this sandbox was not possible — see Test results.)

---

## 11. Test results (this environment)

| Check | Result |
|---|---|
| `next build` (production) | ✅ Passes; all public routes prerendered |
| `tsc --noEmit` | ✅ Passes |
| `eslint .` | ✅ Passes |
| `vitest` full suite (19 files) | ✅ **231/231 pass**, including 10 new SEO unit tests |
| Sitemap content (31 URLs: HTTPS, canonical host, no auth routes, real dates) | ✅ Verified over HTTP against production build |
| robots.txt (HTTPS sitemap pointer, private paths disallowed) | ✅ Verified |
| All 31 public URLs: 200 + 1×h1 + canonical + indexable + OG + valid JSON-LD | ✅ Verified |
| Internal links across all public pages | ✅ Zero broken |
| Retired category + host redirects | ✅ Verified (308 permanent) |
| Old-identity URLs | ✅ Verified true 404 |
| Private routes noindex (meta + `X-Robots-Tag`) | ✅ Verified |
| Playwright e2e suite | ⚠️ Not runnable here (browser CDN blocked in this sandbox; it runs in the project's GitHub Actions CI). Updated with new assertions: sitemap purity, redirect targets, 404 status |
| Lighthouse / PageSpeed Insights | ⚠️ Not runnable here (no browser in sandbox). Runbook provided in `SEO_ACTION_PLAN.md` |

---

## 12. Unresolved issues & honest limitations

1. **Google Search Console** — verification, sitemap submission, stale-content removal requests and URL inspection are interactive products; they require a human with domain access. Everything on the site's side is ready (meta-tag verification support, clean sitemap/robots). No ranking or indexing improvements are claimed until GSC shows them.
2. **DNS / registrar** — the host redirects only fire for hosts that route to the deployment. Confirm in the Vercel domain settings that `zybble.com` is the primary domain and that `www.zybble.com`, `zybble.app`, `www.zybble.app` are attached and 301-redirecting at the edge too (belt-and-braces alongside the in-app redirects).
3. **Stale SERP snippets for the old identity** — these decay as Google recrawls; the GSC removals/inspection steps in the action plan accelerate them. No code can force this.
4. **LinkedIn API permissions** — member post-analytics requires LinkedIn's Community Management API approval (`LINKEDIN_ANALYTICS_SCOPE_ENABLED` stays `false` until granted). Marketing copy correctly does **not** advertise the gated advanced analytics as universally available.
5. **Privacy/Terms `[owner to confirm]` placeholders** — hosting regions, retention periods, privacy contact email, deletion SLA must be filled in by the owner before the privacy policy can be considered accurate.
6. **Email sender domain** — the default sender is now `no-reply@zybble.com`; the Resend sending domain (`send.zybble.com`, DKIM/SPF/DMARC) must be re-verified for the new domain.
7. **Search volume numbers** — no reliable third-party volume data could be verified from this environment, and none is invented; `SEO_KEYWORD_MAP.md` maps keywords to URLs by intent and observed SERP composition, with a documented method to validate volumes in Keyword Planner/GSC.

---

*Companion documents: `SEO_KEYWORD_MAP.md` (keyword → URL mapping and cannibalisation rules), `SEO_ACTION_PLAN.md` (prioritised growth plan and measurement runbook).*
