"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Bot, CreditCard, GraduationCap, MessageSquare, Search, SearchX, Settings } from "lucide-react";
import { InfoPage } from "@/components/layout/info-page";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Faq {
  q: string;
  a: string;
  group: string;
}

const FAQ_GROUPS = [
  { id: "courses", label: "Courses & learning", icon: GraduationCap },
  { id: "billing", label: "Billing & refunds", icon: CreditCard },
  { id: "tutor", label: "AI Tutor", icon: Bot },
  { id: "account", label: "Account", icon: Settings },
];

const FAQS: Faq[] = [
  { group: "courses", q: "How do Zybble courses work?", a: "Courses are self-paced and project-based. You get lifetime access to all video lessons, downloadable resources, quizzes and — on eligible courses — the AI Tutor. Progress syncs on your device in this demo." },
  { group: "courses", q: "Do I get a certificate?", a: "Yes. Completing a course unlocks a certificate with total hours, completion date and a shareable verification link. (Certificate generation is illustrative in this demo.)" },
  { group: "courses", q: "Are courses updated?", a: "Continuously. AI tools change fast, so instructors refresh lessons monthly. The 'last updated' date on every course page shows the latest revision." },
  { group: "courses", q: "Can I download lessons for offline viewing?", a: "Lessons marked with a download icon include offline resources like templates, checklists and code. Video downloads depend on each instructor's settings." },
  { group: "billing", q: "What payment methods do you accept?", a: "In this demo, checkout is fully simulated — no real payment is processed. The production platform would support major cards, PayPal and regional methods." },
  { group: "billing", q: "How does the 30-day guarantee work?", a: "If a course isn't right for you, request a refund within 30 days of purchase for a full, no-questions-asked refund. See the Refund Policy for details." },
  { group: "billing", q: "Why did my payment fail?", a: "In the demo, the test card 4000 0000 0000 0002 always simulates a decline so you can preview the failure flow. Any other formatted card number succeeds." },
  { group: "tutor", q: "What is the AI Tutor?", a: "A personal tutor that knows the exact curriculum of your course. Ask 'why does this code fail?' or 'explain lesson 3.2 differently' and it answers in context, instantly, in 30+ languages." },
  { group: "tutor", q: "Which courses include the AI Tutor?", a: "Every course card and page shows an 'AI Tutor' badge when included. You can also filter by it in Explore. Try it free in Prompt Engineering Foundations." },
  { group: "tutor", q: "Does the AI Tutor replace instructors?", a: "No — it handles instant questions and practice, while instructors lead course Q&A, live sessions and curriculum updates. Think of it as a TA who never sleeps." },
  { group: "account", q: "Where is my data stored?", a: "In this frontend demo, everything (sign-in, wishlist, enrollments, progress) lives in your browser's localStorage. Clearing site data resets the demo." },
  { group: "account", q: "How do I change the interface language?", a: "Use the globe icon in the header. Your preference is saved on this device. Course captions are listed on each course page." },
];

export function HelpClient() {
  const [query, setQuery] = useState("");
  const trimmed = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!trimmed) return FAQS;
    return FAQS.filter(
      (f) => f.q.toLowerCase().includes(trimmed) || f.a.toLowerCase().includes(trimmed)
    );
  }, [trimmed]);

  return (
    <InfoPage
      label="Help Center"
      title="How can we help?"
      description="Search common questions about courses, billing, certificates and your AI Tutor."
    >
      {/* Search */}
      <div className="relative mt-8 max-w-xl">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4.5 -translate-y-1/2 text-zinc-400" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search help articles…"
          aria-label="Search help articles"
          className="h-12 w-full rounded-xl border border-input bg-white pr-4 pl-11 text-[14.5px] shadow-card outline-none placeholder:text-zinc-400 focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/20 [&::-webkit-search-cancel-button]:hidden"
        />
      </div>

      {/* AI Tutor anchor (linked from sidebar/banner) */}
      <section id="ai-tutor" className="mt-10 scroll-mt-24 rounded-2xl border border-violet-200/70 bg-accent p-6 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-md shadow-violet-600/20">
            <Bot className="size-6" aria-hidden />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight text-violet-950">
              The Zybble AI Tutor
            </h2>
            <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-violet-950/60">
              A context-aware tutor included with eligible courses. It knows every lesson, quiz and
              resource — ask questions, request examples, or practice with it any time.
            </p>
          </div>
          <Button asChild className="sm:ml-auto" variant="outline" >
            <Link href="/courses/prompt-engineering-foundations">Try it in a free course</Link>
          </Button>
        </div>
        <ul className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            { title: "Answers in context", text: "Responses reference the exact lesson you're on." },
            { title: "Practice mode", text: "It quizzes you and explains what you missed." },
            { title: "30+ languages", text: "Learn in the language you think in." },
          ].map((f) => (
            <li key={f.title} className="rounded-xl border border-violet-200/70 bg-white/80 p-4">
              <p className="text-[13.5px] font-semibold">{f.title}</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{f.text}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* FAQs */}
      <div className="mt-12 max-w-3xl">
        {trimmed && (
          <p className="mb-4 text-[13.5px] text-muted-foreground">
            <span className="font-semibold text-foreground">{filtered.length}</span>{" "}
            {filtered.length === 1 ? "answer" : "answers"} for “{query.trim()}”
          </p>
        )}
        {filtered.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No answers found"
            description="Try different wording — or message us and a human will help."
            action={
              <Button variant="outline" onClick={() => setQuery("")}>
                Clear search
              </Button>
            }
          />
        ) : (
          FAQ_GROUPS.map((group) => {
            const faqs = filtered.filter((f) => f.group === group.id);
            if (faqs.length === 0) return null;
            return (
              <section key={group.id} className="mb-8">
                <h2 className="mb-3 flex items-center gap-2 text-[14px] font-semibold">
                  <group.icon className="size-4 text-primary" aria-hidden />
                  {group.label}
                </h2>
                <div className="rounded-xl border border-border bg-white px-5">
                  <Accordion type="single" collapsible>
                    {faqs.map((faq) => (
                      <AccordionItem key={faq.q} value={faq.q}>
                        <AccordionTrigger className="text-[14px]">{faq.q}</AccordionTrigger>
                        <AccordionContent className="text-[13.5px] leading-relaxed text-muted-foreground">
                          {faq.a}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              </section>
            );
          })
        )}
      </div>

      {/* Contact */}
      <section
        className={cn(
          "mt-12 flex max-w-3xl flex-col items-start gap-4 rounded-2xl border border-border bg-muted/50 p-6 sm:flex-row sm:items-center"
        )}
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white text-primary shadow-card">
          <MessageSquare className="size-5" aria-hidden />
        </span>
        <div className="flex-1">
          <h2 className="font-display text-[15.5px] font-semibold">Still stuck?</h2>
          <p className="mt-0.5 text-[13.5px] text-muted-foreground">
            Message our support team — we usually reply within minutes during the day.
          </p>
        </div>
        <Button asChild>
          <Link href="/messages">Message support</Link>
        </Button>
      </section>
    </InfoPage>
  );
}
