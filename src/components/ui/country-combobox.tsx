"use client";

import { LocalizedText, useTranslate } from "@/components/providers/localized-text";
import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { COUNTRIES } from "@/lib/countries";
import { cn } from "@/lib/utils";

/**
 * Searchable country picker.
 *
 * A plain text field was too error-prone (typos, casings) so the profile uses a
 * combobox: type to filter the full country list, pick with mouse or keyboard,
 * or commit a custom value if a territory is missing.
 */
export function CountryCombobox({
  value,
  onChange,
  id,
  placeholder = "Select a country…",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  className?: string;
}) {
  const translateUi = useTranslate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) => c.toLowerCase().includes(q));
  }, [query]);

  const custom = query.trim();
  const canAddCustom =
    custom.length > 1 && !results.some((c) => c.toLowerCase() === custom.toLowerCase());

  const options = useMemo(
    () => (canAddCustom ? [custom, ...results] : results),
    [canAddCustom, custom, results]
  );

  /* Close on outside click */
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  /**
   * Opening seeds the highlighted row from the current value and focuses the
   * search field — done in the event handler so no state is set during render
   * or in an effect body.
   */
  const openList = () => {
    setQuery("");
    setActive(Math.max(0, COUNTRIES.indexOf(value)));
    setOpen(true);
    window.setTimeout(() => inputRef.current?.focus(), 20);
  };

  const commit = (country: string) => {
    onChange(country);
    setOpen(false);
    setQuery("");
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(i + 1, options.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const country = options[active];
      if (country) commit(country);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className={cn("relative", className)} onKeyDown={onKeyDown}>
      <button
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={translateUi("Country")}
        onClick={() => (open ? setOpen(false) : openList())}
        className={cn(
          "flex h-9.5 w-full cursor-pointer items-center gap-2 rounded-lg border border-input bg-white px-3 text-left text-sm shadow-xs transition-colors outline-none hover:border-zinc-300 focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/15",
          open && "border-primary/50 ring-2 ring-ring/15"
        )}
      >
        <span className={cn("min-w-0 flex-1 truncate", !value && "text-zinc-400")}>
          {value ? <LocalizedText text={value} /> : <LocalizedText text={placeholder} />}
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-zinc-400 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-border bg-white shadow-pop">
          <div className="relative border-b border-border p-2">
            <Search className="pointer-events-none absolute top-1/2 left-4.5 size-3.5 -translate-y-1/2 text-zinc-400" aria-hidden />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              placeholder={translateUi("Search countries…")}
              aria-label={translateUi("Search countries")}
              className="h-8.5 w-full rounded-lg bg-muted pr-2.5 pl-8 text-[13px] outline-none placeholder:text-zinc-400 focus:bg-white focus:ring-2 focus:ring-ring/15"
            />
          </div>
          <ul role="listbox" aria-label={translateUi("Countries")} className="max-h-60 overflow-y-auto scrollbar-thin p-1.5">
            {options.length === 0 && (
              <li className="px-2.5 py-3 text-[12.5px] text-zinc-400">
                <LocalizedText text="No country matches that search." />
              </li>
            )}
            {options.map((country, i) => {
              const selected = country === value;
              return (
                <li key={country}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => commit(country)}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors",
                      i === active ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-muted"
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      <LocalizedText text={country} />
                      {canAddCustom && i === 0 && (
                        <span className="ml-1.5 text-[11px] text-zinc-400">
                          <LocalizedText text="(use this)" />
                        </span>
                      )}
                    </span>
                    {selected && <Check className="size-3.5 shrink-0 text-primary" aria-hidden />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
