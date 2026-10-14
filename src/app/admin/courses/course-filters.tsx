"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export function AdminCourseFilters({
  filters,
  active,
  counts,
}: {
  filters: ReadonlyArray<{ id: string; label: string }>;
  active: string;
  counts: Record<string, number>;
}) {
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Filter courses by status">
      {filters.map((filter) => (
        <Link
          key={filter.id}
          href={filter.id === "all" ? "/admin/courses?status=all" : `/admin/courses?status=${filter.id}`}
          className={cn(
            "rounded-lg border px-3 py-1.5 text-[13px] transition-colors",
            active === filter.id
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-white text-muted-foreground hover:bg-muted/60"
          )}
        >
          {filter.label} <span className="tabular-nums opacity-70">{counts[filter.id] ?? 0}</span>
        </Link>
      ))}
    </nav>
  );
}