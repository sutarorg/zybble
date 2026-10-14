"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const RANGES: Array<{ id: "7d" | "30d" | "90d" | "1y"; label: string }> = [
  { id: "7d", label: "7D" },
  { id: "30d", label: "30D" },
  { id: "90d", label: "90D" },
  { id: "1y", label: "1Y" },
];

/** Switches the analytics window by navigating, so the server re-queries. */
export function AnalyticsRangeSelector({ active }: { active: "7d" | "30d" | "90d" | "1y" }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  return (
    <div className="inline-flex rounded-lg border border-border bg-muted/50 p-0.5" role="group" aria-label="Analytics range">
      {RANGES.map((range) => (
        <button
          key={range.id}
          type="button"
          aria-pressed={active === range.id}
          onClick={() => {
            const next = new URLSearchParams(params.toString());
            next.set("range", range.id);
            router.replace(`${pathname}?${next.toString()}`, { scroll: false });
          }}
          className={cn(
            "cursor-pointer rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors",
            active === range.id ? "bg-white text-foreground shadow-card" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
}