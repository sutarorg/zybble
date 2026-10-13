"use client";

import * as React from "react";
import { FileDown, SlidersHorizontal, X } from "lucide-react";
import type { Course, CourseFilters } from "@/types";
import { DEFAULT_FILTERS, activeFilterCount } from "@/lib/courses";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

/* ---------------------------------- rows ---------------------------------- */

function RadioRow({
  label,
  count,
  checked,
  onSelect,
}: {
  label: string;
  count?: number;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={cn(
        "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/25",
        checked ? "font-medium text-foreground" : "text-muted-foreground"
      )}
    >
      <span
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
          checked ? "border-primary" : "border-zinc-300"
        )}
        aria-hidden
      >
        {checked && <span className="size-2 rounded-full bg-primary" />}
      </span>
      <span className="flex-1">{label}</span>
      {typeof count === "number" && (
        <span className="text-[11.5px] text-zinc-400 tabular-nums">{count}</span>
      )}
    </button>
  );
}

function CheckboxRow({
  icon: Icon,
  label,
  count,
  checked,
  onChange,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count?: number;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  const id = React.useId();
  return (
    <label
      htmlFor={id}
      className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted has-checked:font-medium has-checked:text-foreground"
    >
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      <Icon className="size-3.5 text-zinc-400" aria-hidden />
      <span className="flex-1">{label}</span>
      {typeof count === "number" && (
        <span className="text-[11.5px] text-zinc-400 tabular-nums">{count}</span>
      )}
    </label>
  );
}

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-[11px] font-semibold tracking-[0.06em] text-zinc-400 uppercase">
        {title}
      </legend>
      <div className="-mx-2 flex flex-col">{children}</div>
    </fieldset>
  );
}

/* --------------------------------- panel ---------------------------------- */

export function FilterPanel({
  value,
  onChange,
  pool,
  className,
}: {
  value: CourseFilters;
  onChange: (next: CourseFilters) => void;
  pool: Course[];
  className?: string;
}) {
  const set = <K extends keyof CourseFilters>(key: K, val: CourseFilters[K]) =>
    onChange({ ...value, [key]: val });

  const count = {
    free: pool.filter((c) => c.price === 0).length,
    paid: pool.filter((c) => c.price > 0).length,
    level: (lv: string) => pool.filter((c) => c.level === lv).length,
    dur: (pred: (m: number) => boolean) => pool.filter((c) => pred(c.durationMinutes)).length,
    lang: (lg: string) => pool.filter((c) => c.language === lg).length,
    resources: pool.filter((c) => c.downloadableResources > 0).length,
  };
  const active = activeFilterCount(value);

  return (
    <div className={cn("flex flex-col gap-5", className)}>
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold">
          <SlidersHorizontal className="size-3.5 text-zinc-400" aria-hidden />
          Filters
          {active > 0 && (
            <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-md bg-accent px-1 text-[10.5px] font-semibold text-accent-foreground">
              {active}
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={() => onChange(DEFAULT_FILTERS)}
          disabled={active === 0}
          className="flex cursor-pointer items-center gap-1 text-[12px] font-medium text-primary transition-colors hover:text-primary-hover disabled:cursor-not-allowed disabled:text-zinc-400"
        >
          <X className="size-3" aria-hidden />
          Clear all
        </button>
      </div>

      <FilterGroup title="Price">
        <RadioRow label="All prices" count={pool.length} checked={value.price === "all"} onSelect={() => set("price", "all")} />
        <RadioRow label="Free" count={count.free} checked={value.price === "free"} onSelect={() => set("price", "free")} />
        <RadioRow label="Paid" count={count.paid} checked={value.price === "paid"} onSelect={() => set("price", "paid")} />
      </FilterGroup>

      <Separator />

      <FilterGroup title="Level">
        <RadioRow label="All levels" count={pool.length} checked={value.level === "all"} onSelect={() => set("level", "all")} />
        <RadioRow label="Beginner" count={count.level("beginner")} checked={value.level === "beginner"} onSelect={() => set("level", "beginner")} />
        <RadioRow label="Intermediate" count={count.level("intermediate")} checked={value.level === "intermediate"} onSelect={() => set("level", "intermediate")} />
        <RadioRow label="Advanced" count={count.level("advanced")} checked={value.level === "advanced"} onSelect={() => set("level", "advanced")} />
      </FilterGroup>

      <Separator />

      <FilterGroup title="Duration">
        <RadioRow label="Any length" count={pool.length} checked={value.duration === "all"} onSelect={() => set("duration", "all")} />
        <RadioRow label="Under 3 hours" count={count.dur((m) => m < 180)} checked={value.duration === "short"} onSelect={() => set("duration", "short")} />
        <RadioRow label="3–8 hours" count={count.dur((m) => m >= 180 && m <= 480)} checked={value.duration === "medium"} onSelect={() => set("duration", "medium")} />
        <RadioRow label="8+ hours" count={count.dur((m) => m > 480)} checked={value.duration === "long"} onSelect={() => set("duration", "long")} />
      </FilterGroup>

      <Separator />

      <FilterGroup title="Language">
        <RadioRow label="Any language" count={pool.length} checked={value.language === "all"} onSelect={() => set("language", "all")} />
        <RadioRow label="English" count={count.lang("English")} checked={value.language === "English"} onSelect={() => set("language", "English")} />
        <RadioRow label="Spanish" count={count.lang("Spanish")} checked={value.language === "Spanish"} onSelect={() => set("language", "Spanish")} />
        <RadioRow label="Portuguese" count={count.lang("Portuguese")} checked={value.language === "Portuguese"} onSelect={() => set("language", "Portuguese")} />
      </FilterGroup>

      <Separator />

      <FilterGroup title="Features">
        <CheckboxRow
          icon={FileDown}
          label="Downloadable resources"
          count={count.resources}
          checked={value.resources}
          onChange={(v) => set("resources", v)}
        />
      </FilterGroup>
    </div>
  );
}
