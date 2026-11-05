import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { JsonLd } from "@/components/json-ld";
import { Container } from "@/components/layout/container";
import { PageHero } from "@/components/marketing/page-hero";
import { FaqSection, type FaqItem } from "@/components/marketing/faq";
import { FinalCta } from "@/components/marketing/final-cta";
import { Reveal } from "@/components/motion/reveal";
import { CalendarPlanner } from "@/components/tools/calendar-planner";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: "Free LinkedIn Content Calendar Template" },
  description:
    "Download a free LinkedIn content calendar template to plan post ideas, organise publishing dates, manage content formats and stay consistent.",
  keywords: [
    "LinkedIn content calendar template",
    "free LinkedIn calendar",
    "LinkedIn posting schedule template",
    "LinkedIn content planner",
    "monthly LinkedIn calendar",
    "weekly LinkedIn planner",
    "social media calendar template",
    "LinkedIn content strategy template",
  ],
  alternates: { canonical: "/resources/linkedin-content-calendar-template" },
  openGraph: {
    type: "website",
    url: `${siteConfig.url}/resources/linkedin-content-calendar-template`,
    title: "Free LinkedIn Content Calendar Template",
    description:
      "An interactive weekly and monthly LinkedIn content planner with a free CSV download — no email gate.",
  },
};

const CSV_HREF = "/downloads/linkedin-content-calendar-template.csv";

const faqs: FaqItem[] = [
  {
    question: "Is the template really free?",
    answer:
      "Yes — the planner on this page and the CSV download are both free, with no account and no email gate. The planner saves your plan in your own browser; the CSV is yours to keep and edit in any spreadsheet tool.",
  },
  {
    question: "How far ahead should I plan my LinkedIn content?",
    answer:
      "One to two weeks is the sweet spot: far enough ahead that a chaotic week cannot break your cadence, close enough that posts still reflect what you are actually learning. Fill the template a week at a time and review it in the same weekly session where you draft.",
  },
  {
    question: "What should go in the 'Notes' field?",
    answer:
      "Anything future-you needs to execute fast: the hook angle, the link for the first comment, the asset you need to make, the person whose permission you need. The template works best when notes answer 'what would stop me publishing this in two minutes on the day?'",
  },
  {
    question: "How does this differ from the calendar inside Zybble?",
    answer:
      "This template plans; Zybble executes. The planner here helps you decide what goes where; Zybble's calendar holds the actual drafts, publishes them automatically at the scheduled moment, and shows you the results afterwards. Many people start here and move the plan into a scheduler once the cadence is real.",
  },
];

const pageUrl = `${siteConfig.url}/resources/linkedin-content-calendar-template`;

const structuredData = [
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Free LinkedIn Content Calendar Template",
    url: pageUrl,
    description:
      "Interactive weekly and monthly LinkedIn content planner with a free downloadable CSV template — no signup required.",
    isPartOf: { "@type": "WebSite", name: siteConfig.name, url: siteConfig.url },
  },
  {
    "@context": "https://schema.org",
    "@type": "DownloadAction",
    name: "Download the LinkedIn content calendar template (CSV)",
    target: `${siteConfig.url}${CSV_HREF}`,
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
      { "@type": "ListItem", position: 3, name: "Content Calendar Template", item: pageUrl },
    ],
  },
];

const instructions = [
  {
    title: "Start with slots, not ideas",
    body: "Decide the rhythm first — for most people two to three posts a week. Put empty slots on specific days before writing anything; a slot with no idea yet is still a plan, an idea with no slot is still a wish.",
  },
  {
    title: "Name the topic in one line",
    body: "Write each topic as a claim you could defend ('why we stopped tracking X'), not a category ('thought leadership'). One line forces the post to be about one thing.",
  },
  {
    title: "Pick the format that fits the idea",
    body: "Text for arguments and stories, documents for step-by-step teaching, polls when you genuinely want the audience's answer. Format follows content — never the reverse.",
  },
  {
    title: "Move statuses honestly",
    body: "Idea → Drafting → Ready to schedule → Scheduled → Published. If a row sits in Idea for three weeks, delete it: stale ideas clog the calendar and quietly lower your bar.",
  },
  {
    title: "Review the week, not the row",
    body: "In your weekly drafting session, scan the whole week for gaps and topic balance. Two rants and zero lessons is a calendar problem — visible only when you look at the grid.",
  },
];

