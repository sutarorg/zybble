import type { Metadata } from "next";
import { JsonLd } from "@/components/json-ld";
import { Container } from "@/components/layout/container";
import { ComparisonTable } from "@/components/marketing/comparison-table";
import { FaqSection, type FaqItem } from "@/components/marketing/faq";
import { FinalCta } from "@/components/marketing/final-cta";
import { PlanCards } from "@/components/marketing/pricing-cards";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Reveal } from "@/components/motion/reveal";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Pricing — Free forever, Pro at $15 per seat",
  description:
    "Zybble pricing: a genuinely free plan with 10 scheduled posts a month, and Pro at $15 per seat per month with unlimited scheduling, 12-month analytics and team collaboration.",
  alternates: { canonical: "/pricing" },
};

const billingFaq: FaqItem[] = [
  {
    question: "What does “per seat” mean?",
    answer:
      "Each person with Pro access in a workspace counts as one seat at $15 per month. A solo creator pays $15; a team of three pays $45. Seats can be reassigned when people change roles.",
  },
  {
    question: "Is there a free trial of Pro?",
    answer:
      "We don't do expiring trials. The Free plan is the honest way to evaluate Zybble: real scheduling, real analytics and your real LinkedIn account, for as long as you like. Upgrade when, and only if, you outgrow it.",
  },
  {
    question: "Can I downgrade or cancel anytime?",
    answer:
      "Yes. Cancel Pro in your workspace settings in two clicks. You keep Pro features until the end of the current billing period, then move to Free. Anything already scheduled continues to publish.",
  },
  {
    question: "What happens to my analytics history if I downgrade?",
    answer:
      "Your data is never deleted. On Free you see the most recent 7 days; if you return to Pro, your full 12-month window is restored exactly as you left it.",
  },
  {
    question: "Which currency are prices in?",
    answer:
      "All prices are in US dollars. There are no setup fees, no per-post charges and no minimum commitment.",
  },
];

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Zybble Pricing",
  url: `${siteConfig.url}/pricing`,
  description:
    "Free plan at $0 per month and Pro at $15 per seat per month for LinkedIn scheduling and analytics.",
};

export default function PricingPage() {
  return (
    <>
      <JsonLd data={structuredData} />

      <section className="relative overflow-hidden">
        <div aria-hidden className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-brand-50/70 via-white to-white" />
          <div className="bg-grid-blue absolute inset-x-0 top-0 h-[360px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]" />
        </div>
        <Container className="py-20 lg:py-24">
          <Reveal>
            <SectionHeading
              as="h1"
              eyebrow="Pricing"
              title="Two plans. Zero fine print."
              description="Start free with everything you need to build the habit. Move to Pro when you need unlimited scheduling, deeper history and your team alongside you."
            />
          </Reveal>
          <div className="mx-auto mt-16 max-w-4xl">
            <PlanCards />
          </div>
          <Reveal delay={120}>
            <p className="mx-auto mt-8 max-w-xl text-center text-sm leading-6 text-slate-500">
              Prices in USD. Pro is per seat, billed monthly, cancel anytime —
              you keep access until the end of the paid period. No credit card
              required for the Free plan.
            </p>
          </Reveal>
        </Container>
      </section>

      <section aria-labelledby="compare-heading" className="border-t border-slate-200 bg-slate-50/70 py-24">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="Compare plans"
              title={<span id="compare-heading">The full picture, side by side</span>}
              description="Every entitlement, exactly as it appears in the product. Limits are enforced in the application itself — what you see is what you get."
            />
          </Reveal>
          <Reveal delay={120}>
            <div className="mx-auto mt-14 max-w-4xl">
              <ComparisonTable />
            </div>
          </Reveal>
        </Container>
      </section>

      <FaqSection
        eyebrow="Billing FAQ"
        title="Fair questions about money"
        items={billingFaq}
      />
      <FinalCta />
    </>
  );
}
