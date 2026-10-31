import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  /** Optional CTA row. */
  children?: ReactNode;
  className?: string;
  compact?: boolean;
}

/** Consistent, purposeful empty states across the whole dashboard. */
export function EmptyState({ icon: Icon, title, description, children, className, compact }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 text-center",
        compact ? "px-6 py-10" : "px-6 py-16",
        className,
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-xs ring-1 ring-slate-200">
        <Icon className="size-5" aria-hidden />
      </div>
      <h3 className="mt-4 text-[15px] font-semibold text-slate-900">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-6 text-slate-500">{description}</p>
      {children ? <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{children}</div> : null}
    </div>
  );
}
