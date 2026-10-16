"use client";

import { LocalizedText, useTranslate } from "@/components/providers/localized-text";
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
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "account", label: "Account", icon: Settings },
];

const FAQS: Faq[] = [
  { group: "courses", q: "How do Zybble courses work?", a: "Courses are self-paced. You get access to every video lesson, downloadable resource and quiz that the creator published. Your progress is stored on your Zybble account, so it follows you between devices." },
  { group: "courses", q: "Do I get a certificate?", a: "When you complete every lesson of a course, Zybble issues a certificate with the course title, your name and a verification code. You can view it any time from Certificates." },
  { group: "courses", q: "Can I try a course before buying it?", a: "Creators can mark lessons as free previews. You can watch those without buying the course." },
  { group: "courses", q: "Where is my data stored?", a: "In your Zybble account, which is backed by PostgreSQL with row-level security. Your progress, orders and certificates are tied to your verified account, not to a single browser." },
  { group: "billing", q: "What payment methods do you accept?", a: "Razorpay Checkout, which supports UPI, cards and netbanking for Indian customers. Zybble is an India-only marketplace and prices everything in Indian Rupees." },
  { group: "billing", q: "Who receives the money?", a: "When you buy a paid course, Razorpay Checkout collects your INR payment into Zybble's merchant account. Zybble records the marketplace commission and credits the creator's net share on the ledger, and pays out creators in INR to their saved UPI ID or Indian bank account." },
  { group: "account", q: "Where do I find my certificates?", a: "Open Certificates in the sidebar. Each certificate carries a verification code." },
  { group: "account", q: "How do I change the interface language?", a: "Use the globe icon in the header. Zybble supports English, Spanish, Portuguese, French, German and Japanese. Prices always stay in rupees." },
  { group: "account", q: "How do I become a creator?", a: "Open Creator Studio from the sidebar and complete the profile step. You keep your learner account, purchases and progress." },
];

export function HelpClient() {
  const translateUi = useTranslate();
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
      label={translateUi("Help Center")}
      title={translateUi("How can we help?")}
      description={translateUi("Search common questions about courses, billing, certificates and your account.")}
    >
      {/* Search */}
      <div className="relative mt-8 max-w-xl">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4.5 -translate-y-1/2 text-zinc-400" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={translateUi("Search help articles…")}
          aria-label={translateUi("Search help articles")}
          className="h-12 w-full rounded-xl border border-input bg-white pr-4 pl-11 text-[14.5px] shadow-card outline-none placeholder:text-zinc-400 focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/20 [&::-webkit-search-cancel-button]:hidden"
        />
      </div>

      {/* FAQs */}
      <div className="mt-12 max-w-3xl">
        {trimmed && (
          <p className="mb-4 text-[13.5px] text-muted-foreground">
            <span className="font-semibold text-foreground">{filtered.length}</span><LocalizedText text={" "} />
            {filtered.length === 1 ? "answer" : "answers"}<LocalizedText text={"for “"} /><LocalizedText text={query.trim()} />”
          </p>
        )}
        {filtered.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title={translateUi("No answers found")}
            description={translateUi("Try different wording — or message us and a human will help.")}
            action={
              <Button variant="outline" onClick={() => setQuery("")}><LocalizedText text={"Clear search"} /></Button>
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
                  <LocalizedText text={group.label} />
                </h2>
                <div className="rounded-xl border border-border bg-white px-5">
                  <Accordion type="single" collapsible>
                    {faqs.map((faq) => (
                      <AccordionItem key={faq.q} value={faq.q}>
                        <AccordionTrigger className="text-[14px]"><LocalizedText text={faq.q} /></AccordionTrigger>
                        <AccordionContent className="text-[13.5px] leading-relaxed text-muted-foreground">
                          <LocalizedText text={faq.a} />
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
          <h2 className="font-display text-[15.5px] font-semibold"><LocalizedText text={"Still stuck?"} /></h2>
          <p className="mt-0.5 text-[13.5px] text-muted-foreground"><LocalizedText text={"Message our support team — we usually reply within minutes during the day."} /></p>
        </div>
        <Button asChild>
          <Link href="/messages"><LocalizedText text={"Message support"} /></Link>
        </Button>
      </section>
    </InfoPage>
  );
}
