import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { LegalNotice } from "@/components/marketing/legal-notice";
import { Reveal } from "@/components/motion/reveal";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms that govern your use of Zybble: plans, acceptable use, LinkedIn's rules, cancellation and liability.",
  alternates: { canonical: "/terms" },
};

const sections = [
  {
    heading: "1. The service",
    body: [
      "Zybble provides a web application for scheduling LinkedIn posts and viewing LinkedIn post analytics. The service is offered in two plans: Free ($0/month) and Pro ($15 per seat/month), with the entitlements described on the pricing page at the time of purchase.",
      "Zybble is an independent product and is not affiliated with, endorsed by or sponsored by LinkedIn Corporation.",
    ],
  },
  {
    heading: "2. Your account",
    body: [
      "You must provide accurate registration information and keep your credentials confidential. You are responsible for activity under your account.",
      "You must have the right to manage any LinkedIn account or page you connect to Zybble.",
    ],
  },
  {
    heading: "3. Acceptable use",
    body: [
      "You agree to use Zybble in compliance with LinkedIn's terms and community policies. Content scheduled through Zybble is your responsibility.",
      "You may not use Zybble to distribute spam, deceptive content or material you have no right to publish, and you may not attempt to circumvent plan limits or the LinkedIn API's rules.",
      "We may suspend accounts that violate these rules, with notice where practical. [owner to confirm: enforcement process]",
    ],
  },
  {
    heading: "4. Billing and cancellation",
    body: [
      "Pro is billed monthly per seat in US dollars. There are no long-term contracts.",
      "You can cancel at any time from workspace settings. Cancellation takes effect at the end of the current billing period; you retain Pro access until then. We do not offer partial-period refunds except where required by law. [owner to confirm: refund policy]",
      "Plan limits are enforced server-side. If your usage exceeds a plan's limits after a downgrade, existing scheduled posts still publish, but new scheduling pauses until you are within the plan's limits.",
    ],
  },
  {
    heading: "5. Availability and changes",
    body: [
      "We aim for high availability but do not warrant uninterrupted service. Scheduled publishing depends on LinkedIn's API being available; if LinkedIn is unreachable, Zybble will retry and notify you of failures. [owner to confirm: SLA wording]",
      "We may update these terms with reasonable advance notice for material changes. Continued use after the effective date constitutes acceptance.",
    ],
  },
  {
    heading: "6. Liability",
    body: [
      "The service is provided “as is” within the limits of applicable law. Nothing in these terms limits liability that cannot be limited by law. [owner to confirm: governing law and jurisdiction]",
    ],
  },
  {
    heading: "7. Contact",
    body: [
      "Questions about these terms: [owner to confirm: legal contact email].",
    ],
  },
] as const;

export default function TermsPage() {
  return (
    <Container className="max-w-3xl py-20 lg:py-24">
      <Reveal>
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
          Legal
        </p>
        <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight text-slate-950">
          Terms of Service
        </h1>
        <p className="mt-4 text-sm text-slate-500">
          Last updated: <time dateTime="2026-01-19">January 19, 2026</time>
        </p>
        <p className="mt-4 text-[15px] leading-7 text-slate-600">
          These terms sit alongside our{" "}
          <Link href="/privacy" className="font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800">
            Privacy Policy
          </Link>
          , which explains how we handle your data.
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
