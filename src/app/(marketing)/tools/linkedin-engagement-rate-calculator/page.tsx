import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { Container } from "@/components/layout/container";
import { PageHero } from "@/components/marketing/page-hero";
import { FaqSection, type FaqItem } from "@/components/marketing/faq";
import { FinalCta } from "@/components/marketing/final-cta";
import { Reveal } from "@/components/motion/reveal";
import { EngagementCalculator } from "@/components/tools/engagement-calculator";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: "LinkedIn Engagement Rate Calculator" },
  description:
    "Calculate your LinkedIn engagement rate for free using impressions, reactions, comments and reposts. Understand your post performance with Zybble.",
  keywords: [
    "LinkedIn engagement rate calculator",
    "calculate LinkedIn engagement rate",
    "LinkedIn engagement calculator",
    "LinkedIn post engagement",
    "LinkedIn engagement formula",
    "LinkedIn impressions engagement",
    "social media engagement calculator",
    "LinkedIn performance measurement",
  ],
  alternates: { canonical: "/tools/linkedin-engagement-rate-calculator" },
  openGraph: {
    type: "website",
    url: `${siteConfig.url}/tools/linkedin-engagement-rate-calculator`,
    title: "LinkedIn Engagement Rate Calculator",
    description:
      "Turn impressions, reactions, comments and reposts into an engagement rate — with the formula and the denominator choice shown, not hidden.",
  },
};

const faqs: FaqItem[] = [
  {
    question: "What is the formula for LinkedIn engagement rate?",
    answer:
      "The standard formula is (reactions + comments + reposts) ÷ impressions × 100. Example: 85 reactions + 14 comments + 6 reposts = 105 engagements; 105 ÷ 4,200 impressions = 2.5%. Some analysts divide by unique reach or follower count instead — the calculator lets you choose, because the denominator changes what the number means.",
  },
  {
    question: "What is a good engagement rate on LinkedIn?",
    answer:
      "There is no trustworthy universal number — published benchmarks mix personal profiles with company pages and define the formula differently, which makes them incomparable. The honest benchmark is your own trailing median: the median rate of your last ten posts. A post 'performs' when it beats your typical post, and your presence improves when that median itself rises.",
  },
  {
    question: "Should I divide by impressions or reach?",
    answer:
      "Impressions if you are comparing your posts against each other (it is what LinkedIn surfaces natively and what most tools use, so it is the comparable choice). Unique reach if you want response per person. Followers if you want a rough sense of audience-level resonance — though followers only see a fraction of your posts, so treat it as the coarsest of the three.",
  },
  {
    question: "Do saves count as engagement?",
    answer:
      "Saves are a real signal, but LinkedIn's public engagement figures (and its API) expose reactions, comments and reposts as the core engagement events, so this calculator uses those three. If you track saves manually, add them to the reactions input as a workaround and note it — just be consistent, because a formula only means something when it is applied the same way every time.",
  },
  {
    question: "Is this calculator free?",
    answer:
      "Yes — no account, no email gate, and the numbers you enter never leave your browser. When you want the calculation done automatically for every post you publish, that is what Zybble's analytics workspace does.",
  },
];

const pageUrl = `${siteConfig.url}/tools/linkedin-engagement-rate-calculator`;

const structuredData = [
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "LinkedIn Engagement Rate Calculator",
    url: pageUrl,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description:
      "Free calculator for LinkedIn engagement rate with a choice of denominator and a full calculation breakdown. No signup required.",
    offers: [{ "@type": "Offer", price: "0", priceCurrency: "USD" }],
    publisher: { "@type": "Organization", name: siteConfig.name, url: siteConfig.url },
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
      { "@type": "ListItem", position: 2, name: "Free LinkedIn tools", item: `${siteConfig.url}/free-linkedin-tools` },
      { "@type": "ListItem", position: 3, name: "Engagement Rate Calculator", item: pageUrl },
    ],
  },
];

