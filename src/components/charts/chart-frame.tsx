import { AlertTriangle, BarChart3 } from "lucide-react";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export type ChartStatus = "ready" | "loading" | "empty" | "error";

interface ChartFrameProps {
  status: ChartStatus;
  height: number;
  /** Shown when status === "empty". */
  emptyTitle: string;
  emptyDescription: string;
  errorTitle?: string;
  children: ReactNode;
  /** Accessible name for the ready-state figure. */
  ariaLabel: string;
}

/**
 * Uniform frame for every chart: renders loading skeletons, empty states and
 * error states consistently, so a chart either shows real data or an honest
 * explanation — never invented values.
 */
export function ChartFrame({
  status,
  height,
  emptyTitle,
  emptyDescription,
  errorTitle = "Couldn't load this chart",
  children,
  ariaLabel,
}: ChartFrameProps) {
  if (status === "loading") {
    return (
      <div style={{ height }} className="flex flex-col justify-end gap-2" aria-busy="true" aria-label={ariaLabel}>
        <Skeleton className="h-full w-full" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div
        role="alert"
        style={{ height }}
        className="flex flex-col items-center justify-center rounded-xl bg-red-50/60 text-center ring-1 ring-red-100"
      >
        <AlertTriangle className="size-5 text-red-400" aria-hidden />
        <p className="mt-2 text-sm font-medium text-red-700">{errorTitle}</p>
        <p className="mt-1 max-w-xs text-[13px] text-red-500">
          Check your connection and retry. Your data is safe.
        </p>
      </div>
    );
  }

  if (status === "empty") {
    return (
      <div
        style={{ height }}
        className="relative flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/40 text-center"
      >
        {/* Faint axis ghost conveys "chart lives here" without fake data */}
        <div aria-hidden className="absolute inset-4">
          <div className="absolute inset-x-0 bottom-6 border-t border-dashed border-slate-200" />
          <div className="absolute inset-y-0 left-0 border-l border-dashed border-slate-200" />
        </div>
        <BarChart3 className="relative size-5 text-slate-300" aria-hidden />
        <p className="relative mt-2 text-sm font-medium text-slate-600">{emptyTitle}</p>
        <p className="relative mt-1 max-w-xs text-[13px] leading-5 text-slate-500">
          {emptyDescription}
        </p>
      </div>
    );
  }

  return (
    <figure aria-label={ariaLabel} className="w-full">
      {children}
    </figure>
  );
}
