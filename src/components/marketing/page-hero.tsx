import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

interface PageHeroProps {
  eyebrow: string;
  title: ReactNode;
  description: string;
  visual: ReactNode;
  reversed?: boolean;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  footnote?: string;
}

/** Shared two-column hero for the product landing pages. */
export function PageHero({
  eyebrow,
  title,
  description,
  visual,
  reversed = false,
  primaryCta = { label: "Start for Free", href: siteConfig.links.signup },
  secondaryCta,
  footnote,
}: PageHeroProps) {
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-50/70 via-white to-white" />
        <div className="bg-grid-blue absolute inset-x-0 top-0 h-[420px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]" />
      </div>

      <Container className="grid items-center gap-14 py-16 sm:py-20 lg:grid-cols-2 lg:gap-16 lg:py-24">
        <div className={cn(reversed && "lg:order-last")}>
          <Reveal>
            <Badge size="md">{eyebrow}</Badge>
            <h1 className="mt-5 text-balance text-4xl font-semibold leading-[1.1] tracking-tight text-slate-950 sm:text-5xl">
              {title}
            </h1>
            <p className="mt-5 max-w-xl text-pretty text-lg leading-8 text-slate-600">
              {description}
            </p>
          </Reveal>
          <Reveal delay={120}>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button asChild size="lg">
                <Link href={primaryCta.href}>
                  {primaryCta.label}
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
              {secondaryCta && (
                <Button asChild variant="secondary" size="lg">
                  <Link href={secondaryCta.href}>{secondaryCta.label}</Link>
                </Button>
              )}
            </div>
            {footnote && <p className="mt-4 text-[13px] text-slate-500">{footnote}</p>}
          </Reveal>
        </div>
        <Reveal delay={200} className={cn(reversed && "lg:order-first")}>
          {visual}
        </Reveal>
      </Container>
    </section>
  );
}
