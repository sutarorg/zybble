import { LocalizedText } from "@/components/providers/localized-text";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  icon: Icon,
  label,
  value,
  delta,
  deltaDown,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  delta?: string;
  deltaDown?: boolean;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4.5 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover sm:p-5">
      <div className="flex items-center justify-between">
        <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-primary">
          <Icon className="size-4.5" aria-hidden />
        </span>
        {delta && (
          <span
            className={cn(
              "flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
              deltaDown ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"
            )}
          >
            {deltaDown ? (
              <TrendingDown className="size-3" aria-hidden />
            ) : (
              <TrendingUp className="size-3" aria-hidden />
            )}
            <LocalizedText text={delta} />
          </span>
        )}
      </div>
      <p className="font-display mt-3 text-[22px] leading-none font-bold tracking-tight tabular-nums">
        <LocalizedText text={value} />
      </p>
      <p className="mt-1.5 text-[12.5px] text-muted-foreground">
        <LocalizedText text={label} />
        {hint && <span className="text-zinc-400"> · <LocalizedText text={hint} /></span>}
      </p>
    </div>
  );
}
