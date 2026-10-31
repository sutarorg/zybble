import type { Metadata } from "next";
import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { Container } from "@/components/layout/container";
import { FinalCta } from "@/components/marketing/final-cta";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { PageHero } from "@/components/marketing/page-hero";
import { SchedulingShowcase } from "@/components/marketing/scheduling-showcase";
import { SectionHeading } from "@/components/marketing/section-heading";
import { CalendarVisual } from "@/components/marketing/visuals/calendar-visual";
import { Reveal } from "@/components/motion/reveal";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "LinkedIn Scheduler — plan a week of posts in one sitting",
  description:
    "Zybble's LinkedIn scheduler: a clean composer, unlimited drafts, a visual content calendar and automatic publishing through the official LinkedIn API. Free plan includes 10 scheduled posts a month.",
  alternates: { canonical: "/linkedin-scheduler" },
};

const capabilities = [
  {
    title: "Composer built for LinkedIn",
    copy: "A distraction-free editor with a live character count and preview, tuned for how posts actually render on LinkedIn — hooks above the fold included.",
  },
  {
    title: "Queue, calendar or exact slot",
    copy: "Add to the next open slot, drag onto the calendar, or pick a precise date and time. Your cadence, your rules.",
  },
  {
    title: "Drafts that never expire",
    copy: "Half-formed ideas stay safe in unlimited drafts. They never count against your monthly schedule — on any plan.",
  },
  {
    title: "Publishing you don't babysit",
    copy: "Once scheduled, Zybble publishes through the official LinkedIn API at the chosen moment. No reminders, no manual posting.",
  },
  {
    title: "Multiple voices, one workspace",
    copy: "On Pro, manage up to five LinkedIn accounts — founder profile, company page and client voices — from a single calendar.",
  },
  {
    title: "Honest limits, shown up front",
    copy: "Free includes 10 scheduled posts a month. The counter is always visible, so the limit never surprises you mid-week.",
  },
] as const;

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Zybble LinkedIn Scheduler",
  url: `${siteConfig.url}/linkedin-scheduler`,
  description:
    "Plan, schedule and automatically publish LinkedIn posts from a visual calendar.",
};

export default function LinkedInSchedulerPage() {
  return (
    <>
      <JsonLd data={structuredData} />

      <PageHero
        eyebrow="LinkedIn Scheduler"
        title={
          <>
            Write when you have ideas.{" "}
            <span className="text-brand-600">Publish when you have readers.</span>
          </>
        }
        description="Batch your LinkedIn writing into one calm sitting, place every post on the calendar, and let Zybble do the publishing — on time, every time."
        visual={<CalendarVisual />}
        secondaryCta={{ label: "See pricing", href: siteConfig.links.pricing }}
        footnote="Free plan: 10 scheduled posts a month. Pro: unlimited."
      />

      <section aria-labelledby="capabilities-heading" className="py-24 lg:py-28">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="Capabilities"
              title={<span id="capabilities-heading">Scheduling, done properly</span>}
              description="Not a bolt-on to a social suite — a scheduler designed from a blank page for LinkedIn specifically."
            />
          </Reveal>
          <div className="mt-14 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {capabilities.map((cap, i) => (
              <Reveal key={cap.title} delay={(i % 3) * 80}>
                <div className="flex gap-3.5">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 ring-1 ring-brand-100">
                    <Check className="size-3.5" aria-hidden />
                  </span>
                  <div>
                    <h3 className="text-[15px] font-semibold text-slate-900">{cap.title}</h3>
                    <p className="mt-1.5 text-[15px] leading-7 text-slate-600">{cap.copy}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={160}>
            <p className="mt-14 text-center">
              <Link
                href={siteConfig.links.signup}
                className="inline-flex items-center gap-1.5 text-[15px] font-medium text-brand-700 transition-colors hover:text-brand-800"
              >
                Try the scheduler free
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </p>
          </Reveal>
        </Container>
      </section>

      <SchedulingShowcase />
      <HowItWorks />
      <FinalCta />
    </>
  );
}
