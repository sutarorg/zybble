"use client";

import { useTranslate } from "@/components/providers/localized-text";
import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Design-system pagination primitive. Currently the marketplace uses
 * "Load more" for infinite-style browsing; numbered pagination is kept
 * here as a shared component for dashboard phases (Prompts 2–4).
 */
export function Pagination({
  page,
  totalPages,
  onChange,
  className,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  className?: string;
}) {
  const translateUi = useTranslate();
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  return (
    <nav aria-label={translateUi("Pagination")} className={cn("flex items-center gap-1", className)}>
      <button
        type="button"
        aria-label={translateUi("Previous page")}
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
        className="flex size-8 cursor-pointer items-center justify-center rounded-lg border border-border bg-white text-muted-foreground shadow-xs transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronLeft className="size-4" />
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          aria-current={p === page ? "page" : undefined}
          onClick={() => onChange(p)}
          className={cn(
            "flex size-8 cursor-pointer items-center justify-center rounded-lg border text-[13px] font-medium shadow-xs transition-colors",
            p === page
              ? "border-primary bg-primary text-white"
              : "border-border bg-white text-muted-foreground hover:bg-muted"
          )}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        aria-label={translateUi("Next page")}
        disabled={page === totalPages}
        onClick={() => onChange(page + 1)}
        className="flex size-8 cursor-pointer items-center justify-center rounded-lg border border-border bg-white text-muted-foreground shadow-xs transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronRight className="size-4" />
      </button>
    </nav>
  );
}
