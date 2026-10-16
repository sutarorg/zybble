"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ArrowRight, Lock } from "lucide-react";
import { LocalizedText } from "@/components/providers/localized-text";
import { WizardStepper } from "@/components/creator/wizard-stepper";
import type { CourseWizardStep } from "@/lib/course-wizard";
import { Button } from "@/components/ui/button";

function isCurrentPath(pathname: string, href: string): boolean {
  return pathname === href || pathname === `${href}/`;
}

/**
 * Shared chrome for the course creation wizard: the step navigation at the top
 * and a Back / Continue footer below the step's content.
 *
 * The active step is derived from the URL — there is no separate wizard state
 * store, so the navigation can never claim a step the page itself is not on.
 * `done` states arrive from the server (real saved records) via the steps prop.
 */
export function CourseWizardFrame({ steps, children }: { steps: CourseWizardStep[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const activeIndex = steps.findIndex((step) => step.href && isCurrentPath(pathname, step.href));

  const previous = activeIndex > 0 ? steps[activeIndex - 1] : null;
  const next = activeIndex >= 0 && activeIndex < steps.length - 1 ? steps[activeIndex + 1] : null;

  const previousHref = previous && !previous.locked ? previous.href : null;
  const nextHref = next && !next.locked ? next.href : null;
  // On the very first step there is no previous wizard step — "Back" returns to
  // the course list the wizard was launched from.
  const backHref = activeIndex === 0 ? "/creator/courses" : previousHref;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <WizardStepper steps={steps} />

      {children}

      <nav
        aria-label="Wizard step navigation"
        className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5"
      >
        {backHref ? (
          <Button asChild variant="ghost">
            <Link
              href={backHref}
              aria-label={activeIndex === 0 ? "Back to My courses" : `Back to ${previous?.title ?? ""}`}
            >
              <ArrowLeft className="size-4" aria-hidden />
              {activeIndex === 0 ? <LocalizedText text="My courses" /> : <LocalizedText text={previous?.title ?? ""} />}
            </Link>
          </Button>
        ) : (
          <span />
        )}

        {next ? (
          nextHref ? (
            <Button asChild variant="outline">
              <Link href={nextHref} aria-label={`Continue to ${next.title}`}>
                <LocalizedText text={next.title} />
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          ) : (
            <p className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
              <Lock className="size-3.5 shrink-0" aria-hidden />
              {next.lockedReason ?? "Save the details first to unlock the next step."}
            </p>
          )
        ) : null}
      </nav>
    </div>
  );
}
