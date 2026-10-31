import type { Metadata } from "next";
import { Check } from "lucide-react";
import { JsonLd } from "@/components/json-ld";
import { Container } from "@/components/layout/container";
import { AnalyticsShowcase } from "@/components/marketing/analytics-showcase";
import { FaqSection, type FaqItem } from "@/components/marketing/faq";
import { FinalCta } from "@/components/marketing/final-cta";
import { PageHero } from "@/components/marketing/page-hero";
import { SectionHeading } from "@/components/marketing/section-heading";
import { AnalyticsVisual } from "@/components/marketing/visuals/analytics-visual";
import { Reveal } from "@/components/motion/reveal";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "LinkedIn Analytics — know what actually worked",
  description:
    "Zybble LinkedIn analytics: per-post impressions, reactions, comments, reposts and engagement rate, with 7-day history on Free and 12-month advanced analytics plus best-time insights on Pro.",
  alternates: { canonical: "/linkedin-analytics" },
};

const tracked = [
  { group: "Per post", items: ["Impressions", "Reactions", "Comments", "Reposts", "Engagement rate"] },
  { group: "Over time", items: ["Follower movement", "Posting cadence vs. engagement", "Format performance (text, carousel, link)"] },
  { group: "On Pro", items: ["12-month history", "Best-time-to-post insights", "Cross-account comparison"] },
] as const;

const analyticsFaq: FaqItem[] = [
  {
    question: "Where does the data come from?",
    answer:
      "Directly from the LinkedIn API for posts published through Zybble and your connected account. Numbers in Zybble are the numbers LinkedIn reports — we don't estimate, inflate or synthetic-fill gaps.",
  },
  {
    question: "How far back can I look?",
    answer:
      "Free keeps a rolling 7-day window of basic metrics. Pro extends visible history to 12 months with advanced analytics, so seasonality and long-term trends become visible.",
  },
  {
    question: "What are best-time-to-post insights?",
    answer:
      "A Pro feature that analyses when your own posts have historically earned the strongest engagement and surfaces those windows in the scheduler. It is your data about your audience — never generic industry averages dressed up as advice.",
  },
  {
    question: "Can I export my analytics?",
    answer:
      "Yes. Your metrics belong to you: export the numbers behind any chart to take into a deck, a spreadsheet or a client report.",
  },
];

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Zybble LinkedIn Analytics",
  url: `${siteConfig.url}/linkedin-analytics`,
  description:
    "Per-post LinkedIn analytics with 7-day history on Free and 12-month advanced analytics on Pro.",
};

export default function LinkedInAnalyticsPage() {
  return (
    <>
      <JsonLd data={structuredData} />

      <PageHero
        eyebrow="LinkedIn Analytics"
        title={
          <>
            Your posts are talking back.{" "}
            <span className="text-brand-600">Start listening.</span>
          </>
        }
        description="Every post you publish through Zybble returns its report card: what reached people, what moved them, and when. Read it in seconds, use it in your next draft."
        visual={<AnalyticsVisual />}
        reversed
        secondaryCta={{ label: "See pricing", href: siteConfig.links.pricing }}
        footnote="Free: 7-day basic analytics. Pro: 12-month advanced analytics."
      />

      <section aria-labelledby="tracked-heading" className="py-24 lg:py-28">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="What's measured"
              title={<span id="tracked-heading">Everything worth tracking, nothing worth padding</span>}
              description="A deliberate set of metrics chosen to answer one question: what should your next post do differently?"
            />
          </Reveal>
          <div className="mt-14 grid gap-6 lg:grid-cols-3">
            {tracked.map((col, i) => (
              <Reveal key={col.group} delay={i * 100}>
                <div className="h-full rounded-2xl bg-white p-7 ring-1 ring-slate-200 shadow-xs">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                    {col.group}
                  </h3>
                  <ul className="mt-5 space-y-3.5">
                    {col.items.map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 ring-1 ring-brand-100">
                          <Check className="size-3" aria-hidden />
                        </span>
                        <span className="text-[15px] leading-6 text-slate-700">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      <AnalyticsShowcase />
      <FaqSection
        eyebrow="Analytics FAQ"
        title="Straight answers about the numbers"
        items={analyticsFaq}
      />
      <FinalCta />
    </>
  );
}
