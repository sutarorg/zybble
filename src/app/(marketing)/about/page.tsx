import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { LineChart, ShieldCheck, Target } from "lucide-react";
import { JsonLd } from "@/components/json-ld";
import { Container } from "@/components/layout/container";
import { FinalCta } from "@/components/marketing/final-cta";
import { Reveal } from "@/components/motion/reveal";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: "About Zybble" },
  description:
    "Discover Zybble's mission to simplify LinkedIn scheduling and analytics, and meet Tejas Sutar, the founder building a focused LinkedIn growth platform.",
  keywords: [
    "about Zybble",
    "Zybble founder",
    "LinkedIn scheduling company",
    "LinkedIn analytics platform",
    "LinkedIn productivity tools",
    "LinkedIn SaaS platform",
    "B2B content management",
    "LinkedIn marketing software",
  ],
  alternates: { canonical: "/about" },
  openGraph: {
    type: "website",
    url: `${siteConfig.url}/about`,
    title: "About Zybble",
    description:
      "Why Zybble exists: a focused LinkedIn scheduler and analytics workspace for founders and consultants who publish seriously.",
  },
};

const pageUrl = `${siteConfig.url}/about`;

const structuredData = [
  {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: "About Zybble",
    url: pageUrl,
    description:
      "The story, mission and product philosophy behind Zybble, a focused LinkedIn scheduling and analytics workspace.",
    mainEntity: {
      "@type": "Organization",
      name: siteConfig.name,
      url: siteConfig.url,
      logo: `${siteConfig.url}${siteConfig.logoPath}`,
      description: siteConfig.description,
      founder: {
        "@type": "Person",
        name: "Tejas Sutar",
        jobTitle: "Founder of Zybble",
        homeLocation: {
          "@type": "Place",
          address: {
            "@type": "PostalAddress",
            addressLocality: "Pune",
            addressRegion: "Maharashtra",
            addressCountry: "IN",
          },
        },
        alumniOf: {
          "@type": "CollegeOrUniversity",
          name: "Savitribai Phule Pune University",
        },
      },
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
      { "@type": "ListItem", position: 2, name: "About", item: pageUrl },
    ],
  },
];

const philosophy = [
  {
    icon: Target,
    title: "One job, done properly",
    body: "Zybble deliberately covers LinkedIn only. Every screen is designed around how professionals actually publish there — no tabs for six other networks, no features that exist to fill a comparison table.",
  },
  {
    icon: LineChart,
    title: "Numbers you can act on",
    body: "Per-post performance, engagement trends and best-time insights, computed from your own publishing history. The question every chart must answer: what should your next post do differently?",
  },
  {
    icon: ShieldCheck,
    title: "Honest by default",
    body: "Official LinkedIn APIs, published plan limits, analytics that never substitute invented numbers, and marketing that only claims what the product does. Trust compounds the same way content does.",
  },
];

