"use client";

import * as React from "react";
import { useMemo, useState, use } from "react";
import Link from "next/link";
import { Plus, Search, SlidersHorizontal, LibraryBig, SearchX } from "lucide-react";
import type { CourseStatus, CreatorCourse } from "@/types";
import { useCreator } from "@/components/providers/creator-provider";
import { STATUS_META } from "@/lib/creator";
import { CATEGORIES } from "@/data/mock-data";
import { CoursesTable } from "@/components/creator/courses-table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 5;
const STATUS_ORDER: (CourseStatus | "all")[] = [
  "all",
  "draft",
  "pending",
  "published",
  "changes_requested",
  "rejected",
];

type SortKey = "updated" | "title" | "students" | "revenue";

export default function CreatorCoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = use(searchParams);
  const { courses, hydrated } = useCreator();

  const [query, setQuery] = useState(typeof q === "string" ? q : "");
  const [status, setStatus] = useState<CourseStatus | "all">("all");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<SortKey>("updated");
  const [page, setPage] = useState(1);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: courses.length };
    for (const c of courses) counts[c.status] = (counts[c.status] ?? 0) + 1;
    return counts;
  }, [courses]);

  const filtered = useMemo(() => {
    const t = query.trim().toLowerCase();
    let list = courses.filter((c) => {
      if (status !== "all" && c.status !== status) return false;
      if (category !== "all" && c.category !== category) return false;
      if (t && !`${c.title} ${c.subtitle}`.toLowerCase().includes(t)) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      switch (sort) {
        case "title":
          return a.title.localeCompare(b.title);
        case "students":
          return b.studentsCount - a.studentsCount;
        case "revenue":
          return b.demoRevenue - a.demoRevenue;
        default:
          return +new Date(b.lastUpdated) - +new Date(a.lastUpdated);
      }
    });
    return list;
  }, [courses, query, status, category, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const pageItems = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  React.useEffect(() => {
    setPage(1);
  }, [query, status, category, sort]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold tracking-[0.14em] text-primary uppercase">Creator Studio</p>
          <h1 className="font-display mt-1.5 text-[26px] font-bold tracking-tight sm:text-3xl">My Courses</h1>
          <p className="mt-1.5 text-[14px] text-muted-foreground">
            {hydrated ? `${courses.length} ${courses.length === 1 ? "course" : "courses"} in your studio.` : "Loading your courses…"}
          </p>
        </div>
        <Button asChild size="lg">
          <Link href="/creator/courses/new">
            <Plus aria-hidden />
            Create Course
          </Link>
        </Button>
      </div>

      {/* Status chips */}
      <div className="flex snap-x gap-2 overflow-x-auto pb-1 scrollbar-hide" role="tablist" aria-label="Filter by status">
        {STATUS_ORDER.map((s) => {
          const meta = s === "all" ? null : STATUS_META[s];
          const active = status === s;
          const count = statusCounts[s] ?? 0;
          return (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setStatus(s)}
              className={cn(
                "flex h-8.5 shrink-0 cursor-pointer snap-start items-center gap-1.5 rounded-full border px-3.5 text-[12.5px] font-medium whitespace-nowrap transition-all",
                active
                  ? "border-primary bg-primary text-white shadow-sm"
                  : "border-border bg-white text-muted-foreground hover:border-zinc-300 hover:text-foreground"
              )}
            >
              {s === "all" ? "All" : meta!.label}
              <span className={cn("rounded px-1 text-[10.5px] tabular-nums", active ? "bg-white/20" : "bg-muted")}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your courses…"
            aria-label="Search your courses"
            className="h-9.5 w-full rounded-lg border border-input bg-white pr-3 pl-9 text-sm shadow-xs outline-none placeholder:text-zinc-400 focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/20 [&::-webkit-search-cancel-button]:hidden"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-44" aria-label="Filter by category">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.slug} value={c.slug}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="w-44" aria-label="Sort courses">
            <SlidersHorizontal className="size-3.5 text-zinc-400" aria-hidden />
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="updated">Recently updated</SelectItem>
            <SelectItem value="title">Title A–Z</SelectItem>
            <SelectItem value="students">Most students</SelectItem>
            <SelectItem value="revenue">Highest revenue</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {!hydrated ? (
        <Skeleton className="h-80 rounded-xl" />
      ) : filtered.length === 0 ? (
        courses.length === 0 ? (
          <EmptyState
            icon={LibraryBig}
            title="No courses yet"
            description="Your studio is empty. Create your first course — it only takes a few minutes."
            action={
              <Button asChild>
                <Link href="/creator/courses/new">
                  <Plus aria-hidden /> Create Course
                </Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={SearchX}
            title="Nothing matches"
            description="Try a different search term or clear the active status and category filters."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setQuery("");
                  setStatus("all");
                  setCategory("all");
                }}
              >
                Clear filters
              </Button>
            }
          />
        )
      ) : (
        <>
          <CoursesTable courses={pageItems} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[12.5px] text-muted-foreground">
              Page {current} of {totalPages} · {filtered.length} {filtered.length === 1 ? "course" : "courses"}
            </p>
            <Pagination page={current} totalPages={totalPages} onChange={setPage} />
          </div>
        </>
      )}
    </div>
  );
}
