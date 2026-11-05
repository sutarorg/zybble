import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Calculator, CalendarDays, Search, Type } from "lucide-react";
import { JsonLd } from "@/components/json-ld";
import { Container } from "@/components/layout/container";
import { FinalCta } from "@/components/marketing/final-cta";
import { PageHero } from "@/components/marketing/page-hero";
import { Reveal } from "@/components/motion/reveal";
import { FREE_TOOLS, type FreeTool } from "@/lib/free-tools";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: "Free LinkedIn Tools" },
  description:
    "Explore free LinkedIn tools from Zybble, including an engagement calculator, content calendar template, character counter and keyword analyzer.",
  keywords: [
    "free LinkedIn tools",
    "LinkedIn tools online",
    "LinkedIn engagement calculator",
    "LinkedIn content calendar",
    "LinkedIn character counter",
    "LinkedIn keyword analyzer",
    "LinkedIn content planning tools",
    "free LinkedIn resources",
  ],
  alternates: { canonical: "/free-linkedin-tools" },
  openGraph: {
    type: "website",
    url: `${siteConfig.url}/free-linkedin-tools`,
    title: "Free LinkedIn Tools",
    description:
      "Calculate, plan, count and analyse — four working LinkedIn tools that are actually free, with no registration.",
  },
};

const pageUrl = `${siteConfig.url}/free-linkedin-tools`;

const ICONS = {
  calculator: Calculator,
  calendar: CalendarDays,
  type: Type,
  search: Search,
} as const;

const ACCENTS = {
  brand: "bg-brand-50 text-brand-700 ring-brand-100",
  sky: "bg-sky-50 text-sky-700 ring-sky-100",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-100",
  cyan: "bg-cyan-50 text-cyan-700 ring-cyan-100",
} as const;

function ToolCard({ tool, index }: { tool: FreeTool; index: number }) {
  const Icon = ICONS[tool.icon];
  return (
    <Reveal delay={(index % 2) * 80}>
      <Link
        href={tool.href}
        className="group flex h-full flex-col rounded-2xl bg-white p-7 ring-1 ring-slate-200 shadow-xs transition-all duration-300 hover:-translate-y-0.5 hover:shadow-soft"
      >
        <span
          aria-hidden
          className={`flex size-11 items-center justify-center rounded-xl ring-1 ${ACCENTS[tool.accent as keyof typeof ACCENTS]}`}
        >
          <Icon className="size-5" />
        </span>
        <h2 className="mt-5 text-xl font-semibold tracking-tight text-slate-950">
          {tool.name}
          <ArrowRight
            className="ml-1.5 inline size-4 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-brand-600"
            aria-hidden
          />
        </h2>
        <p className="mt-2.5 flex-1 text-[15px] leading-7 text-slate-600">{tool.blurb}</p>
        <ul className="mt-4 space-y-1.5">
          {tool.features.slice(0, 3).map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm leading-6 text-slate-500">
              <span aria-hidden className="mt-[9px] size-1 shrink-0 rounded-full bg-brand-400" />
              {feature}
            </li>
          ))}
        </ul>
        <p className="mt-5 inline-flex w-fit items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 ring-1 ring-slate-200">
          Free · no signup
        </p>
      </Link>
    </Reveal>
  );
}

export default function FreeToolsPage() {
  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Free LinkedIn Tools",
            url: pageUrl,
            description:
              "Four genuinely free LinkedIn tools from Zybble: engagement rate calculator, content calendar template, character counter and keyword analyzer. No signup required.",
            isPartOf: { "@type": "WebSite", name: siteConfig.name, url: siteConfig.url },
            mainEntity: {
              "@type": "ItemList",
              itemListElement: FREE_TOOLS.map((tool, index) => ({
                "@type": "ListItem",
                position: index + 1,
                name: tool.name,
                url: `${siteConfig.url}${tool.href}`,
              })),
            },
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
              { "@type": "ListItem", position: 2, name: "Free LinkedIn tools", item: pageUrl },
            ],
          },
        ]}
      />

      <PageHero
        eyebrow="Free tools · no signup"
        title={
          <>
            Free LinkedIn tools that{" "}
            <span className="text-brand-600">respect your time</span>
          </>
        }
        description="Four working tools — calculate your engagement rate, plan a content month, write to LinkedIn's limits and analyse your draft's keywords. Everything runs in your browser: no account, no email gate, nothing uploaded."
        secondaryCta={{ label: "See what the paid product adds", href: "/pricing" }}
        footnote="Built by the Zybble team. The same honesty as the product: real calculations, no invented metrics."
      />

      <section aria-label="The tools" className="bg-slate-50/70 py-16 lg:py-20">
        <Container>
          <div className="grid gap-6 sm:grid-cols-2">
            {FREE_TOOLS.map((tool, index) => (
              <ToolCard key={tool.href} tool={tool} index={index} />
            ))}
          </div>
        </Container>
      </section>

      <FinalCta />
    </>
  );
}
