import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { ProductPreview } from "@/components/marketing/product-preview";
import { Reveal } from "@/components/motion/reveal";
import { siteConfig } from "@/lib/site";

export function Hero() {
  return (
    <section aria-labelledby="hero-heading" className="relative overflow-hidden">
      {/* Backdrop: soft brand wash + blueprint grid, masked to the top */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-50/80 via-white to-white" />
        <div className="bg-grid-blue absolute inset-x-0 top-0 h-[540px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]" />
      </div>

      <Container className="grid items-center gap-14 pb-20 pt-16 sm:pt-20 lg:grid-cols-12 lg:gap-10 lg:pb-28 lg:pt-24">
        <div className="lg:col-span-6">
          <Reveal>
            <p className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-[13px] font-medium text-slate-600 ring-1 ring-slate-200 shadow-xs">
              <span className="size-1.5 rounded-full bg-brand-500" aria-hidden />
              LinkedIn scheduling &amp; analytics — nothing else
            </p>
          </Reveal>
          <Reveal delay={80}>
            <h1
              id="hero-heading"
              className="mt-6 text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-slate-950 sm:text-5xl lg:text-[56px]"
            >
              Schedule LinkedIn posts. Track performance.{" "}
              <span className="text-brand-600">Grow smarter.</span>
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mt-6 max-w-xl text-pretty text-lg leading-8 text-slate-600">
              Plan your LinkedIn content, publish at the right time and
              understand what drives engagement — all in one simple workspace.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button asChild size="lg">
                <Link href={siteConfig.links.signup}>
                  Start for Free
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href={siteConfig.links.analytics}>Explore Features</Link>
              </Button>
            </div>
            <p className="mt-4 text-[13px] text-slate-500">
              Free plan · 10 scheduled posts a month · No credit card required
            </p>
          </Reveal>
        </div>

        <Reveal delay={200} className="lg:col-span-6">
          <ProductPreview />
        </Reveal>
      </Container>
    </section>
  );
}
