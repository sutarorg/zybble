"use client";

import { Check } from "lucide-react";
import { CREATOR_STEPS } from "@/lib/creator";
import { cn } from "@/lib/utils";

export function WizardStepper({
  current,
  maxReached,
  onJump,
  stepValid,
}: {
  current: number;
  maxReached: number;
  onJump: (step: number) => void;
  stepValid: (step: number) => boolean;
}) {
  return (
    <nav aria-label="Course builder progress">
      <ol className="flex flex-col gap-0.5">
        {CREATOR_STEPS.map((label, i) => {
          const done = i < current && stepValid(i);
          const isCurrent = i === current;
          const reachable = i <= maxReached;
          return (
            <li key={label}>
              <button
                type="button"
                onClick={() => reachable && onJump(i)}
                disabled={!reachable}
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] transition-colors",
                  isCurrent
                    ? "bg-accent font-semibold text-primary"
                    : reachable
                      ? "text-muted-foreground hover:bg-muted hover:text-foreground"
                      : "cursor-not-allowed text-zinc-300"
                )}
              >
                <span
                  className={cn(
                    "flex size-5.5 shrink-0 items-center justify-center rounded-full border text-[10.5px] font-semibold",
                    done
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : isCurrent
                        ? "border-primary bg-primary text-white"
                        : reachable
                          ? "border-zinc-300 bg-white text-zinc-500"
                          : "border-zinc-200 bg-zinc-50 text-zinc-300"
                  )}
                >
                  {done ? <Check className="size-3" strokeWidth={3.5} aria-hidden /> : i + 1}
                </span>
                <span className="flex-1">{label}</span>
                {done && <span className="text-[10px] font-semibold text-emerald-600 uppercase">Done</span>}
              </button>
            </li>
          );
        })}
      </ol>
      <div className="mt-4 px-3">
        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${((current + 1) / CREATOR_STEPS.length) * 100}%` }}
          />
        </div>
        <p className="mt-2 text-[11.5px] text-zinc-400">
          Step {current + 1} of {CREATOR_STEPS.length}
        </p>
      </div>
    </nav>
  );
}
