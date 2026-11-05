# Zybble — SEO Keyword → URL Map

**Date:** 2026-11-01 · Canonical host: `https://zybble.com`

Purpose: assign every target query exactly **one primary URL** so product pages and blog articles never compete with each other (cannibalisation), and define the internal-linking pattern that reinforces each assignment.

**How this map was built.** Priority keywords were set by the business (§1). For each, the live Google results were inspected to classify intent (see the observed SERP composition notes) and mapped to the page that can genuinely win that intent. **No search-volume or difficulty figures are quoted** — no verifiable third-party data source was available in this environment, and invented numbers would poison planning. Validate volumes/difficulty in Google Keyword Planner and, within weeks, in Search Console (the only numbers that actually matter — see `SEO_ACTION_PLAN.md` §Measurement).

---

## 1. Site-level keyword ownership model

| Layer | Owns | Examples |
|---|---|---|
| **Homepage** `/` | Brand + the broadest combined-intent head terms | "zybble", "linkedin scheduling and analytics tool" |
| **Product pages** | All commercial investigation & transactional queries ("tool", "software", "scheduler", "pricing", "for teams/agencies") | "linkedin post scheduler", "linkedin analytics tool" |
| **Pricing page** | Cost/purchase-intent modifiers | "linkedin scheduler pricing", "free linkedin scheduling tool" |
| **Blog articles** | Informational queries (how/what/why/when/best-time) | "best time to post on linkedin", "linkedin engagement rate" |
| **Category archives** | Browsable topical heads — never targeted individually, and **not in the sitemap** (see rule 5) | /blog/category/analytics |

