# Zybble — SEO Action Plan

**Date:** 2026-11-01 · Companion to `SEO_AUDIT.md` and `SEO_KEYWORD_MAP.md`.

This plan contains only actions with a real mechanism behind them. Where an action depends on data (Search Console, Lighthouse) that requires interactive access or a browser not available in this environment, it is written as a runbook with exact steps and pass/fail criteria — not as a promise of outcomes. **No ranking, traffic or conversion improvements are claimed anywhere in this document.**

---

## Phase 0 — Ship & verify (week 0, after this branch deploys)

### 0.1 Domain & redirects (owner: whoever holds Vercel/DNS access)
- [ ] In Vercel → Project → Domains: ensure `zybble.com` is the **primary** domain; attach `www.zybble.com`, `zybble.app`, `www.zybble.app` as redirects to it.
- [ ] Confirm `NEXT_PUBLIC_SITE_URL=https://zybble.com` in production env vars. (Even if it is misconfigured as `http://…`, the new `normaliseSiteUrl()` guard forces HTTPS + apex — but set it correctly anyway.)
- [ ] Verify with:
  ```bash
  curl -sI https://www.zybble.com/ | head -5        # expect 301/308 → https://zybble.com/
  curl -sI https://zybble.app/       | head -5      # expect 301/308 → https://zybble.com/
  curl -s  https://zybble.com/sitemap.xml | head -3 # expect https://zybble.com URLs only
  curl -s  https://zybble.com/robots.txt                  # expect Sitemap: https://zybble.com/sitemap.xml
  ```

### 0.2 Google Search Console (owner: domain admin)
- [ ] Add a **Domain** property for `zybble.com` (covers subdomains/protocols) — verify via the DNS TXT record (most robust) or set `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` for URL-prefix verification (renders the meta tag automatically; documented in `DEPLOYMENT.md`).
- [ ] Submit `https://zybble.com/sitemap.xml` under Sitemaps.
- [ ] **Request removal** (Removals tool, ~6-month cache removal) of the most visible stale "Zybble AI Academy" results, starting with the homepage snippet if it still shows course/testimonial content, and `zybble.com/blog/viral-wealth-money-finance-videos`.
- [ ] **URL Inspection → Request indexing** for: `/`, `/linkedin-scheduler`, `/linkedin-analytics`, `/pricing`, `/blog`, and the four revised articles (best time, founders calendar, vanity metrics, consistency).
- [ ] Check **Settings → Crawl stats** after two weeks for 404 spikes from old-identity URLs (expected and harmless; they should decay — investigate only if they grow).

### 0.3 Re-verify the email domain (owner: ops)
- [ ] Verify `zybble.com` (or `send.zybble.com`) in Resend: SPF, DKIM, DMARC records. The app default sender is now `no-reply@zybble.com`.

### 0.4 Legal copy (owner: founder/legal)
- [ ] Fill the `[owner to confirm]` placeholders in `/privacy` and `/terms` (hosting regions, sub-processors, retention, privacy contact, deletion SLA). A privacy policy with placeholder text is a trust and compliance liability.

---

## Phase 1 — Measure baselines (weeks 1–2)

### 1.1 Core Web Vitals / Lighthouse runbook (browser required)
1. Run PageSpeed Insights (mobile **and** desktop) for: `/`, `/linkedin-scheduler`, `/linkedin-analytics`, `/pricing`, `/blog`, and one long article (e.g. `/blog/linkedin-content-roi-b2b`). Record LCP, INP, CLS, TTFB.
2. In Chrome DevTools → Lighthouse (mobile, "Navigation") for the same URLs; archive the HTML reports in the repo (e.g. `docs/lighthouse/<date>/`).
3. **Pass criteria:** LCP < 2.5 s and CLS < 0.1 at p75 on mobile for all audited URLs; no accessibility score < 95.
4. If LCP fails on a blog page, first suspects in order: cover-image sizing (already `next/image` with `priority` on heroes), any render-blocking third party (none today), font loading (self-hosted + `display: swap` today).
5. Re-run monthly; keep before/after artefacts. **Do not edit pages for scores you have not measured.**

