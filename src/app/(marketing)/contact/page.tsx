import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Bug, ShieldQuestion } from "lucide-react";
import { JsonLd } from "@/components/json-ld";
import { Container } from "@/components/layout/container";
import { PageHero } from "@/components/marketing/page-hero";
import { Reveal } from "@/components/motion/reveal";
import { ContactForm } from "@/components/marketing/contact-form";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: "Contact Zybble" },
  description:
    "Contact Zybble for product questions, technical support, business enquiries and partnership opportunities related to LinkedIn scheduling and analytics.",
  keywords: [
    "contact Zybble",
    "Zybble support",
    "LinkedIn scheduler support",
    "LinkedIn analytics support",
    "Zybble contact details",
    "SaaS customer support",
    "business enquiries",
    "LinkedIn software assistance",
  ],
  alternates: { canonical: "/contact" },
  openGraph: {
    type: "website",
    url: `${siteConfig.url}/contact`,
    title: "Contact Zybble",
    description: "Questions about Zybble? Messages reach the founder directly.",
  },
};

const pageUrl = `${siteConfig.url}/contact`;

const structuredData = [
  {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: "Contact Zybble",
    url: pageUrl,
    description: "Contact and customer support for Zybble.",
    mainEntity: {
      "@type": "Organization",
      name: siteConfig.name,
      url: siteConfig.url,
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: siteConfig.email.support,
        availableLanguage: ["English"],
      },
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
      { "@type": "ListItem", position: 2, name: "Contact", item: pageUrl },
    ],
  },
];

const shortcuts = [
  {
    icon: Bug,
    title: "Reporting a bug?",
    body: "Include what you expected, what happened instead, and the post or screen involved. Specific reports get fixed faster.",
  },
  {
    icon: ShieldQuestion,
    title: "Security issue?",
    body: "Please report security matters through this form with the topic set to Security, or email directly. We take every report seriously and respond thoughtfully — see our practices on the security page.",
    link: { href: "/security", label: "How Zybble handles security" },
  },
  {
    icon: BookOpen,
    title: "Question first?",
    body: "Many answers live in the blog and the free tools — engagement rate maths, calendar systems and posting limits are all covered there.",
    link: { href: "/free-linkedin-tools", label: "Browse the free tools" },
  },
];

export default function ContactPage() {
  return (
    <>
      <JsonLd data={structuredData} />

      <PageHero
        eyebrow="Contact"
        title={
          <>
            Talk to the person{" "}
            <span className="text-brand-600">who builds it</span>
          </>
        }
        description="Zybble is small by design, and support is not a department here. Messages from this form arrive in the founder's inbox and are read — usually answered within a couple of days."
        footnote={`Prefer email? Write directly to ${siteConfig.email.support}.`}
      />

      <section aria-label="Contact form" className="bg-slate-50/70 py-16 lg:py-20">
        <Container className="max-w-3xl">
          <Reveal>
            <ContactForm />
          </Reveal>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {shortcuts.map((item, i) => (
              <Reveal key={item.title} delay={i * 60}>
                <div className="h-full rounded-2xl bg-white p-5 ring-1 ring-slate-200">
                  <item.icon aria-hidden className="size-5 text-brand-600" />
                  <h2 className="mt-3 text-[15px] font-semibold text-slate-900">{item.title}</h2>
                  <p className="mt-1.5 text-sm leading-6 text-slate-600">{item.body}</p>
                  {item.link && (
                    <Link
                      href={item.link.href}
                      className="mt-2 inline-block text-sm font-medium text-brand-700 underline underline-offset-4 hover:text-brand-800"
                    >
                      {item.link.label} →
                    </Link>
                  )}
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={120}>
            <p className="mt-8 text-center text-sm leading-6 text-slate-500">
              Zybble is built in Pune, India. Read more about the product and the people on{" "}
              <Link href="/about" className="font-medium text-brand-700 underline underline-offset-4 hover:text-brand-800">
                the about page
              </Link>
              .
            </p>
          </Reveal>
        </Container>
      </section>
    </>
  );
}
