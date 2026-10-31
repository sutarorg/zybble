import { Check } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/motion/reveal";
import { AnalyticsVisual } from "@/components/marketing/visuals/analytics-visual";

export const analyticsPoints = [
  {
    title: "Per-post performance",
    copy: "Impressions, reactions, comments and reposts side by side, so you know exactly which ideas landed.",
  },
  {
    title: "Twelve months of history on Pro",
    copy: "Free keeps the last 7 days. Pro extends your window to a full year — long enough to see real trends, not noise.",
  },
  {
    title: "Signals, not vanity",
    copy: "Zybble highlights engagement rate and saves alongside reach, so you optimise for conversations, not applause.",
  },
] as const;

export function AnalyticsShowcase() {
  return (
    <section
      aria-labelledby="analytics-heading"
      className="border-y border-slate-200 bg-slate-50/70 py-24 lg:py-32"
    >
      <Container className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
        <Reveal className="order-last lg:order-first">
          <AnalyticsVisual />
        </Reveal>
        <Reveal delay={150}>
          <div>
            <Badge size="md">Analytics &amp; insights</Badge>
            <h2
              id="analytics-heading"
              className="mt-5 text-balance text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl"
            >
              Know what worked — and what to write next
            </h2>
            <p className="mt-4 text-pretty text-lg leading-8 text-slate-600">
              Every scheduled post feeds your analytics automatically. No
              spreadsheets, no manual tracking, no guessing.
            </p>
            <ul className="mt-8 space-y-5">
              {analyticsPoints.map((point) => (
                <li key={point.title} className="flex gap-3.5">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 ring-1 ring-brand-100">
                    <Check className="size-3.5" aria-hidden />
                  </span>
                  <div>
                    <h3 className="text-[15px] font-semibold text-slate-900">{point.title}</h3>
                    <p className="mt-1 text-[15px] leading-7 text-slate-600">{point.copy}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
