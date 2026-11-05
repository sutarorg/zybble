import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { Container } from "@/components/layout/container";
import { PageHero } from "@/components/marketing/page-hero";
import { FaqSection, type FaqItem } from "@/components/marketing/faq";
import { FinalCta } from "@/components/marketing/final-cta";
import { Reveal } from "@/components/motion/reveal";
import { KeywordAnalyzer } from "@/components/tools/keyword-analyzer";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: "LinkedIn Keyword Analyzer" },
  description:
    "Analyse keywords in your LinkedIn posts, identify keyword frequency and discover content optimisation opportunities with Zybble's free analyzer.",
  keywords: [
    "LinkedIn keyword analyzer",
    "LinkedIn keyword tool",
    "LinkedIn post SEO",
    "LinkedIn content optimisation",
    "LinkedIn keyword research",
    "LinkedIn post keywords",
    "LinkedIn content analyzer",
    "LinkedIn writing optimisation",
  ],
  alternates: { canonical: "/tools/linkedin-keyword-analyzer" },
  openGraph: {
    type: "website",
    url: `${siteConfig.url}/tools/linkedin-keyword-analyzer`,
    title: "LinkedIn Keyword Analyzer",
    description:
      "Real keyword frequency, density and placement analysis for your LinkedIn drafts — computed in your browser, with no fabricated search data.",
  },
};

const faqs: FaqItem[] = [
  {
    question: "Do keywords still matter on LinkedIn?",
    answer:
      "Yes, in a specific way: LinkedIn's search and feed systems match content to people partly through the words in your post, profile and headline. Keywords matter as clarity — writing so the topic is unmistakable — not as a density game. This tool helps with the honest part: making sure the words you want to be found for are actually present, in the places people read.",
  },
  {
    question: "Why doesn't this tool show search volume or keyword difficulty?",
    answer:
      "Because it cannot know them. LinkedIn does not publish search volume, and any tool quoting precise 'LinkedIn keyword difficulty' is inventing numbers or repurposing search-engine data that does not transfer. This analyzer computes only what is genuinely measurable from your text: frequency, density, placement and emphasis.",
  },
  {
    question: "What keyword density is safe for a LinkedIn post?",
    answer:
      "As a rule of thumb, keep any single phrase under roughly 3% of the post's words — above that, human readers notice the repetition before any algorithm rewards it. The flag in the report is a reading-quality warning, not a search-engine rule, because no verified LinkedIn rule about density is published.",
  },
  {
    question: "Where should keywords appear in a LinkedIn post?",
    answer:
      "The first two lines (visible before 'see more') carry the most weight with human scanners, and the closing lines are the last thing read before commenting. The placement column in the report checks exactly those two zones plus overall body presence.",
  },
  {
    question: "Is my draft uploaded anywhere?",
    answer:
      "No. The analysis runs entirely in your browser — the text never leaves the page, and nothing is stored after you close the tab.",
  },
];

const pageUrl = `${siteConfig.url}/tools/linkedin-keyword-analyzer`;

const structuredData = [
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "LinkedIn Keyword Analyzer",
    url: pageUrl,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description:
      "Free keyword frequency, density and placement analyser for LinkedIn post drafts. Runs in the browser; reports no invented search metrics.",
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
      { "@type": "ListItem", position: 3, name: "Keyword Analyzer", item: pageUrl },
    ],
  },
];

export default function KeywordAnalyzerPage() {
  return (
    <>
      <JsonLd data={structuredData} />

      <PageHero
        eyebrow="Free tool · no signup"
        title={
          <>
            Is your post about the{" "}
            <span className="text-brand-600">keywords you think it&rsquo;s about?</span>
          </>
        }
        description="Paste a draft, add the keywords you want to be found for, and see the frequency, density and placement of every one — plus what your text actually emphasises. Computed in your browser, with zero invented search data."
        secondaryCta={{ label: "What to write about", href: "/blog/linkedin-content-pillars-for-consultants" }}
        footnote="Nothing you paste is uploaded or stored."
      />

      <section aria-label="Keyword analyzer" className="bg-slate-50/70 py-16 lg:py-20">
        <Container>
          <Reveal>
            <KeywordAnalyzer />
          </Reveal>
        </Container>
      </section>

      <section aria-labelledby="kw-explainer" className="py-16 lg:py-20">
        <Container className="max-w-3xl">
          <Reveal>
            <h2 id="kw-explainer" className="text-2xl font-semibold tracking-tight text-slate-950">
              What this tool measures — and what it refuses to fake
            </h2>
          </Reveal>
          <div className="mt-6 space-y-6 text-[15px] leading-8 text-slate-700">
            <Reveal delay={60}>
              <p>
                Every number in the report is computed from your text alone. Keyword frequency is a
                phrase-count against the post&rsquo;s real word count. Placement checks the two zones
                readers actually scan: the first two lines before &ldquo;see more&rdquo;, and the
                closing lines. The &ldquo;emphasis&rdquo; lists are frequency analysis of your own
                draft — the phrases you have, knowingly or not, made prominent.
              </p>
            </Reveal>
            <Reveal delay={80}>
              <p>
                What you will not find here is search volume, keyword difficulty or &ldquo;trending
                LinkedIn keywords.&rdquo; LinkedIn does not publish search demand, and tools that
                quote those figures for LinkedIn are dressing other data up as insight. Pretending
                otherwise would make this page feel more powerful and be less true — and the same
                honesty governs{" "}
                <Link
                  href="/linkedin-analytics"
                  className="font-medium text-brand-700 underline decoration-brand-200 underline-offset-4 hover:text-brand-800"
                >
                  Zybble&rsquo;s analytics
                </Link>
                , which only ever shows numbers LinkedIn actually returned.
              </p>
            </Reveal>
            <Reveal delay={100}>
              <p>
                Keywords are one input of many. How they fit into a repeatable body of work is the
                territory of{" "}
                <Link
                  href="/blog/linkedin-content-pillars-for-consultants"
                  className="font-medium text-brand-700 underline decoration-brand-200 underline-offset-4 hover:text-brand-800"
                >
                  content pillars
                </Link>{" "}
                and{" "}
                <Link
                  href="/blog/linkedin-content-strategy-b2b-founders"
                  className="font-medium text-brand-700 underline decoration-brand-200 underline-offset-4 hover:text-brand-800"
                >
                  a full LinkedIn content strategy
                </Link>
                — worth reading once you have a draft worth optimising.
              </p>
            </Reveal>
          </div>
        </Container>
      </section>

      <FaqSection items={faqs} description="What the analyzer measures, and its deliberate limits." />
      <FinalCta />
    </>
  );
}
