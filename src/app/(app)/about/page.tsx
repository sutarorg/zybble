import { LocalizedText } from "@/components/providers/localized-text";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Award, Hammer, Medal } from "lucide-react";
import { CATEGORIES } from "@/lib/config/catalog";
import { marketplaceStats } from "@/lib/server/catalog";
import { formatCompact } from "@/lib/format";
import { categoryIcon } from "@/lib/icons";
import { InfoPage } from "@/components/layout/info-page";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "About",
  description: "Zybble is India's marketplace for practical AI skills.",
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
    icon: Award,
    title: "Certified at the finish line",
    text: "Complete every lesson of a course and Zybble issues a certificate with your name, the course title and a verification code you can show anyone.",
  },
];

export const dynamic = "force-dynamic";

export default async function AboutPage() {
  const stats = await marketplaceStats();
  const tiles = [
    { label: "Learners enrolled", value: formatCompact(stats.students) },
    { label: "Published courses", value: String(stats.courses) },
    { label: "Creator instructors", value: String(stats.instructors) },
    { label: "Hands-on lessons", value: formatCompact(stats.lessons) },
  ];

  return (
    <InfoPage
      label="About Zybble"
      title="Practical AI skills, taught by the people who use them."
      description="Zybble is an India-only marketplace where builders, creators and operators learn AI the way it should be learned: by doing."
    >
      {/* Stats band */}
      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-xl border border-border bg-muted/50 p-5">
            <p className="font-display text-2xl font-bold tracking-tight sm:text-3xl"><LocalizedText text={tile.value} /></p>
            <p className="mt-1 text-[12.5px] text-muted-foreground"><LocalizedText text={tile.label} /></p>
          </div>
        ))}
      </div>

      {/* Story */}
      <section className="mt-14 max-w-3xl">
        <h2 className="font-display text-xl font-semibold tracking-tight"><LocalizedText text={"Why we exist"} /></h2>
        <div className="mt-4 space-y-4 text-[14.5px] leading-relaxed text-muted-foreground">
          <p><LocalizedText text={"AI moved faster than education. By the time a textbook ships, the tools have changed three times — and the people who actually understand the new workflows are too busy using them to write one."} /></p>
          <p><LocalizedText text={"Zybble connects those practitioners directly with learners. Courses are short on theory and long on practice, priced in Indian Rupees, and paid through Razorpay. Whether you have a weekend or a year, there is a path here for you."} /></p>
          <p><LocalizedText text={"Every number on this page is counted from the live marketplace database. When a course is published and a learner enrolls, these figures move — and nothing else does."} /></p>
        </div>
      </section>

      {/* Values */}
      <section className="mt-14">
        <h2 className="font-display text-xl font-semibold tracking-tight"><LocalizedText text={"What we believe"} /></h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {VALUES.map((v) => (
            <div key={v.title} className="rounded-xl border border-border bg-white p-6 shadow-card">
              <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-primary">
                <v.icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-4 text-[15px] font-semibold"><LocalizedText text={v.title} /></h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground"><LocalizedText text={v.text} /></p>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="mt-14">
        <h2 className="font-display text-xl font-semibold tracking-tight"><LocalizedText text={"Explore the catalog"} /></h2>
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
                <span className="text-[13.5px] font-medium"><LocalizedText text={category.name} /></span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="mt-14 overflow-hidden rounded-2xl border border-violet-200/70 bg-accent p-8 sm:p-10">
        <h2 className="font-display max-w-lg text-2xl font-bold tracking-tight text-violet-950"><LocalizedText text={"Your AI skill set is one project away."} /></h2>
        <p className="mt-2 max-w-lg text-[14.5px] text-violet-950/60"><LocalizedText text={"Start with a free course today — no card, no commitment, just progress."} /></p>
        <Button asChild size="lg" className="mt-6">
          <Link href="/"><LocalizedText text={"Start exploring"} /><ArrowRight aria-hidden />
          </Link>
        </Button>
      </section>
    </InfoPage>
  );
}
