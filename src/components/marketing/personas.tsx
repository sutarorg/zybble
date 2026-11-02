import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Reveal } from "@/components/motion/reveal";

/**
 * Social-proof section.
 *
 * IMPORTANT — honesty design: until Zybble has genuine customer testimonials
 * (with permission), this section presents *illustrative personas* — fictional
 * characters that represent real use cases. The labelling is deliberate and
 * load-bearing:
 *
 *  - the section is titled "Built for professionals like you", not "testimonials";
 *  - each card carries an "Illustrative persona" badge;
 *  - the footnote states plainly that these are illustrations, not customers;
 *  - there are NO fake quotes, fake names presented as customers, fake stats
 *    or fake results anywhere.
 *
 * When verified testimonials exist, replace the persona objects below with
 * quote + name + role + permission flag; the card grid already accepts them.
 */

export interface Persona {
  /** Illustrative character name — clearly fictional, presented as a persona. */
  name: string;
  role: string;
  location: string;
  image: string;
  /** A practical use case, written as description — never as a quote or result claim. */
  useCase: string;
  alt: string;
}

export const personas: Persona[] = [
  {
    name: "Amara O.",
    role: "B2B founder",
    location: "Manchester, UK",
    image: "/personas/b2b-founder.jpg",
    useCase:
      "Runs a compliance consultancy and a company. Batches three posts every Monday morning — client lessons, not sales pitches — and lets the queue publish through the week.",
    alt: "Editorial illustration of a Black woman in her forties with short natural hair and a navy blazer, a B2B founder persona",
  },
  {
    name: "Daniel K.",
    role: "Independent consultant",
    location: "Singapore",
    image: "/personas/consultant.jpg",
    useCase:
      "Advises manufacturing firms on operations. Uses the calendar to keep a steady two-posts-a-week rhythm during delivery-heavy months, and reviews engagement rate before pitching retainers.",
    alt: "Editorial illustration of an East Asian man in his fifties with glasses and a charcoal sweater, an independent consultant persona",
  },
  {
    name: "Mateo R.",
    role: "SaaS founder",
    location: "Mexico City, Mexico",
    image: "/personas/saas-founder.jpg",
    useCase:
      "Building an early-stage product in public. Drafts build updates the week they happen, schedules them for his audience's morning, and checks follower movement after each post.",
    alt: "Editorial illustration of a Latino man in his early thirties with dark wavy hair and a light jacket, a SaaS founder persona",
  },
  {
    name: "Ingrid S.",
    role: "Marketing strategist",
    location: "Copenhagen, Denmark",
    image: "/personas/marketing-strategist.jpg",
    useCase:
      "Plans LinkedIn presence for leadership teams. Runs one workspace per client, drafts from a pillar plan, and uses per-post analytics to steer each quarter's content mix.",
    alt: "Editorial illustration of a white woman in her late twenties with a blonde bob and cobalt turtleneck, a marketing strategist persona",
  },
  {
    name: "Elijah B.",
    role: "Business coach",
    location: "Atlanta, USA",
    image: "/personas/business-coach.jpg",
    useCase:
      "Coaches first-time executives. Posts two lessons and one story a week, uses best-time suggestions to land morning slots, and exports nothing — reads the numbers in the workspace.",
    alt: "Editorial illustration of a Black man in his sixties with a silver beard and glasses, a business coach persona",
  },
  {
    name: "Layla H.",
    role: "Agency owner",
    location: "Dubai, UAE",
    image: "/personas/agency-owner.jpg",
    useCase:
      "Runs a three-person content agency. Keeps five founder profiles in one Pro workspace, so ghostwritten drafts never publish from the wrong account — and clients see their own calendar.",
    alt: "Editorial illustration of a Middle Eastern woman in her late thirties with dark wavy hair and a light-blue blazer, an agency owner persona",
  },
  {
    name: "Tom W.",
    role: "LinkedIn content creator",
    location: "Toronto, Canada",
    image: "/personas/content-creator.jpg",
    useCase:
      "Publishes daily-ish without living on LinkedIn. Writes hooks in one sitting, schedules the week, then studies which formats earned comments from the buyers he writes for.",
    alt: "Editorial illustration of a white man in his late twenties with a ginger quiff and denim shirt, a content creator persona",
  },
];

export function PersonaWall() {
  return (
    <section aria-labelledby="personas-heading" className="border-t border-slate-200 bg-slate-50/70 py-24 lg:py-28">
      <Container>
        <Reveal>
          <SectionHeading
            as="h2"
            eyebrow="Who Zybble is for"
            title={<span id="personas-heading">Built for professionals like you</span>}
            description="Seven working styles Zybble is designed around. These are illustrative personas — not customer testimonials, and nothing on this page is a claimed result."
          />
        </Reveal>

        {/* grid-cols-1 is load-bearing. Tailwind's grid-cols-* compiles to
            repeat(N, minmax(0, 1fr)), which has no content-based minimum. With
            only sm:/lg: variants, the base breakpoint falls through to a single
            implicit *auto* track, which is floored at the cards' min-content
            contribution (424px) and overflows a 390px viewport by ~82px. */}
        <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {personas.map((persona, i) => (
            <Reveal key={persona.name} delay={(i % 3) * 80}>
              <article className="flex h-full flex-col rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-xs">
                <div className="flex items-center gap-4">
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-full ring-1 ring-slate-200">
                    <Image
                      src={persona.image}
                      alt={persona.alt}
                      width={96}
                      height={96}
                      sizes="96px"
                      className="size-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-slate-900">{persona.name}</p>
                    <p className="truncate text-sm text-slate-500">
                      {persona.role} · {persona.location}
                    </p>
                  </div>
                </div>
                <p className="mt-4 flex-1 text-[15px] leading-7 text-slate-600">{persona.useCase}</p>
                <p className="mt-4">
                  {/* slate-600, not slate-500: slate-500 on slate-100 measures
                      4.34:1, under the 4.5:1 WCAG AA floor. slate-600 on the
                      same background is 6.9:1. */}
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200">
                    Illustrative persona
                  </span>
                </p>
              </article>
            </Reveal>
          ))}

          {/* Eighth tile: the honest conversion path, completing the grid. */}
          <Reveal delay={160}>
            <article className="flex h-full flex-col justify-between rounded-2xl bg-brand-600 p-6 text-white shadow-soft">
              <div>
                <p className="text-[15px] font-semibold">You, in seven posts a fortnight</p>
                <p className="mt-3 text-[15px] leading-7 text-brand-50">
                  Batch the writing, keep the calendar honest, publish on time and read the numbers.
                  The free plan covers one account and ten scheduled posts a month.
                </p>
              </div>
              <Link
                href="/signup"
                className="mt-6 inline-flex w-fit items-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50"
              >
                Start for free
              </Link>
            </article>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
