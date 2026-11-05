"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * Controls shared by the admin tables.
 *
 * Search is debounced so each keystroke does not become a request; the page
 * resets to 1 whenever the term changes, because staying on page 4 of a
 * narrower result set usually lands on an empty page.
 *
 * Controls use `ring-1` rather than `border` to match the rest of the shell —
 * a ring is drawn outside the box, so the controls cannot shift by a pixel
 * between states.
 */

const CONTROL_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600";

export function SearchInput({
  defaultValue = "",
  onChange,
  placeholder,
  label,
}: {
  /** Initial text only. The input is uncontrolled once mounted. */
  defaultValue?: string;
  onChange: (next: string) => void;
  placeholder: string;
  label: string;
}) {
  const [draft, setDraft] = useState(defaultValue);

  /**
   * Held in a ref so the debounce effect does not re-run every time the parent
   * re-renders with a new callback identity. Assigned in an effect rather than
   * during render: writing to a ref while rendering is not safe for
   * concurrent rendering, where a render can be thrown away.
   */
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  /**
   * The last value handed to the parent. Comparing against it keeps the
   * debounce from firing on mount, and means the effect never needs to call
   * setState — it only schedules a callback for the external consumer.
   */
  const committed = useRef(defaultValue);

  useEffect(() => {
    if (draft === committed.current) return;

    const timer = setTimeout(() => {
      committed.current = draft;
      onChangeRef.current(draft);
    }, 300);

    return () => clearTimeout(timer);
  }, [draft]);

  return (
    <div className="relative w-full sm:w-72">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
        aria-hidden
      />
      <Input
        // Not a <label> pairing: the visible control is a search box and the
        // accessible name comes from aria-label, which is what screen readers
        // announce for an unlabelled input.
        aria-label={label}
        type="search"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={placeholder}
        className={cn("h-9 pl-9 text-[13px]", CONTROL_RING)}
      />
    </div>
  );
}

export function FilterSelect<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (next: T) => void;
  options: ReadonlyArray<{ value: T; label: string }>;
  label: string;
}) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as T)}>
      <SelectTrigger
        className={cn("h-9 w-full text-[13px] sm:w-44", CONTROL_RING)}
        aria-label={label}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} className="text-[13px]">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const PAGE_BUTTON =
  "inline-flex size-8 items-center justify-center rounded-lg bg-white text-slate-600 ring-1 ring-slate-200 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900 hover:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white disabled:hover:ring-slate-200";

export function Pagination({
  page,
  pageCount,
  total,
  perPage,
  onPage,
  loading = false,
}: {
  page: number;
  pageCount: number;
  total: number;
  perPage: number;
  onPage: (next: number) => void;
  loading?: boolean;
}) {
  if (total === 0) return null;

  const first = (page - 1) * perPage + 1;
  const last = Math.min(page * perPage, total);

  return (
    <div className="flex items-center justify-between gap-4 border-t border-slate-100 px-4 py-3 sm:px-5">
      <p className="flex items-center gap-2 text-[12px] text-slate-500 tabular-nums">
        {/* Spins beside the count rather than replacing it, so the row never
            changes width while a page loads. */}
        {loading ? (
          <Loader2 className="size-3.5 animate-spin text-brand-600" aria-hidden />
        ) : null}
        {first}–{last} of {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className={cn(PAGE_BUTTON, CONTROL_RING)}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <span className="px-2 text-[12px] font-medium text-slate-600 tabular-nums">
          {page} / {pageCount}
        </span>
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= pageCount}
          className={cn(PAGE_BUTTON, CONTROL_RING)}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

export function TableToolbar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200/70 p-4 sm:flex-row sm:items-center sm:px-5">
      {children}
    </div>
  );
}
