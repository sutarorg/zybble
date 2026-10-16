"use client";

import Link from "next/link";
import { Check, ChevronRight, LockKeyhole } from "lucide-react";
import { cn } from "@/lib/utils";

export type CourseCreationStepId = "details" | "curriculum" | "assets" | "review";

const STEPS: Array<{
  id: CourseCreationStepId;
  title: string;
  description: string;
}> = [
  { id: "details", title: "Details & pricing", description: "The course listing" },
  { id: "curriculum", title: "Curriculum", description: "Sections and lessons" },
  { id: "assets", title: "Thumbnail & files", description: "Course image and downloads" },
  { id: "review", title: "Review & submit", description: "Final checks" },
];

export function CourseCreationWizard({
  activeStep,
  courseId,
  completed,
}: {
  activeStep: CourseCreationStepId;
  courseId?: string;
  completed: Partial<Record<CourseCreationStepId, boolean>>;
}) {
  const activeIndex = Math.max(0, STEPS.findIndex((step) => step.id === activeStep));
  const progress = ((activeIndex + 1) / STEPS.length) * 100;

  function hrefFor(step: CourseCreationStepId): string {
    if (step === "details") {
      return courseId ? `/creator/courses/${courseId}/edit` : "/creator/courses/new";
    }
    if (!courseId) return "/creator/courses/new";
    if (step === "curriculum") return `/creator/courses/${courseId}/curriculum`;
    if (step === "assets") return `/creator/courses/${courseId}/content`;
    return `/creator/courses/${courseId}/publish`;
  }

  return (
    <section
      aria-label="Course creation progress"
      className="rounded-xl border border-border bg-white p-4 shadow-card sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-primary">Course setup</p>
          <h2 className="mt-1 font-display text-[16px] font-semibold tracking-tight">Build your course, step by step</h2>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Your course stays a draft until you submit it for review.
          </p>
        </div>
        <span className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[11.5px] font-medium text-muted-foreground">
          Step {activeIndex + 1} of {STEPS.length}
        </span>
      </div>

      <div
        className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="Course setup steps"
        aria-valuemin={1}
        aria-valuemax={STEPS.length}
        aria-valuenow={activeIndex + 1}
      >
        <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${progress}%` }} />
      </div>

      <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STEPS.map((step, index) => {
          const isActive = step.id === activeStep;
          const isDone = Boolean(completed[step.id]);
          const isLocked = !courseId && index > 0;
          const itemClass = cn(
            "flex min-h-[66px] items-start gap-2.5 rounded-lg border px-2.5 py-3 text-left transition-colors sm:px-3",
            isActive
              ? "border-primary/40 bg-accent/70 ring-1 ring-primary/10"
              : isDone
                ? "border-emerald-200 bg-emerald-50/60 hover:bg-emerald-50"
                : isLocked
                  ? "cursor-not-allowed border-border bg-muted/30 text-muted-foreground/70"
                  : "border-border bg-white hover:border-primary/30 hover:bg-muted/30"
          );
          const markerClass = cn(
            "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
            isDone
              ? "border-emerald-600 bg-emerald-600 text-white"
              : isActive
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-white text-muted-foreground"
          );
          const inner = (
            <>
              <span className={markerClass} aria-hidden="true">
                {isDone ? <Check className="size-3.5" strokeWidth={3} /> : isLocked ? <LockKeyhole className="size-3" /> : index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block text-[12px] font-semibold leading-4", isActive && "text-primary")}>{step.title}</span>
                <span className="mt-1 hidden text-[10.5px] leading-4 text-muted-foreground sm:block">{step.description}</span>
                {isDone ? <span className="mt-1 block text-[10px] font-medium text-emerald-700">Complete</span> : null}
              </span>
              {!isActive && !isLocked ? <ChevronRight className="mt-1 size-3.5 shrink-0 text-zinc-400" aria-hidden="true" /> : null}
            </>
          );

          return (
            <li key={step.id}>
              {isLocked ? (
                <div className={itemClass} aria-disabled="true" title="Save the course details first">
                  {inner}
                </div>
              ) : (
                <Link
                  href={hrefFor(step.id)}
                  aria-current={isActive ? "step" : undefined}
                  className={cn(itemClass, "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40")}
                >
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ol>

      <p className="mt-3 text-[11px] leading-4 text-muted-foreground">
        Save details before moving on. Video lessons must finish processing, and a thumbnail is required before submission.
      </p>
    </section>
  );
}
