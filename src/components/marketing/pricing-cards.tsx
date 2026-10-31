import { Check } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/container";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Reveal } from "@/components/motion/reveal";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

export const plans = [
  {
    name: "Free",
    price: "$0",
    cadence: "per month",
    blurb: "For building a consistent LinkedIn habit.",
    cta: "Start for Free",
    href: siteConfig.links.signup,
    prominent: false,
    features: [
      "1 LinkedIn account",
      "10 scheduled posts per month",
      "Unlimited drafts",
      "7-day basic analytics",
      "Content calendar",
    ],
  },
  {
    name: "Pro",
    price: "$15",
    cadence: "per seat / month",
    blurb: "For creators and small teams publishing seriously.",
    cta: "Get Started with Pro",
    href: `${siteConfig.links.signup}?plan=pro`,
    prominent: true,
    features: [
      "Up to 5 LinkedIn accounts per workspace",
      "Unlimited scheduled posts",
      "12-month advanced analytics",
      "Best-time-to-post insights",
      "Team collaboration",
    ],
  },
] as const;

export function PlanCards() {
  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
      {plans.map((plan, i) => (
        <Reveal key={plan.name} delay={i * 120}>
          <article
            className={cn(
              "relative flex h-full flex-col rounded-2xl bg-white p-8",
              plan.prominent
                ? "shadow-panel ring-2 ring-brand-600"
                : "shadow-xs ring-1 ring-slate-200",
            )}
          >
            {plan.prominent && (
              <Badge
                variant="brand-solid"
                className="absolute -top-3 left-8 shadow-xs"
                size="md"
              >
                Most popular
              </Badge>
            )}
            <div className="flex items-baseline justify-between">
              <h3 className="text-lg font-semibold tracking-tight text-slate-900">
                {plan.name}
              </h3>
            </div>
            <p className="mt-4 flex items-baseline gap-2">
              <span className="text-[44px] font-semibold leading-none tracking-tight text-slate-950">
                {plan.price}
              </span>
              <span className="text-sm text-slate-500">{plan.cadence}</span>
            </p>
            <p className="mt-3 text-[15px] leading-7 text-slate-600">{plan.blurb}</p>

            <ul className="mt-7 space-y-3.5 border-t border-slate-100 pt-7">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <span
                    className={cn(
                      "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                      plan.prominent
                        ? "bg-brand-600 text-white"
                        : "bg-brand-50 text-brand-600 ring-1 ring-brand-100",
                    )}
                  >
                    <Check className="size-3" aria-hidden />
                  </span>
                  <span className="text-[15px] leading-6 text-slate-700">{feature}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex-1" />
            <Button
              asChild
              size="lg"
              variant={plan.prominent ? "primary" : "secondary"}
              className="w-full"
            >
              <Link href={plan.href}>{plan.cta}</Link>
            </Button>
          </article>
        </Reveal>
      ))}
    </div>
  );
}

/** Homepage pricing teaser. */
export function PricingSection() {
  return (
    <section id="pricing" aria-labelledby="pricing-heading" className="py-24 lg:py-32">
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow="Pricing"
            title="Start free. Upgrade when consistency pays off."
            description="Two plans, no tiers to decode, no credit card to begin. Pro is $15 per seat per month — cancel anytime."
          />
        </Reveal>
        <div className="mx-auto mt-16 max-w-4xl">
          <PlanCards />
        </div>
      </Container>
    </section>
  );
}
