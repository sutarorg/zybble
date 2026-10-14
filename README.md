# Zybble

A demo AI-course marketplace built with Next.js. Zybble showcases four complete shells in one app:

| Shell | Base path | What it demonstrates |
| --- | --- | --- |
| Public | `/` (catalog, formerly `/explore`), `/courses/[slug]`, `/instructors/[username]`, `/help`, `/about`, … | Catalog browsing, search, filters, course detail, instructor profiles |
| Learner certificates | `/certificates` (inside the learner shell) | Earned certificates, opened with the learner sidebar in place |
| Learner | `/dashboard`, `/my-learning`, `/orders`, `/wishlist`, `/messages`, `/settings`, `/learn/[courseId]` | Enrolled courses, progress, simulated lesson player with notes, resources and completion certificates |
| Creator | `/creator/*` | Course creation wizard, curriculum editor, pricing, publish flow, analytics, earnings, payouts |
| Admin | `/admin/*` | Moderation queue, users, orders, payouts, categories, reports, settings |

Everything is client-side and mock-data driven: there is no storefront API, no auth server and no payment provider. Account state and activity (enrollments, notes, progress, creator drafts, admin settings) live in a shared **in-memory document session**. Client-side navigation keeps them; a refresh starts signed out with a clean learner and creator workspace. Legacy Zybble localStorage account/activity keys are removed on hydration. Only the interface-language preference is saved between refreshes.

## Requirements

- Node.js 22.17+ (22.x) or 24+; the packaged browser tests require these versions
- npm (use `npm ci` with the checked-in lockfile)

## Getting started

```bash
npm ci
npm run dev            # http://localhost:3000
```

`/` is the full catalog (the former Explore page; `/explore` redirects to `/` and there is no `/home` page). Sign in as a learner, choose **Start teaching**, then complete the profile and review steps at `/creator/signup`. This upgrades the same account to a creator without replacing its identity or learner activity. **Go to Studio** appears in the public/learner surfaces only for creators. The studio is role-gated. Deleting the creator account under `/creator/settings` clears its namespace and returns the same account to learner mode.

### Public course-discovery chatbot

The bottom-right **Zybble guide** is available only on the catalog (`/`, including
visits via the `/explore` redirect) and the eight public `/categories/[slug]` pages.
It is absent from course detail, help, authentication, checkout, learner, creator
and admin pages. Visibility follows the page, not the signed-in account’s role.

The violet chat panel offers three short suggested questions, free-text messages,
linked course recommendations and common enrollment/account/billing help. It
searches the static catalog plus courses published in the current session. Topic,
level, budget and duration preferences carry across follow-ups; **Start a new
chat** clears them. Category pages initially scope recommendations to that
category. Closing and reopening preserves the conversation; route navigation or
refresh clears it. Messages are capped at 500 characters and 60 conversation
entries and are not persisted or sent to an external service.

This is an **offline, rule-based catalog assistant**, not an LLM integration or
human support channel. Chat guidance is currently in English; recommendation
titles follow the selected catalog language. Unmatched requests offer the Help
Center rather than invented courses. It cannot access accounts or process
payments. A non-modal accessible dialog supports Escape, input focus and focus
return, and fits narrow/mobile viewports.

### Certificates

Finishing every lesson in a course issues a certificate. The parchment artwork in
`public/certificate-template.jpg` is the template; `src/lib/certificate.ts` paints the learner name,
course title, instructor name, issue date and verification code onto a 1920×1080 (16:9) canvas at
runtime. The same painter drives both the on-screen preview and the **Download PNG** button, so what
you see is exactly what you download. Certificates are stored for the document session and listed at
`/certificates` (inside the learner shell), where any of them can be re-opened and re-downloaded.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server (`next dev`) |
| `npm run build` | Production build (`next build`) |
| `npm run start` | Serve the production build (`next start`) |
| `npm run typecheck` | TypeScript, no emit (`tsc --noEmit`) |
| `npm run lint` | ESLint across the repo (`eslint .`) |
| `npm test` | Typecheck + lint + offline chatbot unit tests |
| `npm run test:chatbot` | Discovery-route restrictions, course matching, follow-up filters and help answers |

Recommended pre-PR check:

```bash
npm test && npm run build
```

## Environment

No environment variables are required to run the UI. The only optional one is:

