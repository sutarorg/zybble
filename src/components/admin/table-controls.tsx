"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Controls shared by the admin tables.
 *
 * Search is debounced so each keystroke does not become a request; the page
 * resets to 1 whenever the term changes, because staying on page 4 of a
 * narrower result set usually lands on an empty page.
 */

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
        className="h-9 pl-9 text-[13px]"
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
      <SelectTrigger className="h-9 w-full text-[13px] sm:w-40" aria-label={label}>
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

export function Pagination({
  page,
  pageCount,
  total,
  perPage,
  onPage,
}: {
  page: number;
  pageCount: number;
  total: number;
  perPage: number;
  onPage: (next: number) => void;
}) {
  if (total === 0) return null;

  const first = (page - 1) * perPage + 1;
  const last = Math.min(page * perPage, total);

  return (
    <div className="flex items-center justify-between gap-4 border-t border-slate-100 px-4 py-3">
      <p className="text-[12px] text-slate-500 tabular-nums">
        {first}–{last} of {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="inline-flex size-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
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
          className="inline-flex size-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
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
    <div className="flex flex-col gap-2 border-b border-slate-200 p-3 sm:flex-row sm:items-center">
      {children}
    </div>
  );
}
