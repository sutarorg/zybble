"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import { Plus, SearchX, SlidersHorizontal, X } from "lucide-react";
import type { Course, CourseFilters, SortOption } from "@/types";
import {
  DEFAULT_FILTERS,
  activeFilterCount,
  filterCourses,
  sortCourses,
} from "@/lib/courses";
import { CourseCard } from "@/components/courses/course-card";
import { FilterPanel } from "@/components/courses/filter-panel";
import { SortSelect } from "@/components/courses/sort-select";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 6;

/** Human-readable labels for the "applied filters" chips shown above the grid. */
const FILTER_LABELS: { key: keyof CourseFilters; label: string }[] = [
  { key: "price", label: "Price" },
  { key: "level", label: "Level" },
  { key: "duration", label: "Duration" },
  { key: "language", label: "Language" },
];

function filterChipLabel(key: keyof CourseFilters, filters: CourseFilters): string | null {
  if (key === "resources") return filters.resources ? "Downloadable resources" : null;
  const value = filters[key];
  if (value === "all") return null;
  const pretty = String(value).replace(/^\w/, (c) => c.toUpperCase()).replace(/-/g, " ");
  const meta = FILTER_LABELS.find((f) => f.key === key);
  return meta ? `${meta.label}: ${pretty}` : pretty;
}

/**
 * The reusable browse experience: filter panel + sort + result grid +
 * load-more. Used by Explore (results mode), category pages and search.
 */
export function CourseBrowser({
  pool,
  q,
  defaultSort = "popular",
  initialFilters,
  onResetQuery,
  className,
}: {
  /** Pre-scoped pool (e.g. a single category). */
  pool: Course[];
  /** Active global search query (display + filtering). */
  q?: string;
  defaultSort?: SortOption;
  /** Filter preset (e.g. free-only from a "View all" section). */
  initialFilters?: Partial<CourseFilters>;
  /** Clears the parent's q/category so "reset" returns to curated mode. */
  onResetQuery?: () => void;
  className?: string;
}) {
  const [filters, setFilters] = useState<CourseFilters>({ ...DEFAULT_FILTERS, ...initialFilters });
  const [sort, setSort] = useState<SortOption>(defaultSort);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const scopedPool = useMemo(() => {
    if (!q?.trim()) return pool;
    const terms = q.trim().toLowerCase().split(/\s+/);
    return pool.filter((course) => {
      const haystack = [course.title, course.subtitle, course.description, ...course.tags]
        .join(" ")
        .toLowerCase();
      return terms.every((t) => haystack.includes(t));
    });
  }, [pool, q]);

  const results = useMemo(
    () => sortCourses(filterCourses(filters, scopedPool), sort),
    [filters, scopedPool, sort]
  );

  /**
   * "Show more" paging resets whenever the active query changes. The reset is
   * derived (not an effect) so the first paint after a filter change is already
   * correct — no stale extra rows and no cascading re-render.
   */
  const resultKey = `${q ?? ""}|${JSON.stringify(filters)}|${sort}|${scopedPool.length}`;
  const [paging, setPaging] = useState({ key: resultKey, visible: PAGE_SIZE });
  const visible = paging.key === resultKey ? paging.visible : PAGE_SIZE;
  const setVisible = (updater: number | ((v: number) => number)) =>
    setPaging((prev) => {
      const current = prev.key === resultKey ? prev.visible : PAGE_SIZE;
      return {
        key: resultKey,
        visible: typeof updater === "function" ? updater(current) : updater,
      };
    });

  const shown = results.slice(0, visible);
  const remaining = results.length - shown.length;
  const activeCount = activeFilterCount(filters);

  const resetAll = () => {
    setFilters(DEFAULT_FILTERS);
    setVisible(PAGE_SIZE);
    onResetQuery?.();
  };

  const activeChips = (Object.keys(filters) as (keyof CourseFilters)[])
    .map((key) => ({ key, label: filterChipLabel(key, filters) }))
    .filter((chip): chip is { key: keyof CourseFilters; label: string } => Boolean(chip.label));

  return (
    <div className={cn("flex flex-col gap-6 lg:flex-row lg:gap-8", className)}>
      {/* Desktop filter rail */}
      <aside className="hidden w-56 shrink-0 lg:block">
        <div className="sticky top-24">
          <FilterPanel value={filters} onChange={setFilters} pool={scopedPool} />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Toolbar */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13.5px] text-muted-foreground">
            <span className="font-semibold text-foreground">{results.length}</span>{" "}
            {results.length === 1 ? "result" : "results"}
            {q?.trim() && (
              <>
                {" "}for <span className="font-medium text-foreground">“{q.trim()}”</span>
              </>
            )}
          </p>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:flex-none">
            <Button
              variant="outline"
              size="default"
              className="lg:hidden"
              onClick={() => setDrawerOpen(true)}
            >
              <SlidersHorizontal aria-hidden />
              Filters
              {activeCount > 0 && (
                <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-md bg-accent px-1 text-[10.5px] font-semibold text-accent-foreground">
                  {activeCount}
                </span>
              )}
            </Button>
            <SortSelect
              value={sort}
              onChange={setSort}
              className="w-[9.5rem] min-w-0 flex-1 sm:w-52 sm:flex-none"
            />
          </div>
        </div>

        {/* Applied filters (helpful on phones where the rail is hidden) */}
        {activeChips.length > 0 && (
          <ul className="mb-4 flex flex-wrap items-center gap-1.5">
            {activeChips.map((chip) => (
              <li key={chip.key}>
                <button
                  type="button"
                  onClick={() =>
                    setFilters((prev) => ({
                      ...prev,
                      [chip.key]: chip.key === "resources" ? false : "all",
                    }))
                  }
                  className="flex cursor-pointer items-center gap-1 rounded-full border border-violet-200 bg-accent py-1 pr-2 pl-2.5 text-[12px] font-medium text-accent-foreground transition-colors hover:bg-violet-100 focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:outline-none"
                >
                  {chip.label}
                  <X className="size-3" aria-hidden />
                  <span className="sr-only">Remove filter</span>
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => setFilters(DEFAULT_FILTERS)}
                className="cursor-pointer rounded-full px-2 py-1 text-[12px] font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:outline-none"
              >
                Clear all
              </button>
            </li>
          </ul>
        )}

        {/* Mobile / tablet filter drawer */}
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent side="left" className="w-80 overflow-y-auto p-5 pb-safe scrollbar-thin">
            <SheetHeader className="p-0 pb-4">
              <SheetTitle>Filter courses</SheetTitle>
            </SheetHeader>
            <FilterPanel value={filters} onChange={setFilters} pool={scopedPool} />
            <Button className="mt-6 mb-2 w-full" onClick={() => setDrawerOpen(false)}>
              Show {results.length} {results.length === 1 ? "result" : "results"}
            </Button>
          </SheetContent>
        </Sheet>

        {/* Results */}
        {results.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No courses match your filters"
            description="Try broadening your search, removing a filter or two, or exploring another category."
            action={
              <Button variant="outline" onClick={resetAll}>
                Clear all filters
              </Button>
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
            {remaining > 0 && (
              <div className="mt-8 flex flex-col items-center gap-2">
                <Button variant="outline" size="lg" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                  <Plus aria-hidden />
                  Show {Math.min(remaining, PAGE_SIZE)} more of {results.length} courses
                </Button>
                <p className="text-[12px] text-zinc-400">
                  Showing {shown.length} of {results.length}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
