"use client";

import { format, parseISO } from "date-fns";
import { useMemo, useRef, useState } from "react";
import type { MetricPoint } from "@/lib/app/types";
import { ChartFrame, type ChartStatus } from "@/components/charts/chart-frame";
import { cn } from "@/lib/utils";

export interface TrendSeries {
  key: keyof Omit<MetricPoint, "date">;
  label: string;
  /** CSS colour (hex) for line/area. */
  color: string;
}

interface TrendChartProps {
  data: MetricPoint[];
  series: TrendSeries[];
  status?: ChartStatus;
  height?: number;
  yAxisLabel: string;
  emptyTitle: string;
  emptyDescription: string;
}

const PADDING = { top: 12, right: 8, bottom: 26, left: 40 };

/**
 * Multi-series area/line trend chart (pure SVG, no chart dependency).
 * Contract: `MetricPoint[]` per `src/lib/app/types.ts`; values are rendered
 * verbatim from the LinkedIn API — never synthesised.
 */
export function TrendChart({
  data,
  series,
  status,
  height = 260,
  yAxisLabel,
  emptyTitle,
  emptyDescription,
}: TrendChartProps) {
  const resolved: ChartStatus = status ?? (data.length === 0 ? "empty" : "ready");
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const viewW = 720;
  const viewH = height;
  const plotW = viewW - PADDING.left - PADDING.right;
  const plotH = viewH - PADDING.top - PADDING.bottom;

  const { paths, areaPath, max, ticks, xFor } = useMemo(() => {
    const maxVal = Math.max(1, ...data.flatMap((d) => series.map((s) => d[s.key])));
    const niceMax = Math.ceil(maxVal * 1.15);
    const x = (i: number) => PADDING.left + (data.length <= 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
    const y = (v: number) => PADDING.top + plotH - (v / niceMax) * plotH;

    const linePaths = series.map((s) =>
      data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d[s.key]).toFixed(1)}`).join(" "),
    );

    // Area under the primary series
    const primary = series[0];
    const area =
      data.length > 1 && primary
        ? `${data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d[primary.key]).toFixed(1)}`).join(" ")} L${x(data.length - 1).toFixed(1)},${PADDING.top + plotH} L${x(0).toFixed(1)},${PADDING.top + plotH} Z`
        : undefined;

    const yTicks = [0.25, 0.5, 0.75, 1].map((f) => ({
      y: PADDING.top + plotH - plotH * f,
      value: Math.round(niceMax * f),
    }));

    return { paths: linePaths, areaPath: area, max: niceMax, ticks: yTicks, xFor: x };
  }, [data, series, plotW, plotH]);

  if (resolved !== "ready") {
    return (
      <ChartFrame
        status={resolved}
        height={height}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        ariaLabel={yAxisLabel}
      >
        {null}
      </ChartFrame>
    );
  }

  function onMove(e: React.MouseEvent) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || data.length === 0) return;
    const relX = ((e.clientX - rect.left) / rect.width) * viewW;
    const frac = (relX - PADDING.left) / plotW;
    const idx = Math.round(frac * (data.length - 1));
    const clamped = Math.max(0, Math.min(data.length - 1, idx));
    setHoverIndex(clamped);
    setTooltipPos({ x: (xFor(clamped) / viewW) * rect.width, y: 0 });
  }

  const hoverPoint = hoverIndex !== null ? data[hoverIndex] : null;

  return (
    <ChartFrame
      status={resolved}
      height={height}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
      ariaLabel={yAxisLabel}
    >
      <div ref={containerRef} className="relative" onMouseMove={onMove} onMouseLeave={() => setHoverIndex(null)}>
        <svg
          viewBox={`0 0 ${viewW} ${viewH}`}
          role="img"
          aria-label={`${yAxisLabel}: line chart across ${data.length} days`}
          className="block w-full"
          style={{ height }}
        >
          <defs>
            <linearGradient id="trend-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={series[0]?.color ?? "#2563eb"} stopOpacity="0.18" />
              <stop offset="100%" stopColor={series[0]?.color ?? "#2563eb"} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Grid + y labels */}
          {ticks.map((t) => (
            <g key={t.value}>
              <line x1={PADDING.left} x2={viewW - PADDING.right} y1={t.y} y2={t.y} stroke="#e2e8f0" strokeDasharray="3 4" />
              <text x={PADDING.left - 8} y={t.y + 4} textAnchor="end" className="fill-slate-400 text-[10px] tabular-nums">
                {t.value >= 1000 ? `${(t.value / 1000).toFixed(1)}k` : t.value}
              </text>
            </g>
          ))}
          <line x1={PADDING.left} x2={viewW - PADDING.right} y1={PADDING.top + plotH} y2={PADDING.top + plotH} stroke="#cbd5e1" />

          {/* X labels: first / middle / last */}
          {data.length > 0 &&
            [0, Math.floor((data.length - 1) / 2), data.length - 1]
              .filter((v, i, a) => a.indexOf(v) === i)
              .map((i) => (
                <text
                  key={i}
                  x={xFor(i)}
                  y={viewH - 6}
                  textAnchor="middle"
                  className="fill-slate-400 text-[10px]"
                >
                  {format(parseISO(data[i].date), "d MMM")}
                </text>
              ))}

          {areaPath && <path d={areaPath} fill="url(#trend-area)" />}
          {paths.map((d, i) => (
            <path
              key={series[i].key}
              d={d}
              fill="none"
              stroke={series[i].color}
              strokeWidth={i === 0 ? 2 : 1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={i === 0 ? 1 : 0.75}
            />
          ))}

          {hoverIndex !== null && (
            <line
              x1={xFor(hoverIndex)}
              x2={xFor(hoverIndex)}
              y1={PADDING.top}
              y2={PADDING.top + plotH}
              stroke="#94a3b8"
              strokeDasharray="2 3"
            />
          )}
        </svg>

        {/* Tooltip */}
        {hoverPoint && tooltipPos && (
          <div
            role="tooltip"
            className={cn(
              "pointer-events-none absolute top-2 z-10 min-w-36 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-white shadow-soft",
            )}
            style={{ left: tooltipPos.x }}
          >
            <p className="text-[11px] font-medium text-slate-300">
              {format(parseISO(hoverPoint.date), "EEEE d MMM")}
            </p>
            <ul className="mt-1.5 space-y-0.5">
              {series.map((s) => (
                <li key={s.key} className="flex items-center justify-between gap-4 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full" style={{ background: s.color }} aria-hidden />
                    {s.label}
                  </span>
                  <span className="font-semibold tabular-nums">{hoverPoint[s.key].toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Legend */}
      <ul className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5" aria-hidden>
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <span className="size-2 rounded-[3px]" style={{ background: s.color }} />
            {s.label}
          </li>
        ))}
        <li className="ml-auto text-[11px] text-slate-400">{yAxisLabel}</li>
      </ul>
    </ChartFrame>
  );
}
