# Zybble

A demo AI-course marketplace built with Next.js. Zybble showcases four complete shells in one app:

| Shell | Base path | What it demonstrates |
| --- | --- | --- |
| Public | `/explore`, `/courses/[slug]`, `/instructors/[username]`, `/help`, `/about`, … | Catalog browsing, search, filters, course detail, instructor profiles |
| Learner | `/dashboard`, `/my-learning`, `/orders`, `/wishlist`, `/messages`, `/settings`, `/learn/[courseId]` | Enrolled courses, progress, simulated lesson player with notes, resources and an AI Tutor panel |
| Creator | `/creator/*` | Course creation wizard, curriculum editor, pricing, publish flow, analytics, earnings, payouts |
| Admin | `/admin/*` | Moderation queue, users, orders, payouts, categories, reports, settings |

Everything is client-side and mock-data driven: there is no storefront API, no auth server and no payment provider. User activity (enrollments, notes, progress, creator drafts, admin settings) is persisted in `localStorage` so a refresh keeps your place.

## Requirements

- Node.js 20+
- npm (the repository ships without a lockfile — `npm install` is the supported install path)

## Getting started

```bash
npm install
npm run dev            # http://localhost:3000
```

`/` redirects to `/explore`, which is the natural entry point. To move between shells, use the account switcher in the header (the demo has fixed learner/creator/admin personas).

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server (`next dev`) |
| `npm run build` | Production build (`next build`) |
| `npm run start` | Serve the production build (`next start`) |
| `npm run typecheck` | TypeScript, no emit (`tsc --noEmit`) |
| `npm run lint` | ESLint across the repo (`eslint .`) |
| `npm test` | Typecheck + lint — the full verification available without a browser |

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
    (app)/         public marketing + catalog routes
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
    learn/         player, curriculum list, AI Tutor panel
    creator/, admin/, learner/   shell-specific building blocks
    providers/     localStorage-backed state (learning, creator, admin, notifications)
  data/mock-data.ts    seeded catalog, users, orders, payouts, reports
  lib/                 utilities, hooks, formatting, domain helpers
  db/                  Drizzle/Postgres client used only by /api/health
```

## Responsive & accessibility notes

- Layouts are mobile-first and designed to work from **320 px** through **2560 px**, including landscape phones, short-height viewports and 200 % zoom.
- Data-dense admin/creator tables keep their own bounded horizontal scroller (the page itself never scrolls sideways) and every table is wrapped in an `overflow-x-auto` region with a keyboard-reachable scroll area.
- Course thumbnails are uniformly 16:9 (`1280×720`) and rendered with fixed aspect containers so images never reflow the layout.
- Interactive controls use a ~44 px touch target on touch breakpoints and shrink to ~36–40 px on pointer/desktop breakpoints.
- Keyboard support: visible focus rings everywhere, `Esc`-dismissable overlays, a `⌘K` / `Ctrl+K` search shortcut, and sidebars that become off-canvas drawers with focus traps on small screens.
- `prefers-reduced-motion: reduce` disables animation and transition effects.

## Known limitations

- There is no authentication, no payment provider and no persistence beyond the browser. Demo personas are switchable from the header.
- `/api/health` returns `500` unless `DATABASE_URL` is configured.
- Verification in this environment is limited to `npm run typecheck`, `npm run lint` and `npm run build`; no automated browser test suite is included.
