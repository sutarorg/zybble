import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import { siteConfig } from "@/lib/site";

export function FinalCta() {
  return (
    <section aria-labelledby="cta-heading" className="py-24 lg:py-32">
      <Container>
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-brand-700 px-6 py-16 text-center sm:px-12 sm:py-20 lg:py-24">
            {/* Decorative grid + glow */}
            <div aria-hidden className="absolute inset-0">
              <div className="absolute inset-0 bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900" />
              <div className="absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255/0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.06)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_60%_80%_at_50%_50%,black,transparent)]" />
            </div>

            <div className="relative">
              <h2
                id="cta-heading"
                className="mx-auto max-w-2xl text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl"
              >
                Your next LinkedIn post is already written. Schedule it.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-pretty text-lg leading-8 text-brand-100">
                Join the free plan, connect LinkedIn and put your next ten posts
                on the calendar — in under fifteen minutes.
              </p>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button asChild size="lg" variant="inverse">
                  <Link href={siteConfig.links.signup}>
                    Start for Free
                    <ArrowRight aria-hidden />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline-inverse">
                  <Link href={siteConfig.links.pricing}>Compare plans</Link>
                </Button>
              </div>
              <p className="mt-6 text-sm text-brand-200">
                Free plan · No credit card · Cancel anytime
              </p>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
