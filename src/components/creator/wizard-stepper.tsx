"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, Lock } from "lucide-react";
import { LocalizedText } from "@/components/providers/localized-text";
import { cn } from "@/lib/utils";

export interface StepperStep {
  title: string;
  /** True only when the step reflects real, saved server state. */
  done: boolean;
  /** Destination for the step. Locked steps keep `href` unset or ignore it. */
  href?: string | null;
  /** A locked step is not open yet — its record has not been created. */
  locked?: boolean;
  /** Why the step is locked, announced to assistive tech and shown on hover. */
  lockedReason?: string;
  /** Short explanation of what the step covers (shown in the compact view). */
  description?: string;
}

function isCurrentPath(pathname: string, href: string): boolean {
  return pathname === href || pathname === `${href}/`;
}

/**
 * Guided-workflow progress, rendered from real state: a completed step means
 * the corresponding record actually exists on the server.
 *
 * Desktop gets the full step navigation (accessible links, `aria-current` on
 * the active step, locked steps clearly marked); mobile gets a compact
 * progress line instead of a cramped row of chips. The same component powers
 * creator onboarding (plain steps, no links) and the course wizard.
 */
export function WizardStepper({ steps }: { steps: StepperStep[] }) {
  const pathname = usePathname();
  const activeIndex = steps.findIndex((step) => step.href && !step.locked && isCurrentPath(pathname, step.href));
  const completed = steps.filter((step) => step.done).length;
  const percent = steps.length === 0 ? 0 : Math.round((completed / steps.length) * 100);
  const activeStep = activeIndex >= 0 ? steps[activeIndex] : null;

  return (
    <nav
      aria-label="Wizard progress"
      className="rounded-2xl border border-border bg-white p-4 shadow-card sm:p-5"
    >
      {/* Compact indicator for small screens. */}
      <div className="lg:hidden">
        <p className="text-[12.5px] font-medium text-muted-foreground">
          {activeStep ? (
            <>
              Step {activeIndex + 1} of {steps.length}:{" "}
              <span className="text-foreground"><LocalizedText text={activeStep.title} /></span>
            </>
          ) : (
            <>
              {completed} of {steps.length} steps complete
            </>
          )}
        </p>
        {activeStep?.description ? (
          <p className="mt-1 text-[11.5px] text-zinc-400">{activeStep.description}</p>
        ) : null}
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={completed}
          aria-label="Steps completed"
        >
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
        </div>
      </div>

      {/* Full step navigation on desktop. */}
      <ol className="hidden flex-wrap items-center gap-2 lg:flex">
        {steps.map((step, index) => {
          const isActive = index === activeIndex;
          const interactive = Boolean(step.href) && !step.locked;
          const content = (
            <>
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full text-[10.5px] font-semibold",
                  step.done
                    ? "bg-emerald-500 text-white"
                    : isActive
                      ? "bg-primary text-primary-foreground"
                      : step.locked
                        ? "bg-zinc-100 text-zinc-400"
                        : "bg-zinc-100 text-zinc-500"
                )}
                aria-hidden
              >
                {step.done ? (
                  <Check className="size-3" strokeWidth={3.5} />
                ) : step.locked ? (
                  <Lock className="size-3" />
                ) : (
                  index + 1
                )}
              </span>
              <span className="min-w-0 truncate"><LocalizedText text={step.title} /></span>
              {step.locked ? (
                <span className="sr-only">{step.lockedReason ?? "Locked until the course is saved"}</span>
              ) : null}
            </>
          );

          return (
            <li key={step.title} className="flex items-center gap-2">
              {interactive && step.href ? (
                <Link
                  href={step.href}
                  aria-current={isActive ? "step" : undefined}
                  title={step.title}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[12.5px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
                    step.done
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-300"
                      : isActive
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border bg-white text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                >
                  {content}
                </Link>
              ) : (
                <span
                  aria-disabled={step.locked ? "true" : undefined}
                  title={step.locked ? (step.lockedReason ?? "Locked until the course is saved") : step.title}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[12.5px] font-medium",
                    step.done
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : isActive
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : step.locked
                          ? "border-dashed border-zinc-200 bg-zinc-50/60 text-zinc-400"
                          : "border-border bg-white text-muted-foreground"
                  )}
                >
                  {content}
                </span>
              )}
              {index < steps.length - 1 ? (
                <span className="text-zinc-300" aria-hidden>
                  →
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="mt-4 hidden h-1.5 overflow-hidden rounded-full bg-zinc-100 lg:block">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-2 hidden text-[11.5px] text-zinc-400 lg:block">
        {completed} of {steps.length} steps complete
      </p>
    </nav>
  );
}