export default function CalendarTemplatePage() {
  return (
    <>
      <JsonLd data={structuredData} />

      <PageHero
        eyebrow="Free resource · no signup"
        title={
          <>
            A LinkedIn content calendar you can{" "}
            <span className="text-brand-600">actually keep</span>
          </>
        }
        description="Plan a week or a month on the interactive planner, then take it with you: the CSV template downloads instantly, no email gate. Your plan stays in your browser — nothing is uploaded."
        secondaryCta={{ label: "The full calendar system", href: "/blog/how-to-build-linkedin-content-calendar" }}
        footnote="CSV works in Excel, Google Sheets and Numbers."
      />

      <section aria-label="Interactive content calendar planner" className="bg-slate-50/70 py-16 lg:py-20">
        <Container>
          <Reveal>
            <CalendarPlanner />
          </Reveal>

          <Reveal delay={80}>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <a
                href={CSV_HREF}
                download
                className="group flex items-start gap-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200 shadow-xs transition hover:shadow-soft"
              >
                <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white">
                  <Download className="size-5" />
                </span>
                <span>
                  <span className="block text-[15px] font-semibold text-brand-950 group-hover:text-brand-700">
                    Download the CSV template
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-slate-600">
                    Publishing date, content topic, post format, status and notes — pre-filled with a
                    realistic example month you can overwrite.
                  </span>
                </span>
              </a>
              <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
                <p className="text-[15px] font-semibold text-slate-900">The fields, briefly</p>
                <dl className="mt-2 space-y-1.5 text-sm leading-6 text-slate-600">
                  <div>
                    <dt className="inline font-medium text-slate-800">Publishing date — </dt>
                    <dd className="inline">the day the post goes out, not the day you write it.</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium text-slate-800">Content topic — </dt>
                    <dd className="inline">one claim per line, as specific as a working title.</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium text-slate-800">Post format — </dt>
                    <dd className="inline">text, document carousel, video, poll, article or announcement.</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium text-slate-800">Status — </dt>
                    <dd className="inline">Idea → Drafting → Ready to schedule → Scheduled → Published.</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium text-slate-800">Notes — </dt>
                    <dd className="inline">hook angle, first-comment link, assets, permissions.</dd>
                  </div>
                </dl>
              </div>
            </div>
          </Reveal>
        </Container>
      </section>

      <section aria-labelledby="how-to-use" className="py-16 lg:py-20">
        <Container className="max-w-3xl">
          <Reveal>
            <h2 id="how-to-use" className="text-2xl font-semibold tracking-tight text-slate-950">
              How to use it well
            </h2>
          </Reveal>
          <div className="mt-8 space-y-6">
            {instructions.map((step, i) => (
              <Reveal key={step.title} delay={i * 50}>
                <div className="flex gap-4">
                  <span
                    aria-hidden
                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700 ring-1 ring-brand-100"
                  >
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="text-[15px] font-semibold text-slate-900">{step.title}</h3>
                    <p className="mt-1 text-[15px] leading-7 text-slate-600">{step.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={120}>
            <p className="mt-10 text-[15px] leading-8 text-slate-700">
              The weekly rhythm behind this template is written up in{" "}
              <Link
                href="/blog/linkedin-content-calendar-for-busy-founders"
                className="font-medium text-brand-700 underline decoration-brand-200 underline-offset-4 hover:text-brand-800"
              >
                a content calendar for founders who have no time
              </Link>
              , and the deeper system — pillars, batching, review loops — in{" "}
              <Link
                href="/blog/how-to-build-linkedin-content-calendar"
                className="font-medium text-brand-700 underline decoration-brand-200 underline-offset-4 hover:text-brand-800"
              >
                how to build a LinkedIn content calendar
              </Link>
              . When the plan is real and you want publishing to happen without you, that is exactly
              the job{" "}
              <Link
                href="/linkedin-scheduler"
                className="font-medium text-brand-700 underline decoration-brand-200 underline-offset-4 hover:text-brand-800"
              >
                Zybble&rsquo;s scheduler
              </Link>{" "}
              does.
            </p>
          </Reveal>
        </Container>
      </section>

      <FaqSection items={faqs} description="Practical questions about the template and the planner." />
      <FinalCta />
    </>
  );
}