export default function AboutPage() {
  return (
    <>
      <JsonLd data={structuredData} />

      <article>
        {/* Opening */}
        <section className="relative overflow-hidden">
          <div aria-hidden className="absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-gradient-to-b from-brand-50/70 via-white to-white" />
            <div className="bg-grid-blue absolute inset-x-0 top-0 h-[320px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]" />
          </div>
          <Container className="py-20 lg:py-28">
            <Reveal className="mx-auto max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">About</p>
              <h1 className="mt-3 text-balance text-4xl font-semibold leading-[1.1] tracking-tight text-slate-950 sm:text-5xl">
                Zybble exists because publishing on LinkedIn got complicated. It
                isn&rsquo;t.
              </h1>
              <p className="mt-6 text-pretty text-lg leading-8 text-slate-600">
                Write something worth reading. Put it on a calendar. Publish it at a
                time your audience is actually there. Learn what worked. Repeat.
                That is the whole discipline — and it is the product Zybble builds,
                deliberately and only.
              </p>
            </Reveal>
          </Container>
        </section>

        {/* Story */}
        <section aria-labelledby="story-heading" className="py-16 lg:py-20">
          <Container className="max-w-3xl">
            <Reveal>
              <h2 id="story-heading" className="text-2xl font-semibold tracking-tight text-slate-950">
                The story so far
              </h2>
            </Reveal>
            <div className="mt-6 space-y-6 text-[15px] leading-8 text-slate-700">
              <Reveal delay={60}>
                <p>
                  <strong className="font-semibold text-slate-900">Zybble</strong> is a focused
                  LinkedIn scheduling and analytics workspace. It gives founders, consultants and
                  creators a calm place to draft, a calendar that makes consistency visible, and
                  analytics that explain what each post actually did — in one workspace, on a free
                  plan that is a real plan rather than a trial.
                </p>
              </Reveal>
              <Reveal delay={70}>
                <p>
                  The problem it solves is familiar to anyone who has tried to stay visible on
                  LinkedIn while doing a day job. The advice says post consistently, but the tools
                  pull in two directions: all-in-one suites bury LinkedIn inside six other networks,
                  and doing it by hand means the daily negotiation between the work that pays and the
                  publishing that compounds — a negotiation the publishing always loses. The cost is
                  invisible and enormous: good thinking, never shared, from people with real
                  expertise to share.
                </p>
              </Reveal>
              <Reveal delay={80}>
                <p>
                  Zybble&rsquo;s answer is subtraction. One network, done properly: a composer tuned
                  for LinkedIn&rsquo;s format, a queue that publishes on time through LinkedIn&rsquo;s
                  official API, per-post analytics, and best-time insights computed from your own
                  history rather than someone else&rsquo;s averages. The mission is to make steady,
                  honest publishing the default for professionals whose expertise deserves an
                  audience — and to keep the product simple enough that you never need a tutorial to
                  use it.
                </p>
              </Reveal>
            </div>
          </Container>
        </section>

        {/* Philosophy */}
        <section aria-labelledby="philosophy-heading" className="border-y border-slate-200 bg-slate-50/70 py-16 lg:py-20">
          <Container>
            <Reveal>
              <h2 id="philosophy-heading" className="text-2xl font-semibold tracking-tight text-slate-950">
                Product philosophy
              </h2>
            </Reveal>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {philosophy.map((principle, i) => (
                <Reveal key={principle.title} delay={i * 80}>
                  <div className="h-full rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-xs">
                    <span aria-hidden className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                      <principle.icon className="size-5" />
                    </span>
                    <h3 className="mt-4 text-[15px] font-semibold text-slate-900">{principle.title}</h3>
                    <p className="mt-2 text-[15px] leading-7 text-slate-600">{principle.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal delay={140}>
              <div className="mt-10 rounded-2xl bg-white p-7 ring-1 ring-slate-200">
                <h3 className="text-lg font-semibold tracking-tight text-slate-950">
                  Why LinkedIn-only scheduling matters
                </h3>
                <p className="mt-3 text-[15px] leading-8 text-slate-700">
                  LinkedIn is not &ldquo;another channel.&rdquo; It is the one network where a
                  professional&rsquo;s judgement is the product: posts are read as thinking, comments
                  become conversations, and conversations become work. Publishing there well — format
                  limits, hooks, the &ldquo;see more&rdquo; cut-off, the rhythm of a professional
                  week — is its own craft. A tool that treats LinkedIn as one tab among nine cannot
                  respect that craft, so Zybble treats it as the whole job.
                </p>
              </div>
            </Reveal>

            <Reveal delay={160}>
              <div className="mt-6 rounded-2xl bg-white p-7 ring-1 ring-slate-200">
                <h3 className="text-lg font-semibold tracking-tight text-slate-950">
                  Our approach to analytics and transparency
                </h3>
                <ul className="mt-3 space-y-3 text-[15px] leading-8 text-slate-700">
                  <li className="flex gap-3">
                    <span aria-hidden className="mt-[15px] size-1.5 shrink-0 rounded-full bg-brand-500" />
                    <span>
                      Zybble&rsquo;s analytics come only from LinkedIn&rsquo;s official API for
                      accounts you connected. When LinkedIn has not returned a number, the workspace
                      says so — it never substitutes an estimate.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span aria-hidden className="mt-[15px] size-1.5 shrink-0 rounded-full bg-brand-500" />
                    <span>
                      Best-time insights are computed from your own publishing history — your data
                      about your audience, never generic industry averages presented as personal
                      advice.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span aria-hidden className="mt-[15px] size-1.5 shrink-0 rounded-full bg-brand-500" />
                    <span>
                      Plan limits are published plainly and enforced server-side. When a capability
                      depends on LinkedIn API permissions that are still pending approval, the
                      product says that too.
                    </span>
                  </li>
                </ul>
                <p className="mt-4 text-sm leading-6 text-slate-500">
                  The operational details — security practices, data handling and integrations — are
                  described on our{" "}
                  <Link href="/security" className="font-medium text-brand-700 underline underline-offset-4 hover:text-brand-800">
                    security page
                  </Link>{" "}
                  and in our{" "}
                  <Link href="/privacy" className="font-medium text-brand-700 underline underline-offset-4 hover:text-brand-800">
                    privacy policy
                  </Link>
                  .
                </p>
              </div>
            </Reveal>
          </Container>
        </section>

        {/* Founder */}
        <section aria-labelledby="founder-heading" className="py-16 lg:py-24">
          <Container className="max-w-4xl">
            <div className="grid items-start gap-10 md:grid-cols-[auto_1fr]">
              <Reveal>
                <div className="flex flex-col items-center text-center">
                  {/* Founder portrait, hosted off-site.
                      `unoptimized` is deliberate: it makes the browser fetch the
                      file straight from the host, so the image renders without
                      the Next image optimiser needing to proxy it. To serve it
                      from this repo instead, save it as
                      public/images/tejas-sutar.jpg, point `src` at
                      "/images/tejas-sutar.jpg" and drop `unoptimized`. */}
                  <Image
                    src="https://i.ibb.co/tMywK0cN/Untitled-design-9.png"
                    alt="Tejas Sutar, founder of Zybble"
                    width={160}
                    height={160}
                    unoptimized
                    className="size-40 rounded-3xl object-cover shadow-soft ring-1 ring-brand-700/50"
                  />
                </div>
              </Reveal>
              <Reveal delay={80}>
                <h2 id="founder-heading" className="text-2xl font-semibold tracking-tight text-slate-950">
                  Tejas Sutar
                </h2>
                <p className="mt-1 text-[15px] font-medium text-brand-700">Founder of Zybble</p>
                <p className="mt-3 text-[15px] leading-7 text-slate-600">
                  Pune, Maharashtra, India · Savitribai Phule Pune University (SPPU)
                </p>
                <blockquote className="mt-6 rounded-2xl border-l-2 border-brand-600 bg-brand-50/50 px-6 py-5">
                  <p className="text-pretty text-lg font-medium leading-8 text-brand-950">
                    &ldquo;I built Zybble because the tools I wanted didn&rsquo;t exist: a scheduler
                    that treats LinkedIn as the whole job, and analytics that tell the truth. The
                    mission is simple — help founders and consultants publish consistently, learn
                    from every post, and grow without living inside a feed. If Zybble gives you back
                    an hour a week and a clearer picture of your audience, it has done its job.&rdquo;
                  </p>
                </blockquote>
                <p className="mt-4 text-sm leading-6 text-slate-500">
                  Questions, feedback or a problem the product should solve?{" "}
                  <Link href="/contact" className="font-medium text-brand-700 underline underline-offset-4 hover:text-brand-800">
                    Write to us
                  </Link>{" "}
                  — messages reach the founder directly.
                </p>
              </Reveal>
            </div>
          </Container>
        </section>
      </article>

      <FinalCta />
    </>
  );
}
