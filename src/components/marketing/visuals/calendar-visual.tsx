import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Slot {
  type: "scheduled" | "best" | "draft" | "empty";
  time?: string;
}
interface Day {
  label: string;
  best?: boolean;
  slots: Slot[];
}

const days: Day[] = [
  { label: "Mon 12", slots: [{ type: "scheduled", time: "9:15" }, { type: "empty" }, { type: "empty" }] },
  { label: "Tue 13", best: true, slots: [{ type: "best", time: "9:30" }, { type: "scheduled", time: "12:00" }, { type: "empty" }] },
  { label: "Wed 14", slots: [{ type: "draft", time: "10:00" }, { type: "empty" }, { type: "empty" }] },
  { label: "Thu 15", slots: [{ type: "scheduled", time: "9:30" }, { type: "scheduled", time: "16:45" }, { type: "empty" }] },
  { label: "Fri 16", slots: [{ type: "empty" }, { type: "scheduled", time: "8:45" }, { type: "empty" }] },
];

/**
 * Calendar week illustration — slots typed by state (scheduled / draft /
 * best-time), deliberately free of fabricated post content or metrics.
 */
export function CalendarVisual() {
  return (
    <figure
      aria-label="Illustrated week calendar with scheduled posts, a draft and a highlighted best-time slot"
      className="overflow-hidden rounded-2xl bg-white shadow-panel ring-1 ring-slate-900/10"
    >
      <figcaption className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
        <span className="text-sm font-semibold text-slate-900">Week view</span>
        <span className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Audience time · GMT+1</span>
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700 ring-1 ring-brand-100">
            Illustration
          </span>
        </span>
      </figcaption>
      <div className="grid grid-cols-5 gap-2 p-4 sm:gap-3 sm:p-5">
        {days.map((day) => (
          <div
            key={day.label}
            className={cn(
              "rounded-xl p-2",
              day.best ? "bg-brand-50/60 ring-1 ring-brand-100" : "",
            )}
          >
            <p className="mb-2 text-center text-[11px] font-semibold text-slate-500">
              {day.label}
            </p>
            <div className="space-y-2">
              {day.slots.map((slot, i) =>
                slot.type === "scheduled" ? (
                  <div
                    key={i}
                    className="rounded-lg bg-brand-600 px-2 py-2 text-white shadow-xs"
                  >
                    <p className="text-[10px] font-semibold tabular-nums">{slot.time}</p>
                    <p className="mt-0.5 text-[10px] text-brand-100">Post</p>
                  </div>
                ) : slot.type === "best" ? (
                  <div
                    key={i}
                    className="rounded-lg bg-white px-2 py-2 ring-2 ring-brand-500"
                  >
                    <p className="flex items-center gap-1 text-[10px] font-semibold tabular-nums text-brand-700">
                      <Sparkles className="size-3" aria-hidden />
                      {slot.time}
                    </p>
                    <p className="mt-0.5 text-[10px] text-brand-600">Best time</p>
                  </div>
                ) : slot.type === "draft" ? (
                  <div
                    key={i}
                    className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-2 py-2"
                  >
                    <p className="text-[10px] font-semibold tabular-nums text-slate-500">
                      {slot.time}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-500">Draft</p>
                  </div>
                ) : (
                  <div key={i} className="h-[52px] rounded-lg bg-slate-50/70" aria-hidden />
                ),
              )}
            </div>
          </div>
        ))}
      </div>
    </figure>
  );
}
