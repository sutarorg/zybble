"use client";

import { LayoutGrid } from "lucide-react";
import { CATEGORIES } from "@/data/mock-data";
import { categoryIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";

export function CategoryChips({
  value,
  onChange,
  className,
}: {
  value: string | null;
  onChange: (slug: string | null) => void;
  className?: string;
}) {
  const chip = (active: boolean) =>
    cn(
      "flex h-10 shrink-0 cursor-pointer snap-start items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium whitespace-nowrap transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring/25 sm:h-9",
      active
        ? "border-primary bg-primary text-white shadow-sm"
        : "border-border bg-white text-muted-foreground hover:border-zinc-300 hover:bg-muted hover:text-foreground"
    );

  return (
    <div className={cn("relative", className)}>
      <div
        role="tablist"
        aria-label="Course categories"
        className="flex snap-x gap-2 overflow-x-auto overscroll-contain-x pb-1 scrollbar-hide"
      >
        <button
          type="button"
          role="tab"
          aria-selected={value === null}
          onClick={() => onChange(null)}
          className={chip(value === null)}
        >
          <LayoutGrid className="size-3.5" aria-hidden />
          All
        </button>
        {CATEGORIES.map((category) => {
          const Icon = categoryIcon(category.icon);
          const active = value === category.slug;
          return (
            <button
              key={category.slug}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(active ? null : category.slug)}
              className={chip(active)}
            >
              <Icon className="size-3.5" aria-hidden />
              {category.shortName}
            </button>
          );
        })}
      </div>
    </div>
  );
}
