import { TrendingDown, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  /** null renders an em-dash — we never invent a number. */
  value: string | null;
  icon: LucideIcon;
  hint: string;
  /** Percentage point change; null = unknown/no data. */
  delta?: number | null;
}

export function StatCard({ label, value, icon: Icon, hint, delta }: StatCardProps) {
  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 shadow-xs">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-slate-600">{label}</p>
        <span className="flex size-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-brand-100">
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <p className="mt-3 text-[28px] font-semibold leading-none tracking-tight text-slate-950 tabular-nums">
        {value ?? "—"}
      </p>
      <div className="mt-2.5 flex items-center gap-2">
        {typeof delta === "number" && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums",
              delta >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600",
            )}
          >
            {delta >= 0 ? (
              <TrendingUp className="size-3" aria-hidden />
            ) : (
              <TrendingDown className="size-3" aria-hidden />
            )}
            {Math.abs(delta).toFixed(0)}%
          </span>
        )}
        <p className="text-xs leading-4 text-slate-500">{hint}</p>
      </div>
    </div>
  );
}
