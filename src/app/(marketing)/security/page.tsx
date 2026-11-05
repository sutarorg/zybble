import type { Metadata } from "next";
import Link from "next/link";
import { Database, KeyRound, Lock, ServerCog, ShieldCheck, UserCheck } from "lucide-react";
import { JsonLd } from "@/components/json-ld";
import { Container } from "@/components/layout/container";
import { FinalCta } from "@/components/marketing/final-cta";
import { PageHero } from "@/components/marketing/page-hero";
import { Reveal } from "@/components/motion/reveal";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: "Zybble Security" },
  description:
    "Learn how Zybble protects account information and handles LinkedIn integrations, authentication, application security and customer data.",
  keywords: [
    "Zybble security",
    "LinkedIn account security",
    "SaaS data protection",
    "secure LinkedIn integration",
    "LinkedIn OAuth security",
    "customer data protection",
    "SaaS application security",
    "secure social media management",
  ],
  alternates: { canonical: "/security" },
  openGraph: {
    type: "website",
    url: `${siteConfig.url}/security`,
    title: "Zybble Security",
    description:
      "Authentication, encrypted LinkedIn tokens, least-privilege data access and an official-API-only integration — explained plainly.",
  },
};

const pageUrl = `${siteConfig.url}/security`;

const structuredData = [
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Security at Zybble",
    url: pageUrl,
    description:
      "Zybble's security practices: authentication, data protection, the LinkedIn integration and responsible disclosure.",
    isPartOf: { "@type": "WebSite", name: siteConfig.name, url: siteConfig.url },
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
      { "@type": "ListItem", position: 2, name: "Security", item: pageUrl },
    ],
  },
];

const practices = [
  {
    icon: KeyRound,
    title: "Accounts and authentication",
    points: [
      "Sign-in is handled by Supabase Auth: passwords are stored only as salted hashes, never in plaintext, and never by Zybble itself.",
      "Password resets and email verification use single-purpose, expiring links delivered to the address on the account.",
      "Session cookies are HTTP-only and scoped to the site; every private page is served with no-store so a shared or cached response can never show one person's workspace to another.",
    ],
  },
  {
    icon: Lock,
    title: "Your LinkedIn connection",
    points: [
      "Zybble connects through LinkedIn's official OAuth flow. We never see, ask for or store your LinkedIn password.",
      "The access token LinkedIn returns is stored encrypted at rest and used only to publish the posts you scheduled and read the analytics LinkedIn returns.",
      "You can revoke Zybble's access at any time — from LinkedIn's own settings or from your Zybble workspace — and either action ends our access immediately.",
    ],
  },
  {
    icon: Database,
    title: "Data isolation",
    points: [
      "Workspace data lives in Postgres with row-level security: queries are scoped to your workspace at the database layer, not just in application code.",
      "Multi-tenant isolation is covered by automated tests that attempt cross-workspace reads and assert they fail.",
      "Drafts, scheduled posts and analytics are visible only inside your workspace. Team members see the workspace they belong to — nothing beyond it.",
    ],
  },
  {
    icon: ServerCog,
    title: "Operations",
    points: [
      "The app runs on Vercel with a managed Postgres database. Transport is HTTPS-only, and browsers are told to remember that (HSTS) in production.",
      "Every response carries baseline hardening headers: nosniff, strict referrer policy, frame protections and a restrictive permissions policy.",
      "Private routes send explicit noindex headers as well as robots rules, and all API endpoints are rate-limited — most tightly where abuse would hurt most: authentication, OAuth and publishing.",
    ],
  },
  {
    icon: UserCheck,
    title: "People and access",
    points: [
      "Zybble is a small product with a small surface: service-role database credentials exist only for background jobs and webhooks, never in browser code.",
      "Payment processing is handled by a third-party processor; Zybble does not store card numbers.",
      "No security certifications or audit reports are claimed here — what is described on this page is what the system actually does today.",
    ],
  },
];

export default function SecurityPage() {
  return (
    <>
      <JsonLd data={structuredData} />

      <PageHero
        eyebrow="Security"
        title={
          <>
            What we protect, and{" "}
            <span className="text-brand-600">how — stated plainly</span>
          </>
        }
        description="Zybble handles your account, your drafts and a connection to your professional identity. This page describes, without marketing varnish, how that data is protected and what the LinkedIn integration can and cannot do."
        secondaryCta={{ label: "Data handling in detail", href: "/privacy" }}
        footnote="No certifications or audits are claimed on this page — only practices that are true today."
      />

      <section aria-label="Security practices" className="bg-slate-50/70 py-16 lg:py-20">
        <Container>
          <div className="grid gap-6 md:grid-cols-2">
            {practices.map((practice, i) => (
              <Reveal key={practice.title} delay={(i % 2) * 80}>
                <div className="h-full rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-xs">
                  <span aria-hidden className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                    <practice.icon className="size-5" />
                  </span>
                  <h2 className="mt-4 text-lg font-semibold tracking-tight text-slate-950">{practice.title}</h2>
                  <ul className="mt-3 space-y-2.5">
                    {practice.points.map((point) => (
                      <li key={point} className="flex gap-2.5 text-sm leading-6 text-slate-600">
                        <span aria-hidden className="mt-[9px] size-1.5 shrink-0 rounded-full bg-brand-400" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={140}>
            <div className="mt-10 rounded-2xl bg-white p-7 ring-1 ring-slate-200">
              <div className="flex items-start gap-4">
                <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                  <ShieldCheck className="size-5" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-slate-950">
                    Reporting a security concern
                  </h2>
                  <p className="mt-2 text-[15px] leading-7 text-slate-600">
                    If you have found a vulnerability or see something that looks wrong, tell us:{" "}
                    <a
                      href={`mailto:${siteConfig.email.support}`}
                      className="font-medium text-brand-700 underline underline-offset-4 hover:text-brand-800"
                    >
                      {siteConfig.email.support}
                    </a>{" "}
                    — or through the{" "}
                    <Link href="/contact" className="font-medium text-brand-700 underline underline-offset-4 hover:text-brand-800">
                      contact form
                    </Link>{" "}
                    with the topic set to Security. Describe what you found and how to reproduce it;
                    every report gets a considered reply. Please give us a reasonable window to fix
                    issues before public disclosure, and do not test against accounts or data that
                    are not yours.
                  </p>
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal delay={160}>
            <p className="mt-8 text-center text-sm leading-6 text-slate-500">
              Questions about how your data is used rather than how it is protected? That is our{" "}
              <Link href="/privacy" className="font-medium text-brand-700 underline underline-offset-4 hover:text-brand-800">
                privacy policy
              </Link>
              .
            </p>
          </Reveal>
        </Container>
      </section>

      <FinalCta />
    </>
  );
}
