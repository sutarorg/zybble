import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { Container } from "@/components/layout/container";
import { PageHero } from "@/components/marketing/page-hero";
import { FaqSection, type FaqItem } from "@/components/marketing/faq";
import { FinalCta } from "@/components/marketing/final-cta";
import { Reveal } from "@/components/motion/reveal";
import { CharacterCounter } from "@/components/tools/character-counter";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "LinkedIn Character Counter — live count with post limits",
  description:
    "Write LinkedIn posts with a live character and word counter. See LinkedIn's 3,000-character post limit, headline and comment limits at a glance, and copy your post when it is ready.",
  alternates: { canonical: "/tools/linkedin-character-counter" },
  openGraph: {
    type: "website",
    url: `${siteConfig.url}/tools/linkedin-character-counter`,
    title: "LinkedIn Character Counter — live count with post limits",
    description:
      "A clean writing surface with a live count against LinkedIn's real character limits — posts, headlines, comments and more.",
  },
};

const faqs: FaqItem[] = [
  {
    question: "What is LinkedIn's character limit for posts?",
    answer:
      "A standard LinkedIn feed post allows up to 3,000 characters. The first three lines (roughly 200–210 characters on most screens) show before the 'see more' cut-off, which is why the opening lines carry so much weight. LinkedIn's help centre is the authority for the current figure — limits change occasionally, and this tool reflects the limit Zybble enforces in its own composer.",
  },
  {
    question: "How long should a LinkedIn post be?",
    answer:
      "Long enough to make one point properly, short enough to be read to the end. In characters: many strong posts land between 900 and 2,000, with the hook in the first 200. Length is a distribution decision, not a virtue — a tight 700-character post beats a padded 2,900-character one every time.",
  },
  {
    question: "What is the character limit for LinkedIn headlines and comments?",
    answer:
      "Profile headlines allow 220 characters; comments allow around 1,250. This tool tracks both (plus article headlines and page names) against your text so you can see at a glance which surface your draft fits.",
  },
  {
    question: "Does the counter store what I write?",
    answer:
      "No. The counter runs entirely in your browser — your text never leaves the page and nothing is stored after you close the tab. Copy your draft before you leave; if you want drafts that persist, schedule them with Zybble's free plan.",
  },
];

const pageUrl = `${siteConfig.url}/tools/linkedin-character-counter`;

const structuredData = [
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "LinkedIn Character Counter",
    url: pageUrl,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description:
      "Free live character and word counter for LinkedIn posts, with LinkedIn's post, headline, comment and article limits. No signup required.",
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
      { "@type": "ListItem", position: 3, name: "Character Counter", item: pageUrl },
    ],
  },
];

export default function CharacterCounterPage() {
  return (
    <>
      <JsonLd data={structuredData} />

      <PageHero
        eyebrow="Free tool · no signup"
        title={
          <>
            Write to the limit.{" "}
            <span className="text-brand-600">Never find it the hard way.</span>
          </>
        }
        description="A clean surface for drafting LinkedIn posts with a live character and word count, LinkedIn's real limits for every surface, and one-click copy when you are done."
        secondaryCta={{ label: "Draft it inside a scheduler", href: "/linkedin-scheduler" }}
        footnote="Runs entirely in your browser — your text never leaves the page."
      />

      <section aria-label="Character counter" className="bg-slate-50/70 py-16 lg:py-20">
        <Container>
          <Reveal>
            <CharacterCounter />
          </Reveal>
        </Container>
      </section>

      <section aria-labelledby="counter-explainer" className="py-16 lg:py-20">
        <Container className="max-w-3xl">
          <Reveal>
            <h2 id="counter-explainer" className="text-2xl font-semibold tracking-tight text-slate-950">
              The limits, and the one that matters most
            </h2>
          </Reveal>
          <div className="mt-6 space-y-6 text-[15px] leading-8 text-slate-700">
            <Reveal delay={60}>
              <p>
                LinkedIn&rsquo;s surfaces have different ceilings — 3,000 characters for a feed post, 220
                for your profile headline, roughly 1,250 for a comment, 150 for an article headline.
                The counter tracks all of them against your text, but one constraint quietly governs
                the others: the first 200–210 characters are all most people see before &ldquo;see
                more&rdquo;. Whatever you want noticed — the claim, the number, the question — belongs
                in that window.
              </p>
            </Reveal>
            <Reveal delay={80}>
              <p>
                If you are drafting for the hook as much as the body,{" "}
                <Link
                  href="/blog/linkedin-hooks-that-capture-attention"
                  className="font-medium text-brand-700 underline decoration-brand-200 underline-offset-4 hover:text-brand-800"
                >
                  how to write LinkedIn hooks that capture attention
                </Link>{" "}
                breaks down the opening line craft, and{" "}
                <Link
                  href="/blog/linkedin-text-posts-vs-carousels-vs-video"
                  className="font-medium text-brand-700 underline decoration-brand-200 underline-offset-4 hover:text-brand-800"
                >
                  text posts vs carousels vs video
                </Link>{" "}
                covers how format changes what length can do.
              </p>
            </Reveal>
            <Reveal delay={100}>
              <p className="rounded-xl bg-brand-50 px-5 py-4 text-brand-900 ring-1 ring-brand-100">
                <strong className="font-semibold">Why this counter exists:</strong> LinkedIn counts
                characters, not words, and this counter matches the 3,000-character limit Zybble
                enforces in its own composer. Shorter drafts still beat longer ones; the counter just
                keeps you honest about the ceiling.
              </p>
            </Reveal>
          </div>
        </Container>
      </section>

      <FaqSection items={faqs} description="LinkedIn's limits and how the counter works." />
      <FinalCta />
    </>
  );
}
