import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bot, Hammer, Medal } from "lucide-react";
import { CATEGORIES } from "@/data/mock-data";
import { marketplaceStats } from "@/lib/courses";
import { formatCompact } from "@/lib/format";
import { categoryIcon } from "@/lib/icons";
import { InfoPage } from "@/components/layout/info-page";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "About",
  description: "Zybble is the global marketplace for practical AI skills.",
};

const VALUES = [
  {
    icon: Hammer,
    title: "Learn by shipping",
    text: "Every Zybble course is built around projects. You don't finish with notes — you finish with working automations, apps and systems you actually use.",
  },
  {
    icon: Medal,
    title: "Taught by practitioners",
    text: "Our instructors ship for a living: founders, engineers, filmmakers and operators. Courses show real workflows, real numbers and honest trade-offs.",
  },
  {
    icon: Bot,
    title: "Assisted by AI",
    text: "Every eligible course includes an AI Tutor trained on the curriculum. It answers questions, reviews your work and keeps you unstuck, 24/7.",
  },
];

export default function AboutPage() {
  const stats = marketplaceStats();
  const tiles = [
    { label: "Learners worldwide", value: formatCompact(stats.students) },
    { label: "Expert-led courses", value: String(stats.courses) },
    { label: "Practitioner instructors", value: String(stats.instructors) },
    { label: "Hands-on lessons", value: formatCompact(stats.lessons) },
  ];

  return (
    <InfoPage
      label="About Zybble"
      title="Practical AI skills, taught by the people who use them."
      description="Zybble is a global marketplace where builders, creators and operators learn AI the way it should be learned: by doing."
    >
      {/* Stats band */}
      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-xl border border-border bg-muted/50 p-5">
            <p className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{tile.value}+</p>
            <p className="mt-1 text-[12.5px] text-muted-foreground">{tile.label}</p>
          </div>
        ))}
      </div>

      {/* Story */}
      <section className="mt-14 max-w-3xl">
        <h2 className="font-display text-xl font-semibold tracking-tight">Why we exist</h2>
        <div className="mt-4 space-y-4 text-[14.5px] leading-relaxed text-muted-foreground">
          <p>
            AI moved faster than education. By the time a textbook ships, the tools have changed
            three times — and the people who actually understand the new workflows are too busy
            using them to write one.
          </p>
          <p>
            Zybble connects those practitioners directly with learners. Courses are short on
            theory and long on practice, updated continuously, and priced accessibly for a global
            audience. Whether you have a weekend or a year, there&apos;s a path here for you.
          </p>
          <p>
            We&apos;re a small, distributed team across six time zones, and every statistic on
            this page is sample data for this frontend demo.
          </p>
        </div>
      </section>

      {/* Values */}
      <section className="mt-14">
        <h2 className="font-display text-xl font-semibold tracking-tight">What we believe</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {VALUES.map((v) => (
            <div key={v.title} className="rounded-xl border border-border bg-white p-6 shadow-card">
              <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-primary">
                <v.icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-4 text-[15px] font-semibold">{v.title}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">{v.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="mt-14">
        <h2 className="font-display text-xl font-semibold tracking-tight">Explore the catalog</h2>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {CATEGORIES.map((category) => {
            const Icon = categoryIcon(category.icon);
            return (
              <Link
                key={category.slug}
                href={`/categories/${category.slug}`}
                className="group flex items-center gap-3 rounded-xl border border-border bg-white p-4 shadow-card transition-all hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-card-hover"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                  <Icon className="size-4.5" aria-hidden />
                </span>
                <span className="text-[13.5px] font-medium">{category.name}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="mt-14 overflow-hidden rounded-2xl border border-violet-200/70 bg-accent p-8 sm:p-10">
        <h2 className="font-display max-w-lg text-2xl font-bold tracking-tight text-violet-950">
          Your AI skill set is one project away.
        </h2>
        <p className="mt-2 max-w-lg text-[14.5px] text-violet-950/60">
          Start with a free course today — no card, no commitment, just progress.
        </p>
        <Button asChild size="lg" className="mt-6">
          <Link href="/explore">
            Start exploring
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </section>
    </InfoPage>
  );
}