**Rules enforced across the site**
1. A query gets exactly one primary URL (tables below). Secondary URLs may mention the topic but must not re-target the head term.
2. Every blog article ends its commercial sections by linking the relevant product page (with the product page's target query as anchor where natural).
3. Product pages link down to their supporting blog articles (depth + topical authority), never the reverse for the primary term.
4. Title pattern: **every page carries its own specified title**, set with `title.absolute` so the root layout's `%s · Zybble` template does not append a brand suffix. Titles are short enough to survive Google's ~60-character truncation. Where a title already contains "Zybble" (pricing, about, contact, security, privacy, terms, blog index) it does so because the query is brand-led.
5. **Category archives are not in the XML sitemap.** They aggregate articles that are already listed, so submitting both would ask Google to choose between two URLs for the same intent. The archives remain reachable by internal links for readers.

---

## 2. Priority keyword map (business-mandated terms)

### "LinkedIn Post Scheduler" → `/linkedin-scheduler` (primary), `/` (secondary)
- **Intent:** commercial investigation. **Funnel:** MOFU→BOFU.
- Product page owns the head term; homepage carries it in title only as combined-intent backup.
- Supporting articles link up with varied anchors ("LinkedIn scheduler", "scheduling tool"), never with the exact head phrase repeatedly.

### "LinkedIn Scheduling Tool" → `/linkedin-scheduler`
- **Intent:** commercial. Same owner as the head term — it is a synonym, not a separate battle. One URL per synonym cluster.

### "LinkedIn Analytics Tool" → `/linkedin-analytics`
- **Intent:** commercial. Product page owns it; `/` mentions analytics in the homepage title as the combined-intent variant only.

### "LinkedIn Post Analytics" → `/linkedin-analytics`
- **Intent:** commercial/mixed. Owned by the product page. Informational phrasings ("what analytics do linkedin posts have", "see linkedin post analytics") belong to the two metric articles below, which link up.

### "Best Time to Post on LinkedIn" → `/blog/how-to-find-your-best-time-to-post-on-linkedin`
- **Intent:** informational (the SERP is listicles + studies). **Funnel:** TOFU.
- The article targets the head term and its variants ("when to post", "best day to post"). The Pro best-time-insights feature is the product tie-in inside the article.
- **Do not** put "best time to post" in any product-page title — that would cannibalise the article's SERP slot with the wrong intent.

### "LinkedIn Content Calendar" → `/blog/how-to-build-linkedin-content-calendar` (primary)
- **Intent:** informational/how-to. This pillar owns the head term and "how to build/building a content calendar".
- `/blog/linkedin-content-calendar-for-busy-founders` targets **modified** queries only: "linkedin content calendar **for founders**", "founder linkedin content plan", "how often should founders post".
- `/blog/free-linkedin-content-calendar-template` targets **download** intent: "linkedin content calendar **template**", "free linkedin content calendar".
- All three cross-link in this order: template → founders system → pillar. The pillar links to the template as the "grab the artifact" escape hatch.

### "LinkedIn Engagement Tracker" → `/linkedin-analytics` (commercial) / `/blog/linkedin-engagement-rate-calculate-improve` (informational)
- **Intent split:** "tracker/tool" phrasing is commercial → product page; "how to calculate/track engagement rate" phrasing is informational → article. The article owns "linkedin engagement rate" and "how to calculate…"; it links up with "track engagement" anchors.

---

## 3. Full URL → keyword assignment (all 20 articles)

| URL | Primary keyword(s) | Secondary / long-tail | Intent | Funnel |
|---|---|---|---|---|
| `/` | zybble, linkedin scheduling and analytics | linkedin post scheduler (combined) | Brand + head | BOFU |
| `/linkedin-scheduler` | linkedin post scheduler, linkedin scheduling tool | schedule linkedin posts automatically, linkedin queue tool | Commercial | BOFU |
| `/linkedin-analytics` | linkedin analytics tool, linkedin post analytics | linkedin engagement tracker, track linkedin posts | Commercial | BOFU |
| `/pricing` | zybble pricing, linkedin scheduler pricing | free linkedin scheduler vs paid | Transactional | BOFU |
| `/blog` | zybble blog, linkedin marketing blog | — | Navigational | TOFU |
| `/blog/how-to-find-your-best-time-to-post-on-linkedin` | best time to post on linkedin | when to post on linkedin, best day to post on linkedin, linkedin posting times | Informational | TOFU |
| `/blog/how-to-build-linkedin-content-calendar` | linkedin content calendar, how to build a linkedin content calendar | linkedin content planning, linkedin posting schedule template | Informational | MOFU |
| `/blog/linkedin-content-calendar-for-busy-founders` | linkedin content calendar for founders | founder linkedin content plan, how often should founders post on linkedin | Informational | TOFU |
| `/blog/free-linkedin-content-calendar-template` | linkedin content calendar template | free linkedin content calendar template | Download | MOFU |
| `/blog/linkedin-engagement-rate-calculate-improve` | linkedin engagement rate, how to calculate linkedin engagement rate | good linkedin engagement rate, improve linkedin engagement, track linkedin engagement | Informational | MOFU |
| `/blog/linkedin-impressions-vs-reach-vs-engagement` | linkedin impressions vs reach | what is an impression on linkedin, linkedin reach vs engagement, linkedin metrics definitions | Informational | TOFU |
| `/blog/linkedin-analytics-beyond-vanity-metrics` | linkedin vanity metrics | linkedin metrics that matter, reading linkedin analytics | Informational | TOFU |
| `/blog/linkedin-content-roi-b2b` | linkedin content roi | linkedin lead generation for b2b, measure linkedin pipeline | Informational | MOFU |
| `/blog/linkedin-content-strategy-b2b-founders` | linkedin content strategy | b2b linkedin content plan, linkedin strategy for founders | Informational | MOFU |
| `/blog/linkedin-content-pillars-for-consultants` | linkedin content pillars | content pillars for consultants, linkedin niche topics | Informational | MOFU |
| `/blog/linkedin-thought-leadership-without-posting-daily` | linkedin thought leadership | linkedin authority building, linkedin personal brand without daily posting | Informational | MOFU |
| `/blog/why-consistency-beats-virality-on-linkedin` | linkedin consistency | how often to post on linkedin, linkedin posting frequency | Informational | TOFU |
| `/blog/does-scheduling-linkedin-posts-kill-your-reach` | does scheduling hurt linkedin reach | linkedin scheduling myth, linkedin algorithm scheduling | Informational | TOFU |
| `/blog/linkedin-hooks-that-capture-attention` | linkedin hooks | linkedin first line examples, linkedin opening lines | Informational | TOFU |
| `/blog/repurpose-one-idea-multiple-linkedin-posts` | repurpose linkedin content | one idea multiple linkedin posts, linkedin content recycling | Informational | MOFU |
| `/blog/linkedin-text-posts-vs-carousels-vs-video` | linkedin post formats | linkedin text post vs carousel, linkedin video vs text engagement | Informational | TOFU |
| `/blog/best-linkedin-scheduler-for-agencies-2026` | linkedin scheduler for agencies | best linkedin scheduling tools for teams (comparison intent) | Commercial-adjacent | MOFU |
| `/blog/linkedin-scheduler-for-multiple-accounts` | linkedin scheduler multiple accounts | manage multiple linkedin profiles, schedule for linkedin company page and profile | Commercial-adjacent | MOFU |
| `/blog/linkedin-free-scheduler-vs-paid-tools` | free linkedin scheduler | linkedin native scheduler vs tools, free vs paid scheduling tools | Commercial-adjacent | MOFU |
| `/blog/schedule-linkedin-post-with-first-comment` | schedule linkedin post with first comment | linkedin first comment link strategy | Informational | MOFU |
| `/blog/category/strategy` | (browsable hub) | — | — | — |
| `/blog/category/analytics` | (browsable hub) | — | — | — |
| `/blog/category/tools` | (browsable hub) | — | — | — |
| `/blog/category/writing` | (browsable hub) | — | — | — |

---

## 4. Cannibalisation watch-list (overlapping topics & their owners)

| Topic cluster | Owner (may rank) | Must NOT re-target | How the cluster interlinks |
|---|---|---|---|
| Best time to post | best-time article | scheduler/analytics product pages, consistency article | product pages mention "best-time insights" as a **feature name**, never as article-title phrasing |
| Content calendar | build-calendar pillar | founders article (uses "for founders" modifiers), template post (uses "template") | template → founders → pillar chain; pillar links back down |
| Engagement metrics | engagement-rate article | beyond-vanity article (owns "vanity metrics"), impressions-vs-reach article (owns definitions) | definitions article → rate article → ROI article |
| Scheduler tools | product pages (head terms) | agency/multi-account/free-vs-paid articles (modifier-rich "best…for" queries only) | articles compare honestly and link to `/linkedin-scheduler` and `/pricing` |
| Consistency/frequency | consistency article | founders calendar article (owns "founders" framing) | cross-link both ways with descriptive anchors |
| Thought leadership | thought-leadership article | consistency article (frequency angle) | thought-leadership links to consistency for the cadence rationale |

**Article-level keyword fields** (`keywords` in `src/lib/blog.ts`) mirror columns 2–3 of the table in §3 for the ten long-form pieces plus the four revised pieces, and are emitted as `keywords`/OG article tags.

---

## 5. Anchor-text conventions

- Internal links use natural, descriptive anchors ("how to calculate your engagement rate"), never "click here", never exact-match-stuffed repetition of the same head term from many pages.
- Product links from articles point to `/linkedin-scheduler` or `/linkedin-analytics` (never `/signup` — let the product page convert).
- External links: only primary sources (LinkedIn official documentation), `target="_blank" rel="noopener noreferrer"`, rendered in a visible "Sources" section.

## 6. Validation method (fill in real numbers after GSC access)

1. **Google Keyword Planner** (free with a Google Ads account): pull 12-month average monthly volume + competition for every query in §2 and §3; record against this table in a PR comment or spreadsheet. Do not paste invented numbers into these docs.
2. **Search Console Performance** (after ~2–4 weeks of data): export queries → impressions/CTR/position per URL; confirm each §2 keyword's impressions accrue to its assigned URL. If two URLs accrue impressions for the same query, resolve per §4 (retitle, re-anchor, or merge+redirect the loser).
3. Revisit quarterly; the map is a living document — date every change.
