"use client";

import { useState } from "react";
import type { BestTimeCell } from "@/lib/app/types";
import { ChartFrame, type ChartStatus } from "@/components/charts/chart-frame";
import { cn } from "@/lib/utils";

interface BestTimeHeatmapProps {
  cells: BestTimeCell[];
  status?: ChartStatus;
  height?: number;
  emptyTitle: string;
  emptyDescription: string;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** Two-hour buckets keep the grid legible: 06→22 audience-local. */
const HOURS = [6, 8, 10, 12, 14, 16, 18, 20];

/**
 * Best-time-to-post heatmap. Contract: `BestTimeCell[]` with scores in [0,1]
 * computed from the account's own published-post performance (Prompt 3).
 * null scores render as neutral cells — never as implied hotspots.
 */
export function BestTimeHeatmap({
  cells,
  status,
  height = 240,
  emptyTitle,
  emptyDescription,
}: BestTimeHeatmapProps) {
  const resolved: ChartStatus = status ?? (cells.length === 0 ? "empty" : "ready");
  const [focused, setFocused] = useState<{ day: string; hour: number; score: number | null } | null>(null);

  if (resolved !== "ready") {
    return (
      <ChartFrame status={resolved} height={height} emptyTitle={emptyTitle} emptyDescription={emptyDescription} ariaLabel="Best time to post heatmap">
        {null}
      </ChartFrame>
    );
  }

  const scoreFor = (weekday: number, hour: number) =>
    cells.find((c) => c.weekday === weekday && c.hour === hour)?.score ?? null;

  return (
    <ChartFrame status={resolved} height={height} emptyTitle={emptyTitle} emptyDescription={emptyDescription} ariaLabel="Best time to post heatmap">
      <div role="grid" aria-label="Engagement score by weekday and hour" className="w-full">
        <div className="grid grid-cols-[2.5rem_repeat(8,1fr)] gap-1">
          <span aria-hidden />
          {HOURS.map((h) => (
            <p key={h} className="text-center text-[10px] font-medium text-slate-500 tabular-nums">
              {h}:00
            </p>
          ))}
          {DAYS.map((day, weekday) => (
            <div key={day} className="contents">
              <p className="flex items-center text-[10px] font-medium text-slate-500">{day}</p>
              {HOURS.map((hour) => {
                const score = scoreFor(weekday, hour);
                return (
                  <button
                    key={hour}
                    type="button"
                    role="gridcell"
                    aria-label={`${day} ${hour}:00 — ${score === null ? "no data" : `score ${(score * 100).toFixed(0)} of 100`}`}
                    onFocus={() => setFocused({ day, hour, score })}
                    onBlur={() => setFocused(null)}
                    onMouseEnter={() => setFocused({ day, hour, score })}
                    onMouseLeave={() => setFocused(null)}
                    style={
                      score === null
                        ? undefined
                        : { backgroundColor: `rgb(37 99 235 / ${0.08 + score * 0.75})` }
                    }
                    className={cn(
                      "h-6 rounded-[5px] transition-transform focus-visible:outline-2 focus-visible:outline-brand-600",
                      score === null ? "bg-slate-100/70" : "hover:scale-[1.08]",
                    )}
                  />
                );
              })}
            </div>
          ))}
        </div>
        <p className="mt-3 flex min-h-5 items-center gap-2 text-xs text-slate-600" aria-live="polite">
          {focused ? (
            <>
              <span className="font-medium text-slate-700">
                {focused.day} {focused.hour}:00–{focused.hour + 2}:00
              </span>
              {focused.score === null ? "not enough data yet" : `relative engagement score ${(focused.score * 100).toFixed(0)}/100`}
            </>
          ) : (
            "Hover or focus a cell — darker blue means stronger historical engagement."
          )}
        </p>
      </div>
    </ChartFrame>
  );
}
