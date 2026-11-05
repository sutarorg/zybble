import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { Reveal } from "@/components/motion/reveal";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: "Zybble Privacy Policy" },
  description:
    "Read Zybble's privacy policy to understand how personal information, account data, LinkedIn connections and usage information are collected and handled.",
  keywords: [
    "Zybble privacy policy",
    "Zybble data privacy",
    "LinkedIn data privacy",
    "personal information protection",
    "SaaS privacy policy",
    "user data management",
    "account information privacy",
    "data handling policy",
  ],
  alternates: { canonical: "/privacy" },
};

const sections = [
  {
    heading: "1. What we collect",
    body: [
      "Account information: your name, email address and password (stored only as a salted hash) when you create a Zybble account.",
      "LinkedIn connection data: when you connect LinkedIn, we store the OAuth access token and basic profile identifiers returned by LinkedIn's API. We never see or store your LinkedIn password.",
      "Content you create: drafts, scheduled posts and media you add to the workspace.",
      "Usage and analytics data: metrics returned by the LinkedIn API for your posts, plus standard technical logs (browser type, IP address, timestamps) required to operate the service securely.",
      "If you write to us through the contact form, we receive your name, email address and message, and use them only to respond.",
    ],
  },
  {
    heading: "2. What we never do",
    body: [
      "We never scrape LinkedIn or collect data LinkedIn has not made available through its official API.",
      "We never sell your data or your content to anyone.",
      "We never publish to LinkedIn without a post you explicitly scheduled.",
      "We never train third-party models on your private drafts — Zybble has no features that send your content to model providers.",
    ],
  },
  {
    heading: "3. How we use data",
    body: [
      "To operate the core service: publishing scheduled posts, rendering your calendar, and computing your analytics.",
      "To communicate with you about your account — transactional email only (confirmations, security alerts and receipts), sent through a third-party email delivery provider. Marketing email does not exist today; if that ever changes, it will be opt-in and one click to leave.",
      "To process payments for the Pro plan through a third-party payment processor. Card details go to the processor, not to Zybble.",
      "To keep the platform secure: abuse detection, rate limiting and debugging.",
    ],
  },
  {
    heading: "4. Where data lives",
    body: [
      "Zybble is hosted on Vercel with a managed Postgres database. LinkedIn tokens are stored encrypted at rest.",
      "A small, ordinary set of sub-processors is involved in operating the service: hosting (Vercel), the database, authentication (Supabase), email delivery and payment processing.",
      "Backups are retained for a limited disaster-recovery window and then purged.",
      "Workspace data is isolated at the database layer with row-level security, so one workspace's data is never served to another.",
    ],
  },
  {
    heading: "5. Your rights",
    body: [
      "Your drafts, schedule history and analytics are visible in your workspace at any time. For a copy of your data in a portable format, contact us and we will provide it.",
      "Disconnect LinkedIn from Zybble or from LinkedIn's own settings; either action revokes our access.",
      "Delete your account and its associated data from your account settings. Deletion removes data from live systems; backup copies expire with the backup window described above.",
      "Residents of the EEA, UK and California have statutory rights over their personal data, including access, correction and deletion. To exercise them — or ask anything about this policy — write to us.",
    ],
  },
  {
    heading: "6. Changes to this policy",
    body: [
      "If this policy changes in a way that matters, we will tell you in the product or by email before the change takes effect. The date below always reflects the current version.",
    ],
  },
  {
    heading: "7. Contact",
    body: [
      `Questions about this policy or your data: ${siteConfig.email.support} — or through the contact form. Messages reach the founder directly.`,
    ],
  },
] as const;

export default function PrivacyPage() {
  return (
    <Container className="max-w-3xl py-20 lg:py-24">
      <Reveal>
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
          Legal
        </p>
        <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight text-slate-950">
          Privacy Policy
        </h1>
        <p className="mt-4 text-sm text-slate-500">
          Last updated: <time dateTime="2026-11-01">November 1, 2026</time>
        </p>
        <p className="mt-6 text-[15px] leading-7 text-slate-600">
          This policy describes what Zybble collects and how it is used. It is written to be read,
          not skimmed past. How we protect what we hold is described separately on our{" "}
          <Link href="/security" className="font-medium text-brand-700 underline underline-offset-4 hover:text-brand-800">
            security page
          </Link>
          .
        </p>
      </Reveal>

      <div className="mt-8">
        {sections.map((section) => (
          <section key={section.heading} className="mt-10">
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">
              {section.heading}
            </h2>
            <ul className="mt-4 space-y-3">
              {section.body.map((item) => (
                <li key={item} className="text-[15px] leading-7 text-slate-600">
                  {item}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Container>
  );
}
