import type { Metadata } from "next";
import { JsonLd } from "@/components/json-ld";
import { AnalyticsShowcase } from "@/components/marketing/analytics-showcase";
import { FaqSection, type FaqItem } from "@/components/marketing/faq";
import { FeatureBento } from "@/components/marketing/feature-bento";
import { FinalCta } from "@/components/marketing/final-cta";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { PricingSection } from "@/components/marketing/pricing-cards";
import { SchedulingShowcase } from "@/components/marketing/scheduling-showcase";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Schedule LinkedIn Posts. Track Performance. Grow Smarter.",
  description:
    "Zybble is the LinkedIn post scheduler and analytics workspace for B2B founders, consultants and creators. Plan content, publish on time, measure what works. Free plan included.",
  alternates: { canonical: "/" },
};

const homeFaq: FaqItem[] = [
  {
    question: "What exactly is Zybble?",
    answer:
      "Zybble is a purpose-built workspace for LinkedIn: a composer, a scheduling calendar and an analytics view. It deliberately covers LinkedIn only, so every screen is designed around how professionals actually publish there.",
  },
  {
    question: "Is the Free plan really free?",
    answer:
      "Yes. Free is $0 per month, requires no credit card, and includes one LinkedIn account, 10 scheduled posts per month, unlimited drafts, 7-day basic analytics and the content calendar. It is a real plan, not a trial that expires.",
  },
  {
    question: "How does Zybble publish to LinkedIn?",
    answer:
      "After you connect your account through LinkedIn's official OAuth flow, Zybble publishes on your behalf through the LinkedIn API at the time you scheduled. We never ask for your LinkedIn password, and you can revoke access from LinkedIn at any time.",
  },
  {
    question: "What analytics do I get on each plan?",
    answer:
      "Both plans show per-post performance. Free covers the last 7 days of basic metrics. Pro extends your history to 12 months with advanced engagement analytics and best-time-to-post insights computed from your own publishing data.",
  },
  {
    question: "What happens when I reach the Free plan's 10-post limit?",
    answer:
      "Drafts keep working — they are unlimited on every plan. Scheduling pauses until your next monthly allowance begins, or you can upgrade to Pro for unlimited scheduled posts. We show the limit clearly before you hit it.",
  },
  {
    question: "Can I cancel Pro whenever I want?",
    answer:
      "Yes. Pro is month-to-month at $15 per seat. Cancel in two clicks from your workspace settings and you keep Pro features until the end of the paid period. No lock-in, no retention flows, no hidden fees.",
  },
];

const structuredData = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    url: siteConfig.url,
    logo: `${siteConfig.url}${siteConfig.logoPath}`,
    description: siteConfig.description,
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: siteConfig.url,
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: siteConfig.name,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: siteConfig.url,
    description: siteConfig.description,
    offers: [
      {
        "@type": "Offer",
        name: "Free plan",
        price: "0",
        priceCurrency: "USD",
        description:
          "1 LinkedIn account, 10 scheduled posts per month, unlimited drafts, 7-day analytics, content calendar.",
      },
      {
        "@type": "Offer",
        name: "Pro plan",
        price: "15",
        priceCurrency: "USD",
        description:
          "Up to 5 LinkedIn accounts per workspace, unlimited scheduled posts, 12-month analytics, best-time insights, team collaboration.",
      },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: homeFaq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  },
];

export default function HomePage() {
  return (
    <>
      <JsonLd data={structuredData} />
      <Hero />
      <FeatureBento />
      <HowItWorks />
      <SchedulingShowcase />
      <AnalyticsShowcase />
      <PricingSection />
      <FaqSection
        items={homeFaq}
        description="The essentials on plans, publishing and analytics. Pricing specifics live on the pricing page."
      />
      <FinalCta />
    </>
  );
}
