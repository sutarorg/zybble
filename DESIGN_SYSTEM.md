# Zybble Design System

Design tokens live as CSS custom properties in `src/app/globals.css` (Tailwind v4 `@theme`). Component primitives live in `src/components/ui/*` following the shadcn pattern (cva variants + Radix slots).

## Colour

| Token | Value | Usage |
| --- | --- | --- |
| `brand-50` | `#EEF4FF` | tinted section washes, icon chips |
| `brand-100` | `#DFEAFF` | rings/borders on tints |
| `brand-500` | `#3E7CF4` | saturated accent (logo mid-tone) |
| `brand-600` | `#2563EB` | **primary action / links** |
| `brand-700` | `#1D4ED8` | primary hover, dark CTA panels |
| `brand-800/900/950` | … | deep text on brand tints, CTA gradient |
| `slate-50…950` | Tailwind slate | neutrals: text, borders, surfaces |

Rules: one saturated blue per viewport where possible; CTAs are always `brand-600`; tints never sit under body text smaller than 14px.

## Typography

- **Font:** Inter (`next/font`, `--font-inter`), system fallback stack.
- **Scale:** display `text-4xl → [56px]` (home hero), page H1 `text-4xl/5xl`, section H2 `text-3xl/4xl`, card titles `text-lg`, body `text-[15px] leading-7`, leads `text-lg leading-8`, meta `text-[13px]`.
- **Rules:** headings `font-semibold tracking-tight` + `text-balance`; numbers in UI `tabular-nums`; one `<h1>` per page.

## Spacing & layout

- Container: `max-w-7xl px-6 lg:px-8` (`Container` component).
- Section rhythm: `py-24 lg:py-32`; showcase pairs alternate split directions.
- Grid: 12-col at `lg`; bento uses `lg:grid-cols-3` with selective col-spans.

## Shape & elevation

- Radius: `rounded-lg` (controls) · `rounded-xl` (cards) · `rounded-2xl` (panels/windows) · `rounded-3xl` (CTA panel).
- Shadows (defined once in `@theme`): `shadow-xs` (resting controls), `shadow-soft` (raised cards), `shadow-panel` (product windows).
- Borders: prefer `ring-1 ring-slate-200` over `border` on cards.

## Motion

- Scroll reveal: shared `IntersectionObserver` in `<Reveal />` — `opacity/translateY(14px)`, 700ms `ease-out-expo`, optional stagger `delay`.
- Hover: 200–300ms color/shadow/scale (`group-hover:scale-[1.02]` on images).
- `prefers-reduced-motion`: all animations and reveals neutralised in CSS; content never depends on JS to appear (`@media (scripting: none)` fallback included).

## Components (`src/components/ui`)

`Button` (primary/secondary/ghost/inverse/outline-inverse; sm/default/lg), `Badge`, `Accordion` (Radix), `Input`. Icons: Lucide only; LinkedIn brand glyph inlined in `src/components/icons.tsx` (removed from lucide).

## Imagery

- Blog covers: AI-generated 16:9 editorial illustrations, electric-blue/white palette, abstract geometry, **no text inside images** (`public/blog/*.png`).
- Product visuals are hand-built UI illustrations (skeleton lines, relative bars, typed slot states) labelled "Illustration" — never fabricated metrics.
- OG image: `public/og/og-image.png` (1200×630, text-free brand art).

## Accessibility

Landmarks (`header/nav/main/footer`), skip-safe focus-visible outlines, `aria-current` on nav scripts, labelled icon-only buttons, alt text on all imagery (decorative = `alt=""`), contrast ≥ 4.5:1 for body text, reduced-motion support throughout.
