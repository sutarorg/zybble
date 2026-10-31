import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { LegalNotice } from "@/components/marketing/legal-notice";
import { Reveal } from "@/components/motion/reveal";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Zybble collects, uses and protects your data — LinkedIn tokens, analytics data and account information.",
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
    ],
  },
  {
    heading: "2. What we never do",
    body: [
      "We never scrape LinkedIn or collect data LinkedIn has not made available through its official API.",
      "We never sell your data or your content to anyone.",
      "We never publish to LinkedIn without a post you explicitly scheduled.",
      "We never train third-party models on your private drafts. [owner to confirm: AI feature policy]",
    ],
  },
  {
    heading: "3. How we use data",
    body: [
      "To operate the core service: publishing scheduled posts, rendering your calendar, and computing your analytics.",
      "To communicate with you about your account — transactional email only (confirmations, security alerts, receipts). Marketing email is opt-in and one click to leave. [owner to confirm: email provider details]",
      "To keep the platform secure: abuse detection, rate limiting and debugging.",
    ],
  },
  {
    heading: "4. Where data lives",
    body: [
      "Zybble is hosted on Vercel with a managed Postgres database. LinkedIn tokens are stored encrypted at rest. [owner to confirm: hosting regions and sub-processor list]",
      "Backups are retained for a limited window and then purged. [owner to confirm: retention period]",
    ],
  },
  {
    heading: "5. Your rights",
    body: [
      "Export your data — drafts, schedule history and analytics — from workspace settings at any time.",
      "Disconnect LinkedIn from Zybble or from LinkedIn's own settings; either action revokes our access.",
      "Delete your account and all associated data. Deletion is immediate from live systems and completes in backups within 30 days. [owner to confirm: deletion SLA]",
      "Residents of the EEA, UK and California have additional statutory rights; contact us to exercise them. [owner to confirm: privacy contact address]",
    ],
  },
  {
    heading: "6. Contact",
    body: [
      "Questions about this policy or your data: [owner to confirm: privacy@ email address].",
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
          Last updated: <time dateTime="2026-01-19">January 19, 2026</time>
        </p>
        <div className="mt-8">
          <LegalNotice />
        </div>
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
