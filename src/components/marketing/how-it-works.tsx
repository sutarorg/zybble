import { ArrowRight, LineChart, PenSquare } from "lucide-react";
import Link from "next/link";
import { LinkedinIcon } from "@/components/icons";
import { Container } from "@/components/layout/container";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Reveal } from "@/components/motion/reveal";
import { siteConfig } from "@/lib/site";

const steps = [
  {
    icon: LinkedinIcon,
    step: "01",
    title: "Connect LinkedIn",
    copy: "Authorise your profile or page through LinkedIn's official OAuth flow. Zybble never asks for your password.",
  },
  {
    icon: PenSquare,
    step: "02",
    title: "Plan and schedule",
    copy: "Draft in the composer, drop posts onto the calendar and pick the time each one goes out.",
  },
  {
    icon: LineChart,
    step: "03",
    title: "Measure and improve",
    copy: "See which posts earned attention, spot your best times and let the next draft start smarter.",
  },
] as const;

export function HowItWorks() {
  return (
    <section aria-labelledby="how-heading" className="border-y border-slate-200 bg-slate-50/70 py-24 lg:py-32">
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow="How Zybble works"
            headingId="how-heading"
            title="From idea to insight in three steps"
            description="A setup you finish in minutes, then a weekly rhythm that keeps your LinkedIn presence consistent."
          />
        </Reveal>

        <ol className="relative mt-16 grid gap-10 lg:grid-cols-3 lg:gap-8">
          {/* Connector line (desktop) */}
          <div
            aria-hidden
            className="absolute left-0 right-0 top-7 hidden border-t border-dashed border-slate-300 lg:block"
          />
          {/* `as="li"` makes Reveal itself the list item. Wrapping another
              <li> inside it produced <li> inside <li>, which is invalid and
              left the inner items outside any list for assistive tech. */}
          {steps.map((step, i) => (
            <Reveal as="li" key={step.step} delay={i * 120} className="relative">
              <div className="flex items-center gap-4">
                <span className="relative z-10 flex size-14 items-center justify-center rounded-2xl bg-white text-brand-600 shadow-soft ring-1 ring-slate-200">
                  <step.icon className="size-6" aria-hidden />
                </span>
                <span className="text-sm font-semibold tabular-nums text-slate-500">
                  {step.step}
                </span>
              </div>
              <h3 className="mt-5 text-lg font-semibold tracking-tight text-slate-900">
                {step.title}
              </h3>
              <p className="mt-2 max-w-sm text-[15px] leading-7 text-slate-600">{step.copy}</p>
            </Reveal>
          ))}
        </ol>

        <Reveal delay={200}>
          <p className="mt-14 text-center">
            <Link
              href={siteConfig.links.signup}
              className="inline-flex items-center gap-1.5 text-[15px] font-medium text-brand-700 transition-colors hover:text-brand-800"
            >
              Set up your workspace
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </p>
        </Reveal>
      </Container>
    </section>
  );
}
