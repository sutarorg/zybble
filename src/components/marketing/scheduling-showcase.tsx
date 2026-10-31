import { Check } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/motion/reveal";
import { CalendarVisual } from "@/components/marketing/visuals/calendar-visual";

export const schedulingPoints = [
  {
    title: "Write once, publish on schedule",
    copy: "Compose in a clean editor, pick a slot, and move on with your day.",
  },
  {
    title: "See the whole week at a glance",
    copy: "Drafts, scheduled and published posts live on one calendar — gaps in your cadence are impossible to miss.",
  },
  {
    title: "Time zones handled quietly",
    copy: "Schedule in your audience's time zone, not yours. Zybble does the conversion so Tuesday 9:30 means their Tuesday 9:30.",
  },
] as const;

export function SchedulingShowcase() {
  return (
    <section aria-labelledby="scheduling-heading" className="py-24 lg:py-32">
      <Container className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
        <Reveal>
          <div>
            <Badge size="md">Scheduling &amp; calendar</Badge>
            <h2
              id="scheduling-heading"
              className="mt-5 text-balance text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl"
            >
              A week&rsquo;s worth of LinkedIn, planned in one sitting
            </h2>
            <p className="mt-4 text-pretty text-lg leading-8 text-slate-600">
              Consistency is the compounding advantage on LinkedIn. Zybble turns
              it from a daily chore into a single weekly habit.
            </p>
            <ul className="mt-8 space-y-5">
              {schedulingPoints.map((point) => (
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
        <Reveal delay={150}>
          <CalendarVisual />
        </Reveal>
      </Container>
    </section>
  );
}
