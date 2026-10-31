import {
  BarChart3,
  CalendarDays,
  CalendarClock,
  FileText,
  Sparkles,
  Users,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { Container } from "@/components/layout/container";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";

interface Feature {
  icon: ComponentType<{ className?: string }>;
  title: string;
  copy: string;
  wide?: boolean;
  visual?: ReactNode;
}

const features: Feature[] = [
  {
    icon: CalendarClock,
    title: "A queue that publishes for you",
    copy: "Line up a week of LinkedIn posts in one sitting. Zybble publishes each one at the time you picked — no reminders, no copy-pasting at 9 AM.",
    wide: true,
    visual: (
      <div className="mt-6 flex flex-wrap gap-2" aria-hidden>
        {["Mon 9:15", "Tue 9:30", "Wed 12:00", "Thu 9:30", "Fri 8:45"].map((slot, i) => (
          <span
            key={slot}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium ring-1",
              i === 1
                ? "bg-brand-600 text-white ring-brand-600"
                : "bg-white text-slate-600 ring-slate-200",
            )}
          >
            {slot}
          </span>
        ))}
      </div>
    ),
  },
  {
    icon: CalendarDays,
    title: "A calendar you can actually read",
    copy: "See drafts, scheduled slots and published posts on one clean calendar. Drag a draft onto a day and it becomes a plan.",
  },
  {
    icon: FileText,
    title: "Unlimited drafts, on every plan",
    copy: "Capture ideas the moment they arrive. Drafts stay private and never count against your schedule — free plan included.",
  },
  {
    icon: BarChart3,
    title: "Analytics that respect your time",
    copy: "Impressions, engagement and follower movement per post — read at a glance, export when you need the numbers elsewhere.",
    wide: true,
    visual: (
      <div className="mt-6 flex h-16 items-end gap-1.5" aria-hidden>
        {[38, 55, 42, 70, 62, 88, 76, 95].map((h, i) => (
          <span
            key={i}
            style={{ height: `${h}%` }}
            className={cn(
              "w-full rounded-t-sm",
              i === 7 ? "bg-brand-500" : i >= 5 ? "bg-brand-200" : "bg-slate-200",
            )}
          />
        ))}
      </div>
    ),
  },
  {
    icon: Sparkles,
    title: "Best time to post, not guessed",
    copy: "On Pro, Zybble studies when your audience actually responds and suggests the slots most likely to land.",
  },
  {
    icon: Users,
    title: "Built for small teams",
    copy: "Bring up to five LinkedIn accounts into one Pro workspace. Founders, consultants and ghostwriters stay in sync.",
  },
];

export function FeatureBento() {
  return (
    <section id="features" aria-labelledby="features-heading" className="py-24 lg:py-32">
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow="Core features"
            title="Everything LinkedIn growth needs. Nothing it doesn't."
            description="Zybble deliberately does one job. Every screen exists to help you publish consistently and learn from the results."
          />
        </Reveal>

        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <Reveal key={feature.title} delay={(i % 3) * 80} className={cn(feature.wide && "lg:col-span-2")}>
              <article className="group flex h-full flex-col rounded-2xl bg-white p-7 ring-1 ring-slate-200 shadow-xs transition-shadow duration-300 hover:shadow-soft">
                <div className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100 transition-colors group-hover:bg-brand-600 group-hover:text-white">
                  <feature.icon className="size-5" aria-hidden />
                </div>
                <h3 className="mt-5 text-lg font-semibold tracking-tight text-slate-900">
                  {feature.title}
                </h3>
                <p className="mt-2 text-[15px] leading-7 text-slate-600">{feature.copy}</p>
                {feature.visual}
              </article>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
