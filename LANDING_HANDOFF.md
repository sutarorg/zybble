# LANDING_HANDOFF — Prompt 1 (Marketing Website)

Status: **complete — frontend only.** Dashboard, auth, LinkedIn OAuth, billing and email are intentionally not implemented.

## Routes created

| Route | Type | Notes |
| --- | --- | --- |
| `/` | Static | Hero, feature bento, how-it-works, scheduling showcase, analytics showcase, pricing teaser, FAQ, final CTA. JSON-LD: Organization, WebSite, SoftwareApplication (offers), FAQPage. |
| `/pricing` | Static | Two plans exactly per brief, full comparison table, billing FAQ. |
| `/linkedin-scheduler` | Static | Scheduler landing: hero + calendar illustration, capabilities, showcases. |
| `/linkedin-analytics` | Static | Analytics landing: hero + chart illustration, tracked-metric set, FAQ. |
| `/blog` | Static | Featured article + grid; 4 original articles. |
| `/blog/[slug]` | SSG | `generateStaticParams` × 4; Article JSON-LD; per-post OG/Twitter metadata; related posts. |
| `/privacy` · `/terms` | Static | Templates with visible "[owner to confirm]" markers (`LegalNotice`). |
| `/login` · `/signup` | Dynamic | Client-validated forms; honestly disclose backend is not wired (no fake success). `?plan=pro` context honoured on signup. |
| `/sitemap.xml` · `/robots.txt` · `/manifest.webmanifest` | Generated | From `sitemap.ts`, `robots.ts`, `manifest.ts`. |
| `*` | 404 | Branded `not-found.tsx`. |

## Components created

- **Layout:** `SiteHeader` (sticky, scroll-aware via `useSyncExternalStore`, Radix Dialog mobile sheet), `SiteFooter`, `Container`.
- **UI (shadcn pattern):** `Button`, `Badge`, `Accordion`, `Input`; `Logo`; `JsonLd`; `icons.tsx` (LinkedIn glyph).
- **Marketing:** `Hero`, `ProductPreview` (composer illustration), `FeatureBento`, `HowItWorks`, `SchedulingShowcase`, `AnalyticsShowcase`, `PricingSection`/`PlanCards`, `ComparisonTable`, `FaqSection`, `FinalCta`, `PageHero`, `SectionHeading`, `LegalNotice`.
- **Visuals:** `CalendarVisual`, `AnalyticsVisual` (shared, labelled illustrations; no fabricated metrics).
- **Motion:** `Reveal` (shared IntersectionObserver; reduced-motion + no-script safe).
- **Auth:** `AuthForm` (client-side validation only).

## Design decisions

- **Original identity** derived from the supplied logo: electric-blue gradient ribbon → `brand` scale; slate neutrals; white surfaces; restrained shadows. No gradients beyond subtle brand washes.
- **Varied section layouts** (bento, timeline, alternating splits, two-card pricing) instead of repeated 3-column cards.
- **Honesty mechanics:** product visuals labelled "Illustration"; analytics charts are relative ("indexed to your average"); composer uses skeleton copy; auth forms state plainly that submission is not connected yet.
- Server Components by default; Client Components only for scroll/mobile sheet, accordion and forms.

## Fonts & tokens

- Inter via `next/font` (`--font-inter`). Tokens in `globals.css` `@theme` — see `DESIGN_SYSTEM.md`.

## Assets

| Path | Source |
| --- | --- |
| `public/brand/logo.png` | Supplied logo (retrieved from the provided Drive link, unmodified) |
| `src/app/icon.png`, `src/app/apple-icon.png` | Same logo (favicon sizes) |
| `public/og/og-image.png` | AI-generated text-free brand artwork |
| `public/blog/*.png` (4) | AI-generated 16:9 editorial covers, blue/white palette |

No genuine vector source of the logo was available, so no `logo.svg` was fabricated.

## Dependencies added

`lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `@radix-ui/react-slot`, `@radix-ui/react-dialog`, `@radix-ui/react-accordion`, `@tailwindcss/typography`.

## SEO

`metadataBase` from `NEXT_PUBLIC_SITE_URL` (fallback `https://www.zybble.app`); unique title/description + canonical per page; OG/Twitter cards; `sitemap.ts` (routes + blog slugs); `robots.ts`; JSON-LD escaped per Next.js guidance; no ratings/reviews fabricated in structured data; semantic HTML with one H1 per page.

## Backend functionality still pending (Prompt 2/3)

1. **Auth** (Supabase Auth) replacing the disclosed auth-form stub; protect `/dashboard`.
2. **LinkedIn OAuth + publishing** via official API; **Inngest** jobs for scheduled publishing and retries.
3. **Analytics ingestion** from LinkedIn API into Postgres (Supabase/Drizzle `src/db`).
4. **Billing** via Dodo Payments with webhook-driven entitlement state; server-side plan-limit enforcement (Free: 1 account, 10 scheduled posts/mo; Pro: 5 seats, unlimited).
5. **Email** via Resend (transactional: welcome, publish-failure alerts, receipts).
6. Legal placeholders in `/privacy` and `/terms` marked `[owner to confirm]`.

## Known blockers / notes

- `NEXT_PUBLIC_SITE_URL` should be set to the final canonical domain before production deploy (affects canonical URLs, sitemap, robots, JSON-LD).
- LinkedIn API, Dodo Payments and Resend credentials are not yet configured; no integration is claimed as working.
- `/signup` renders dynamically because it reads `searchParams` (?plan=pro).
- Vulnerability notices in `npm audit` output originate from template-transitive packages; revisit before production hardening.

## Validation performed

`next typegen` ✓ · `tsc --noEmit` ✓ · `eslint .` ✓ (0 problems) · `next build` ✓ (20 routes, `/` + marketing pages static, blog SSG).
