import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StepperStep {
  title: string;
  done: boolean;
}

/**
 * Horizontal onboarding progress. Renders from real state, so a completed step
 * means the corresponding record actually exists.
 */
export function WizardStepper({ steps }: { steps: StepperStep[] }) {
  const completed = steps.filter((step) => step.done).length;
  const percent = steps.length === 0 ? 0 : Math.round((completed / steps.length) * 100);

  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-card">
      <ol className="flex flex-wrap items-center gap-2">
        {steps.map((step, index) => (
          <li key={step.title} className="flex items-center gap-2">
            <span
              className={cn(
                "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[12.5px] font-medium",
                step.done
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-border bg-white text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full text-[10.5px] font-semibold",
                  step.done ? "bg-emerald-500 text-white" : "bg-zinc-100 text-zinc-500"
                )}
                aria-hidden
              >
                {step.done ? <Check className="size-3" strokeWidth={3.5} /> : index + 1}
              </span>
              {step.title}
            </span>
            {index < steps.length - 1 ? <span className="text-zinc-300" aria-hidden>→</span> : null}
          </li>
        ))}
      </ol>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-zinc-100">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-2 text-[11.5px] text-zinc-400">
        {completed} of {steps.length} steps complete
      </p>
    </div>
  );
}