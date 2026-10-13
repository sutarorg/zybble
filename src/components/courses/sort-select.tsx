"use client";

import { LocalizedText, useTranslate } from "@/components/providers/localized-text";
import { ArrowUpDown } from "lucide-react";
import type { SortOption } from "@/types";
import { SORT_LABELS } from "@/lib/courses";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ORDER: SortOption[] = ["popular", "newest", "rating", "price-asc", "price-desc"];

export function SortSelect({
  value,
  onChange,
  className,
}: {
  value: SortOption;
  onChange: (sort: SortOption) => void;
  className?: string;
}) {
  const translateUi = useTranslate();
  return (
    <Select value={value} onValueChange={(v) => onChange(v as SortOption)}>
      <SelectTrigger className={className} aria-label={translateUi("Sort courses")}>
        <span className="flex items-center gap-2">
          <ArrowUpDown className="size-3.5 text-zinc-400" aria-hidden />
          <SelectValue placeholder={translateUi("Sort by")} />
        </span>
      </SelectTrigger>
      <SelectContent align="end">
        {ORDER.map((key) => (
          <SelectItem key={key} value={key}>
            <LocalizedText text={SORT_LABELS[key]} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