export default function EngagementCalculatorPage() {
  return (
    <>
      <JsonLd data={structuredData} />

      <PageHero
        eyebrow="Free tool · no signup"
        title={
          <>
            LinkedIn engagement rate,{" "}
            <span className="text-brand-600">calculated properly</span>
          </>
        }
        description="Enter your post's numbers, choose the denominator that matches your question, and get the rate with the full arithmetic shown. Nothing is uploaded; there is nothing to register for."
        secondaryCta={{ label: "How to read the result", href: "/blog/linkedin-engagement-rate-calculate-improve" }}
        footnote="Works with any post — profile or company page."
      />

      <section aria-label="Calculator" className="bg-slate-50/70 py-16 lg:py-20">
        <Container>
          <Reveal>
            <EngagementCalculator />
          </Reveal>
        </Container>
      </section>

      <section aria-labelledby="calc-explainer" className="py-16 lg:py-20">
        <Container className="max-w-3xl">
          <Reveal>
            <h2 id="calc-explainer" className="text-2xl font-semibold tracking-tight text-slate-950">
              How the calculation works
            </h2>
          </Reveal>
          <div className="mt-6 space-y-6 text-[15px] leading-8 text-slate-700">
            <Reveal delay={60}>
              <p>
                Engagement rate answers one question: of the people your post reached, how many did
                anything at all? It is the response — reactions, comments and reposts — divided by
                the size of the audience, expressed as a percentage. Every variant of the formula is
                that same ratio with a different denominator:
              </p>
            </Reveal>
            <Reveal delay={80}>
              <ul className="space-y-3">
                <li className="rounded-xl bg-slate-50 px-5 py-4 ring-1 ring-slate-100">
                  <strong className="font-semibold text-slate-900">÷ impressions</strong> — the
                  standard, comparable choice. Impressions are what LinkedIn surfaces for member
                  posts, so this is the denominator most tools and benchmarks (quietly) assume.
                </li>
                <li className="rounded-xl bg-slate-50 px-5 py-4 ring-1 ring-slate-100">
                  <strong className="font-semibold text-slate-900">÷ unique reach</strong> — response
                  per person rather than per rendering. Fairer when a post earned lots of repeat
                  impressions, harder to source: LinkedIn does not expose unique reach for member
                  posts directly, which is why most calculators skip it.
                </li>
                <li className="rounded-xl bg-slate-50 px-5 py-4 ring-1 ring-slate-100">
                  <strong className="font-semibold text-slate-900">÷ followers</strong> — audience-level
                  resonance. The coarsest option (only a fraction of followers see any post), useful
                  mainly for tracking whether a growing audience is also a responding one.
                </li>
              </ul>
            </Reveal>
            <Reveal delay={100}>
              <p>
                Whichever you choose, keep it consistent — a rate only means something when it is
                computed the same way every time. The deeper question of which numbers to manage and
                why is covered in{" "}
                <Link
                  href="/blog/linkedin-engagement-rate-calculate-improve"
                  className="font-medium text-brand-700 underline decoration-brand-200 underline-offset-4 hover:text-brand-800"
                >
                  how to calculate and improve your LinkedIn engagement rate
                </Link>
                , and the definitional differences between the inputs are unpicked in{" "}
                <Link
                  href="/blog/linkedin-impressions-vs-reach-vs-engagement"
                  className="font-medium text-brand-700 underline decoration-brand-200 underline-offset-4 hover:text-brand-800"
                >
                  impressions vs reach vs engagement
                </Link>
                .
              </p>
            </Reveal>
            <Reveal delay={120}>
              <p className="rounded-xl bg-brand-50 px-5 py-4 text-brand-900 ring-1 ring-brand-100">
                <strong className="font-semibold">A deliberate omission:</strong> this page will not
                tell you your rate is &ldquo;good&rdquo; against an industry benchmark. Those benchmarks are
                folklore — mixed populations, mixed formulas, no provenance. Compare against your own
                trailing median; it is the only number that can actually inform a decision.
              </p>
            </Reveal>
          </div>
        </Container>
      </section>

      <FaqSection items={faqs} description="The formula, the denominators and how to read the result." />
      <FinalCta />
    </>
  );
}
