import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

const bars = [34, 48, 40, 62, 55, 74, 68] as const;
const barDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const chips = ["Engagement rate", "Saves & comments", "Follower movement"] as const;

/**
 * Analytics illustration. Values are strictly relative ("indexed to your
 * average") so no fabricated metrics are ever presented as data.
 */
export function AnalyticsVisual() {
  return (
    <figure
      aria-label="Illustrated analytics chart showing relative engagement across a week"
      className="overflow-hidden rounded-2xl bg-white shadow-panel ring-1 ring-slate-900/10"
    >
      <figcaption className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
        <span className="text-sm font-semibold text-slate-900">Engagement per post</span>
        <span className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Indexed to your average</span>
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700 ring-1 ring-brand-100">
            Illustration
          </span>
        </span>
      </figcaption>

      <div className="p-5">
        <div className="flex h-44 items-end gap-2.5 sm:gap-3" aria-hidden>
          {bars.map((h, i) => (
            <div key={barDays[i]} className="flex h-full flex-1 flex-col justify-end">
              <div
                style={{ height: `${h}%` }}
                className={cn(
                  "rounded-t-md",
                  i === 5 ? "bg-brand-500" : i >= 3 ? "bg-brand-200" : "bg-slate-200",
                )}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2.5 sm:gap-3" aria-hidden>
          {barDays.map((d) => (
            <p key={d} className="flex-1 text-center text-[11px] font-medium text-slate-500">
              {d}
            </p>
          ))}
        </div>

        <ul className="mt-5 grid grid-cols-1 gap-2 border-t border-slate-100 pt-4 sm:grid-cols-3">
          {chips.map((chip) => (
            <li
              key={chip}
              className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 ring-1 ring-slate-100"
            >
              <TrendingUp className="size-3.5 text-brand-600" aria-hidden />
              <span className="text-xs font-medium text-slate-600">{chip}</span>
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}