| Variable | Effect |
| --- | --- |
| `DATABASE_URL` | Enables the Postgres pool used by `/api/health`. If it is unset, the pool is never created and `/api/health` returns `500` with a “database not configured” payload. This is expected in the demo, not a bug. |

## Project structure

```
src/
  app/
    (app)/         public catalog routes (`/` is the catalog; `/explore` redirects to `/`)
    (auth)/        login / signup routes
    (learner)/     learner dashboard, my learning, orders, messages, settings
    creator/       creator studio routes
    admin/         admin console routes
    learn/[courseId]/   lesson player
    checkout/      simulated checkout, success and failure screens
    api/health/    DB connectivity probe
  components/
    ui/            design-system primitives (button, dialog, sheet, tabs, …)
    layout/        headers, footers, sidebars, search
    courses/       catalog cards, carousels, filters, detail view
    certificate/   canvas-backed certificate preview + completion dialog
    learn/         player, curriculum list
    creator/, admin/, learner/   shell-specific building blocks
    providers/     document-session state (learning, creator, admin, notifications)
  data/mock-data.ts    seeded catalog, users, orders, payouts, reports
  lib/                 utilities, hooks, formatting, domain helpers
  lib/certificate.ts   16:9 certificate painter + PNG export
  db/                  Drizzle/Postgres client used only by /api/health
public/certificate-template.jpg   generated certificate artwork (template only, no text)
```

## Responsive & accessibility notes

- Layouts are mobile-first and designed to work from **320 px** through **2560 px**, including landscape phones, short-height viewports and 200 % zoom.
- Shell pages share the `page-container` utility (`src/app/globals.css`), which widens the inline gutter from 1rem → 1.5rem → 2.5rem → 3rem so content never butts up against the fixed sidebar, and every card, carousel and heading sits on one shared left edge.
- Data-dense admin/creator tables keep their own bounded horizontal scroller (the page itself never scrolls sideways) and every table is wrapped in an `overflow-x-auto` region with a keyboard-reachable scroll area.
- Course thumbnails are uniformly 16:9 (`1280×720`) and rendered with fixed aspect containers so images never reflow the layout.
- Interactive controls use a ~44 px touch target on touch breakpoints and shrink to ~36–40 px on pointer/desktop breakpoints.
- Keyboard support: visible focus rings everywhere, `Esc`-dismissable overlays, a `⌘K` / `Ctrl+K` search shortcut, and sidebars that become off-canvas drawers with focus traps on small screens.
- `prefers-reduced-motion: reduce` disables animation and transition effects.

## Known limitations

- Authentication is a frontend-only credential-checked walkthrough, not a secure auth service. There is one preconfigured learner account; credentials are supplied outside the UI. Signups create temporary accounts for the current document session. There is no payment provider or server-backed account persistence. Refreshing or signing out clears account/activity state.
- There is no AI Tutor: the feature was removed from the product surface (sidebar promo, Explore banner, lesson player panel, course badges, filters, help/legal copy) and its mock engine (`src/lib/tutor.ts`) is gone.
- Certificates are generated in the browser and are illustrative — the verification code is not resolvable publicly.
- `/api/health` returns `500` unless `DATABASE_URL` is configured.
- Browser regression tests cover credential rejection, full-screen signup, learner-to-creator conversion, creator deletion/cancellation, learner wishlist preservation, legacy state cleanup, refresh reset, all six catalog languages and 320px responsiveness.

## Browser verification

```bash
npm test
npm run build
npm run start -- --hostname 0.0.0.0  # in a separate terminal
npm run test:e2e                    # against http://localhost:3000
```

`E2E_URL` can point the browser tests at another running instance. The browser is
packaged as a development dependency, so the suite does not download a browser
from an external CDN. Its runtime libraries are extracted to the system temp
directory, not checked into Git.

## Localization

English, Spanish, Portuguese, French, German and Japanese use typed interface
dictionaries. React-rendered text, navigation, controls, onboarding and catalog
cards respond to the language preference. Cards localize their titles, subtitles,
levels, badges, lesson counts, duration, numbers and prices. Interface copy is
resolved offline without a translation service or DOM mutation. The language
control is available on mobile, authentication and studio headers too.

Translations are curated: unknown strings and locally authored course content
retain their original text rather than being guessed. Lesson/curriculum content,
reviews and some long-form/legal copy are not yet fully translated. Spanish also
includes course descriptions and learning outcomes; expanding that content
coverage to every locale remains follow-up work.