### 1.2 Structured data validation (browser required)
- Google **Rich Results Test** on `/` (expect Organization, WebSite, SoftwareApplication, FAQPage detected), one article (expect Article + BreadcrumbList + FAQPage), one category (BreadcrumbList), `/pricing` (WebPage).
- Schema.org validator on the same URLs; fix any warning that reflects a real mismatch between markup and visible content.

### 1.3 GSC baselines (after verification)
- Record starting positions/impressions for the seven priority keywords (`SEO_KEYWORD_MAP.md` §2) per URL — this becomes the honest before/after record.
- Watch **Pages → Why pages aren't indexed**: expect old-identity URLs under "Not Found (404)" — correct behaviour; anything else (esp. "Crawled - currently not indexed" on new pages) investigate.

---

## Phase 2 — Content & topical authority (weeks 2–8)

### 2.1 Fill genuine topical gaps (one article every 1–2 weeks, only where it adds value)
High-value gaps consistent with the keyword map, in priority order:
1. **"LinkedIn analytics for agencies"** (client-reporting angle) — supports the Tools hub and the agency-comparison article; targets a commercial-adjacent informational query Zybble can answer from real product practice.
2. **"LinkedIn company page vs personal profile"** — high-volume definitional query; interlinks founders-calendar and thought-leadership articles.
3. **"How often should you post on LinkedIn"** — *only if* GSC shows the consistency article isn't capturing it; otherwise skip (avoid creating the cannibalisation §4 warns about).
4. **"LinkedIn scheduling timezone guide"** — supports the corrected timezone copy honestly.
Rule: each new article must (a) map to one unowned query in `SEO_KEYWORD_MAP.md`, (b) contain original practical value, (c) link its hub article and its product page. No filler pieces.

### 2.2 Strengthen the four hubs
- Each category archive is a genuine hub (≥3 posts). Add a 2–3 sentence editorial intro to each archive describing who it's for and its best articles (small, honest change; helps the archive be more than a link list).
- Keep "Keep reading" relevance: spot-check `getRelated()` output monthly.

### 2.3 Digital PR / links (honest tactics only)
- Publish the content-calendar CSV template on the blog post and submit to relevant newsletter roundups; templates earn links.
- Original practical data is the durable link asset: when Zybble has real (privacy-safe, aggregated) publishing data, publish a methodology-transparent study. **Until then, no fake statistics, no fabricated surveys, no purchased links.**

---

## Phase 3 — Conversion & measurement loop (ongoing)

### 3.1 Weekly (15 min)
- GSC Performance, last 7 days: any query gaining impressions where the "wrong" URL is ranking → resolve per keyword-map §4.
- 404 report: new 404s from real referrers → 301 only if a genuinely relevant page exists.

### 3.2 Monthly
- PageSpeed mobile p75 for the six audited URLs; compare to baseline.
- Index coverage: all 31 sitemap URLs indexed or intentionally pending; zero private URLs indexed (spot-check `site:zybble.com/dashboard` etc. in a logged-out browser).
- Update `SEO_AUDIT.md` §11 test table if the stack changes.

### 3.3 Quarterly
- Re-run the timing/content experiments described in the revised articles on Zybble's own accounts and update the articles with what was learned (first-party expertise compounds).
- Re-check LinkedIn help-centre citations (the two `sources` entries) for URL/doc changes.

---

## Explicit non-goals & guardrails

- No fake reviews, ratings, testimonials, statistics or "as seen in" logos — in copy or in structured data.
- No redirects from retired old-identity URLs to unrelated pages (404 is the correct, spam-safe response).
- No AI-generated filler articles; every published piece needs a reason to exist (§2.1 rule).
- No promises of rankings — internal reporting uses GSC impressions/clicks/positions, never "we'll be #1".
- No advertising of analytics or publishing capabilities LinkedIn has not yet approved for the product (`LINKEDIN_ANALYTICS_SCOPE_ENABLED` stays off until Community Management API approval).
