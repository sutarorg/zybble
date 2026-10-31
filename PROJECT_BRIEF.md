# Zybble — Project Brief

## Product identity

- **Name:** Zybble
- **Category:** LinkedIn Post Scheduler & Analytics
- **Audience:** B2B founders, consultants and regular LinkedIn creators
- **Model:** Freemium SaaS. Conversion goal: Free → Pro ($15/seat/month)
- **Positioning:** deliberately focused. Zybble does LinkedIn scheduling and LinkedIn analytics — nothing else. The marketing site reinforces this at every turn ("nothing else" appears in the hero).

## Brand

- **Primary colour:** professional electric blue (`#2563EB`, brand scale tuned to the supplied logo gradient).
- **Supporting:** white, soft grey (slate), subtle blue tints.
- **Style:** premium, minimal, editorial, trustworthy. Craft bar: Linear / Stripe / Notion discipline applied to a LinkedIn-native product.
- **Logo:** the supplied asset (`public/brand/logo.png`), never redrawn or substituted.

## Pricing & entitlements (source of truth)

| Plan | Price | Entitlements |
| --- | --- | --- |
| Free | $0/mo | 1 LinkedIn account · 10 scheduled posts/mo · unlimited drafts · 7-day basic analytics · content calendar |
| Pro | $15/seat/mo | up to 5 LinkedIn accounts per workspace · unlimited scheduled posts · 12-month advanced analytics · best-time-to-post insights · team collaboration |

Plan limits are marketing-accurate now and must be enforced **server-side** when the dashboard ships (Prompt 2/3).

## Fixed technology stack

| Layer | Choice |
| --- | --- |
| Frontend | Next.js App Router + TypeScript |
| Styling | Tailwind CSS v4 |
| UI | shadcn-pattern components (`src/components/ui`) |
| Backend/DB | Supabase (to be wired in Prompt 2/3; Drizzle scaffolding retained) |
| Hosting | Vercel |
| Background jobs | Inngest (Prompt 3+) |
| Social | LinkedIn API (Prompt 2+) |
| Payments | Dodo Payments (Prompt 3+) |
| Email | Resend (Prompt 3+) |

## Non-negotiables honoured in this phase

- No fabricated metrics, fake users, testimonials, reviews or customer logos anywhere on the site. Product visuals are labelled "Illustration" and use skeleton lines / relative values instead of invented data.
- No dead controls: every link and button navigates; auth forms validate client-side and disclose that the backend ships with the next release.
- No secrets in the repo; LinkedIn/payment integrations are interfaces awaiting credentials, not claims.
- Legal pages carry visible "pending owner review" markers rather than fabricated assurances.

## Phase status

Prompt 1 (marketing website, frontend-only) — implemented. Dashboard, auth, LinkedIn OAuth, scheduling engine, billing and email are pending (see `LANDING_HANDOFF.md`).
