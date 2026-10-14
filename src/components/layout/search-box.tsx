"use client";

import { LocalizedText, useTranslate } from "@/components/providers/localized-text";
import * as React from "react";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { CornerDownLeft, Search, UserRound } from "lucide-react";
import { useMounted } from "@/lib/hooks";
import { useApp } from "@/components/providers/app-providers";
import { getDictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Suggestion =
  | { kind: "course"; id: string; href: string; title: string; meta: string; thumbnail: string }
  | { kind: "instructor"; id: string; href: string; name: string; headline: string; initials: string };

interface SearchPayload {
  courses?: Array<{ id: string; href: string; title: string; meta: string; thumbnail: string }>;
  instructors?: Array<{ id: string; href: string; name: string; headline: string; initials: string }>;
}

/**
 * Suggestions come from `/api/catalog/search`, which reads the published
 * catalog on the server. Nothing is searched in the browser, so the list can
 * never drift from what a visitor is actually allowed to see.
 */
function useSearchResults(query: string): Suggestion[] {
  const trimmed = query.trim();
  const [results, setResults] = React.useState<Suggestion[]>([]);

  React.useEffect(() => {
    if (trimmed.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch(`/api/catalog/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        .then((response) => (response.ok ? (response.json() as Promise<SearchPayload>) : { courses: [], instructors: [] }))
        .then((payload) => {
          const courses: Suggestion[] = (payload.courses ?? []).map((course) => ({ kind: "course", ...course }));
          const instructors: Suggestion[] = (payload.instructors ?? []).map((instructor) => ({ kind: "instructor", ...instructor }));
          setResults([...courses, ...instructors]);
        })
        .catch(() => {
          /* Aborted or offline: leave the previous list in place. */
        });
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [trimmed]);

  return results;
}

function SuggestionRow({
  suggestion,
  active,
  onSelect,
  optionId,
}: {
  suggestion: Suggestion;
  active: boolean;
  onSelect: () => void;
  optionId: string;
}) {
  const translateUi = useTranslate();
  return (
    <Link
      id={optionId}
      href={suggestion.href}
      role="option"
      aria-selected={active}
      onClick={onSelect}
      className={cn(
        "flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors",
        active ? "bg-muted" : "hover:bg-muted"
      )}
    >
      {suggestion.kind === "course" ? (
        <>
          <span className="relative block h-9 w-16 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
            <Image src={suggestion.thumbnail} alt={translateUi("")} fill sizes="64px" className="object-cover" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium"><LocalizedText text={suggestion.title} /></span>
            <span className="block truncate text-[11.5px] text-muted-foreground">
              <LocalizedText text={suggestion.meta} />
            </span>
          </span>
        </>
      ) : (
        <>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[11px] font-semibold text-violet-700">
            <LocalizedText text={suggestion.initials} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium"><LocalizedText text={suggestion.name} /></span>
            <span className="block truncate text-[11.5px] text-muted-foreground">
              <LocalizedText text={suggestion.headline} />
            </span>
          </span>
          <UserRound className="size-3.5 shrink-0 text-zinc-300" aria-hidden />
        </>
      )}
    </Link>
  );
}

/**
 * Global course search.
 *
 * `inline` (default) renders the rounded input used in the sticky headers and
 * floats suggestions beneath it. `panel` renders the same field without the
 * floating layer, for use inside the full-screen mobile search sheet.
 */
export function SearchBox({
  className,
  mode = "inline",
  autoFocus = false,
  onSubmit,
}: {
  className?: string;
  mode?: "inline" | "panel";
  autoFocus?: boolean;
  onSubmit?: () => void;
}) {
  const translateUi = useTranslate();
  const router = useRouter();
  const { language } = useApp();
  const dict = getDictionary(language);
  const mounted = useMounted();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const isPanel = mode === "panel";
  const trimmed = query.trim();
  const results = useSearchResults(query);
  // Reset the highlighted row when the result set changes, during render rather
  // than in a cascading effect.
  const [trackedResults, setTrackedResults] = React.useState(results);
  if (trackedResults !== results) {
    setTrackedResults(results);
    if (activeIndex !== -1) setActiveIndex(-1);
  }
  const showResults = (isPanel || open) && trimmed.length > 0;

  // Platform-aware shortcut hint. Resolved after hydration so the server HTML
  // ("Ctrl K") is never overwritten by a different client value.
  const isMac =
    mounted &&
    typeof navigator !== "undefined" &&
    /mac|iphone|ipad|ipod/i.test(navigator.userAgent);
  const shortcut = isMac ? "⌘K" : "Ctrl K";

  useEffect(() => {
    if (!autoFocus) return;
    inputRef.current?.focus();
  }, [autoFocus]);

  // Global ⌘K / Ctrl K shortcut (only when a search field exists on the page).
  useEffect(() => {
    if (isPanel) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isPanel]);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!trimmed) return;
    const active = results[activeIndex];
    setOpen(false);
    onSubmit?.();
    if (active) router.push(active.href);
    else router.push(`/?q=${encodeURIComponent(trimmed)}`);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!showResults || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    }
  };

  return (
    <div className={cn("relative", className)}>
      <form onSubmit={submit} role="search">
        <Search
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-zinc-400"
          aria-hidden
        />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(-1);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            if (!isPanel) setTimeout(() => setOpen(false), 150);
          }}
          onKeyDown={onKeyDown}
          placeholder={translateUi(isPanel ? dict.searchPlaceholderShort : dict.searchPlaceholder)}
          aria-label={translateUi("Search courses")}
          role="combobox"
          aria-expanded={showResults}
          aria-controls={showResults ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={
            showResults && activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined
          }
          autoComplete="off"
          className="h-10 w-full rounded-full border border-transparent bg-muted pr-4 pl-10 text-sm transition-all outline-none placeholder:text-zinc-400 focus:border-primary/40 focus:bg-white focus:ring-2 focus:ring-ring/15 sm:pr-20 [&::-webkit-search-cancel-button]:hidden"
        />
        {!isPanel && (
          <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 items-center gap-1 rounded-md border border-border bg-white px-1.5 py-0.5 text-[10.5px] font-medium text-zinc-400 sm:flex">
            {shortcut}
          </kbd>
        )}
      </form>

      {showResults && (
        <div
          className={cn(
            isPanel
              ? "mt-3 overflow-hidden rounded-xl border border-border bg-white"
              : "absolute top-12 right-0 left-0 z-50 overflow-hidden rounded-xl border border-border bg-white shadow-pop"
          )}
        >
          {results.length > 0 ? (
            <div
              id={listId}
              role="listbox"
              aria-label={translateUi("Search suggestions")}
              className={cn(
                "p-1.5",
                isPanel ? "max-h-none" : "max-h-[min(24rem,60dvh)] overflow-y-auto scrollbar-thin"
              )}
            >
              {results.map((suggestion, i) => (
                <SuggestionRow
                  key={suggestion.id}
                  suggestion={suggestion}
                  active={activeIndex === i}
                  optionId={`${listId}-option-${i}`}
                  onSelect={() => {
                    setOpen(false);
                    onSubmit?.();
                  }}
                />
              ))}
            </div>
          ) : (
            <p className="px-4 py-5 text-center text-[13px] text-muted-foreground"><LocalizedText text={"No matches for “"} /><LocalizedText text={trimmed} /><LocalizedText text={"”. Try a tool, topic or instructor name."} /></p>
          )}

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => submit()}
            className="flex w-full cursor-pointer items-center justify-between gap-2 border-t border-border px-3.5 py-2.5 text-left text-[12.5px] font-medium text-primary transition-colors hover:bg-accent"
          >
            <span className="truncate"><LocalizedText text={"See all results for “"} /><LocalizedText text={trimmed} />”</span>
            <CornerDownLeft className="size-3.5 shrink-0" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
