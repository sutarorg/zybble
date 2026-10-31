"use client";

import { Container } from "@/components/layout/container";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Reveal } from "@/components/motion/reveal";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export interface FaqItem {
  question: string;
  answer: string;
}

interface FaqSectionProps {
  eyebrow?: string;
  title?: string;
  description?: string;
  items: FaqItem[];
}

export function FaqSection({
  eyebrow = "FAQ",
  title = "Questions, answered plainly",
  description,
  items,
}: FaqSectionProps) {
  return (
    <section aria-labelledby="faq-heading" className="py-24 lg:py-32">
      <Container className="grid gap-12 lg:grid-cols-12 lg:gap-8">
        <Reveal className="lg:col-span-5">
          <SectionHeading
            eyebrow={eyebrow}
            title={<span id="faq-heading">{title}</span>}
            description={description}
            align="left"
            className="lg:sticky lg:top-28"
          />
        </Reveal>
        <Reveal delay={120} className="lg:col-span-7">
          <Accordion type="single" collapsible className="border-t border-slate-200">
            {items.map((item, i) => (
              <AccordionItem key={item.question} value={`item-${i}`}>
                <AccordionTrigger>{item.question}</AccordionTrigger>
                <AccordionContent>{item.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </Container>
    </section>
  );
}
