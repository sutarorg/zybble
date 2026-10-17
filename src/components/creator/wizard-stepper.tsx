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
 * Desktop gets a structured 4-step card grid (accessible links, `aria-current`
 * on the active step, locked steps clearly marked with explanation); mobile gets
 * a compact progress bar and step pills. The same component powers creator
 * onboarding (plain steps, no links) and the course wizard.
 */
export function WizardStepper({ steps }: { steps: StepperStep[] }) {
  const pathname = usePathname();
  const activeIndex = steps.findIndex(
    (step) => step.href && !step.locked && isCurrentPath(pathname, step.href)
  );
  const completed = steps.filter((step) => step.done).length;
  const percent = steps.length === 0 ? 0 : Math.round((completed / steps.length) * 100);
  const activeStep = activeIndex >= 0 ? steps[activeIndex] : null;

  return (
    <nav
      aria-label="Wizard progress"
      className="rounded-2xl border border-border bg-white p-4 shadow-card sm:p-5"
    >
      {/* Top summary row */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {activeStep ? (
            <span className="inline-flex items-center rounded-md bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
              Step {activeIndex + 1} of {steps.length}
            </span>
          ) : null}
          <span className="text-[13px] font-semibold text-foreground">
            {activeStep ? (
              <LocalizedText text={activeStep.title} />
            ) : (
              "Course setup progress"
            )}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[12px] font-medium text-muted-foreground">
            <strong className="font-semibold text-foreground">{completed}</strong> of{" "}
            {steps.length} steps complete
          </span>
          <div
            className="hidden h-1.5 w-28 overflow-hidden rounded-full bg-zinc-100 sm:block"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={steps.length}
            aria-valuenow={completed}
            aria-label="Steps completed"
          >
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Compact indicator for small screens */}
      <div className="lg:hidden">
        {activeStep?.description ? (
          <p className="text-[12px] text-muted-foreground">{activeStep.description}</p>
        ) : null}
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100 sm:hidden"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={completed}
          aria-label="Steps completed"
        >
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
        <ol className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {steps.map((step, index) => {
            const isActive = index === activeIndex;
            const interactive = Boolean(step.href) && !step.locked;
            const pill = (
              <div
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[12px] font-medium transition-colors",
                  isActive
                    ? "border-primary/45 bg-primary/10 text-primary"
                    : step.done
                      ? "border-emerald-200 bg-emerald-50/70 text-emerald-800"
                      : step.locked
                        ? "border-dashed border-zinc-200 bg-zinc-50/60 text-zinc-400"
                        : "border-border bg-white text-muted-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                    step.done
                      ? "bg-emerald-500 text-white"
                      : isActive
                        ? "bg-primary text-primary-foreground"
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
                <span className="min-w-0 truncate">
                  <LocalizedText text={step.title} />
                </span>
              </div>
            );

            return (
              <li key={step.title}>
                {interactive && step.href ? (
                  <Link href={step.href} aria-current={isActive ? "step" : undefined}>
                    {pill}
                  </Link>
                ) : (
                  <div
                    aria-disabled={step.locked ? "true" : undefined}
                    title={step.locked ? (step.lockedReason ?? "Locked until the course is saved") : step.title}
                  >
                    {pill}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {/* Full step navigation on desktop */}
      <ol className="hidden gap-2.5 lg:grid lg:grid-cols-4">
        {steps.map((step, index) => {
          const isActive = index === activeIndex;
          const interactive = Boolean(step.href) && !step.locked;
          const content = (
            <div className="flex items-start gap-2.5">
              <span
                className={cn(
                  "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors",
                  step.done && !isActive
                    ? "bg-emerald-500 text-white"
                    : isActive
                      ? "bg-primary text-primary-foreground"
                      : step.locked
                        ? "bg-zinc-100 text-zinc-400"
                        : "bg-zinc-100 text-zinc-600"
                )}
                aria-hidden
              >
                {step.done && !isActive ? (
                  <Check className="size-3.5" strokeWidth={3} />
                ) : step.locked ? (
                  <Lock className="size-3" />
                ) : (
                  index + 1
                )}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="truncate text-[13px] font-semibold">
                    <LocalizedText text={step.title} />
                  </span>
                  {isActive ? (
                    <span className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                      Current
                    </span>
                  ) : step.done ? (
                    <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                      Done
                    </span>
                  ) : null}
                </div>
                {step.description ? (
                  <p
                    className={cn(
                      "mt-0.5 line-clamp-2 text-[11.5px] leading-snug font-normal",
                      step.locked ? "text-zinc-400" : "text-muted-foreground"
                    )}
                  >
                    {step.locked && step.lockedReason ? step.lockedReason : step.description}
                  </p>
                ) : null}
                {step.locked ? (
                  <span className="sr-only">
                    {step.lockedReason ?? "Locked until the course is saved"}
                  </span>
                ) : null}
              </div>
            </div>
          );

          return (
            <li key={step.title} className="min-w-0">
              {interactive && step.href ? (
                <Link
                  href={step.href}
                  aria-current={isActive ? "step" : undefined}
                  title={step.title}
                  className={cn(
                    "block h-full rounded-xl border p-3 outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring/40",
                    isActive
                      ? "border-primary/45 bg-primary/[0.06] text-foreground shadow-2xs"
                      : step.done
                        ? "border-emerald-200 bg-emerald-50/40 text-foreground hover:border-emerald-300 hover:bg-emerald-50/70"
                        : "border-border bg-white text-foreground hover:bg-muted/50"
                  )}
                >
                  {content}
                </Link>
              ) : (
                <div
                  aria-disabled={step.locked ? "true" : undefined}
                  title={
                    step.locked
                      ? (step.lockedReason ?? "Locked until the course is saved")
                      : step.title
                  }
                  className={cn(
                    "h-full rounded-xl border p-3",
                    step.done
                      ? "border-emerald-200 bg-emerald-50/40 text-emerald-900"
                      : isActive
                        ? "border-primary/45 bg-primary/[0.06] text-foreground"
                        : step.locked
                          ? "border-dashed border-zinc-200 bg-zinc-50/60 text-zinc-400"
                          : "border-border bg-white text-muted-foreground"
                  )}
                >
                  {content}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
