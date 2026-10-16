"use client";

import { LocalizedText, useTranslate } from "@/components/providers/localized-text";
import * as React from "react";
import { useMemo, useState } from "react";
import { formatInr } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * How a chart value is rendered in the hover readout and rows.
 *
 * This is a serialisable marker, not a function: these components are Client
 * Components and a Server Component cannot hand a function across the RSC
 * boundary ("Functions cannot be passed directly to Client Components").
 */
export type ChartValueFormat = "money" | "count";

function formatChartValue(value: number, format: ChartValueFormat): string {
  // `money` matches the studio's `money()` helper exactly — INR, en-IN grouping.
  return format === "money" ? formatInr(value) : String(value);
}

/* ------------------------------- Area chart -------------------------------- */

interface AreaDatum {
  label: string;
  value: number;
}

/**
 * Lightweight SVG area/line chart — no dependencies, deterministic rendering.
 */
export function AreaChart({
  data,
  height = 240,
  valueFormat = "count",
  className,
}: {
  data: AreaDatum[];
  height?: number;
  valueFormat?: ChartValueFormat;
  className?: string;
}) {
  const translateUi = useTranslate();
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const H = height;
  const PAD = { top: 16, right: 12, bottom: 26, left: 12 };

  const { path, area, points, max } = useMemo(() => {
    const values = data.map((d) => d.value);
    const max = Math.max(...values, 1) * 1.15;
    const iw = W - PAD.left - PAD.right;
    const ih = H - PAD.top - PAD.bottom;
    const points = data.map((d, i) => ({
      x: PAD.left + (i / Math.max(1, data.length - 1)) * iw,
      y: PAD.top + ih - (d.value / max) * ih,
      ...d,
    }));
    const line = points
      .map((p, i) => {
        if (i === 0) return `M ${p.x} ${p.y}`;
        const prev = points[i - 1];
        const cx = (prev.x + p.x) / 2;
        return `C ${cx} ${prev.y}, ${cx} ${p.y}, ${p.x} ${p.y}`;
      })
      .join(" ");
    const area = `${line} L ${points[points.length - 1]?.x ?? PAD.left} ${H - PAD.bottom} L ${PAD.left} ${H - PAD.bottom} Z`;
    return { path: line, area, points, max };
  }, [data, H, PAD.left, PAD.right, PAD.top, PAD.bottom, W]);

  const labelEvery = Math.ceil(data.length / 8);

  return (
    <div className={cn("relative", className)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={translateUi("Trend chart")}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * W;
          let best = 0;
          let dist = Infinity;
          points.forEach((p, i) => {
            const d = Math.abs(p.x - x);
            if (d < dist) {
              dist = d;
              best = i;
            }
          });
          setHover(best);
        }}
      >
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* grid */}
        {[0.25, 0.5, 0.75, 1].map((f) => {
          const y = PAD.top + (H - PAD.top - PAD.bottom) * (1 - f);
          return (
            <line key={f} x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="#ececf0" strokeDasharray="3 4" />
          );
        })}
        {/* base line */}
        <line x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} stroke="#e4e4e8" />
        <path d={area} fill="url(#areaFill)" />
        <path d={path} fill="none" stroke="#7c3aed" strokeWidth="2.25" strokeLinecap="round" />
        {/* hover guide */}
        {hover !== null && points[hover] && (
          <g>
            <line
              x1={points[hover].x}
              x2={points[hover].x}
              y1={PAD.top}
              y2={H - PAD.bottom}
              stroke="#c4b5fd"
              strokeDasharray="3 3"
            />
            <circle cx={points[hover].x} cy={points[hover].y} r="4.5" fill="#7c3aed" stroke="#fff" strokeWidth="2" />
          </g>
        )}
        {/* x labels */}
        {points.map((p, i) =>
          i % labelEvery === 0 ? (
            <text key={i} x={p.x} y={H - 8} textAnchor="middle" fontSize="10.5" fill="#a1a1aa">
              <LocalizedText text={p.label} />
            </text>
          ) : null
        )}
      </svg>

      {/* hover readout */}
      {hover !== null && points[hover] && (
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 rounded-lg border border-border bg-white px-3 py-1.5 text-center shadow-pop">
          <p className="font-display text-[13px] font-bold whitespace-nowrap tabular-nums">
            <LocalizedText text={formatChartValue(points[hover].value, valueFormat)} />
          </p>
          <p className="text-[10.5px] whitespace-nowrap text-zinc-400"><LocalizedText text={points[hover].label} /></p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------- Bar list ---------------------------------- */

export interface BarDatum {
  id: string;
  label: string;
  value: number;
  sub?: string;
}

export function BarList({
  data,
  valueFormat = "count",
  className,
}: {
  data: BarDatum[];
  valueFormat?: ChartValueFormat;
  className?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <ul className={cn("space-y-3.5", className)}>
      {data.map((d) => (
        <li key={d.id}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="truncate text-[13px] font-medium"><LocalizedText text={d.label} /></p>
            <p className="shrink-0 text-[13px] font-semibold tabular-nums"><LocalizedText text={formatChartValue(d.value, valueFormat)} /></p>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${Math.max(2, (d.value / max) * 100)}%` }}
            />
          </div>
          {d.sub && <p className="mt-1 text-[11.5px] text-zinc-400"><LocalizedText text={d.sub} /></p>}
        </li>
      ))}
    </ul>
  );
}
