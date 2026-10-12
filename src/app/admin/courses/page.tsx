"use client";

import * as React from "react";
import { use, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowUpDown,
  Ban,
  ClipboardCheck,
  Eye,
  RotateCcw,
  Search,
  SearchX,
  SlidersHorizontal,
} from "lucide-react";
import type { CourseStatus, CreatorCourse } from "@/types";
import { CATEGORIES, COURSES } from "@/data/mock-data";
import { getInstructorById } from "@/lib/courses";
import { useAdmin } from "@/components/providers/admin-provider";
import { useCreator } from "@/components/providers/creator-provider";
import { STATUS_META } from "@/lib/creator";
import { formatDate, formatPrice } from "@/lib/format";
import { StatusBadge } from "@/components/creator/status-badge";
import { ActionButton } from "@/components/admin/action-button";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { useKeyedState } from "@/lib/hooks";

const PAGE_SIZE = 6;
type Tab = CourseStatus | "all";
type Sort = "updated" | "submitted" | "price" | "title";

const TABS: Tab[] = ["all", "pending", "changes_requested", "published", "rejected", "draft"];

export default function AdminCoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  const sp = use(searchParams);
  const initialTab = typeof sp.tab === "string" && TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : "all";
  const initialQ = typeof sp.q === "string" ? sp.q : "";

  const { hydrated, approveCourse, rejectCourse, returnToQueue } = useAdmin();
  const { courses } = useCreator();
  /* Tab + query follow the URL: a new `?tab=`/`?q=` (e.g. the header search)
     resets them without a stale-state effect. */
  const urlKey = `${initialTab}|${initialQ}`;
  const [tab, setTab] = useKeyedState<Tab>(urlKey, initialTab);
  const [query, setQuery] = useKeyedState(urlKey, initialQ);
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<Sort>("updated");
  /* Page number resets whenever the filter set changes (derived, not an effect). */
  const [page, setPage] = useKeyedState(`${tab}|${query}|${category}|${sort}`, 1);

  /* Local-only courses (creator workspace) + aliases of static catalog copies.
     Statik catalog originals are managed under "published". */
  const rows = useMemo(() => courses, [courses]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = rows.filter((c) => {
      if (tab !== "all" && c.status !== tab) return false;
      if (category !== "all" && c.category !== category) return false;
      if (q) {
        const instr = getInstructorById(c.instructorId);
        if (!`${c.title} ${instr?.name ?? ""}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
    return [...list].sort((a, b) => {
      switch (sort) {
        case "title":
          return a.title.localeCompare(b.title);
        case "price":
          return b.price - a.price;
        case "submitted":
          return +new Date(a.lastUpdated) - +new Date(b.lastUpdated); // oldest first = queue order
        default:
          return +new Date(b.lastUpdated) - +new Date(a.lastUpdated);
      }
    });
  }, [rows, tab, category, query, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const pageItems = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold tracking-[0.14em] text-primary uppercase">Moderation</p>
        <h1 className="font-display mt-1.5 text-[26px] font-bold tracking-tight sm:text-3xl">
          Course moderation & management
        </h1>
        <p className="mt-1.5 max-w-2xl text-[14px] text-muted-foreground">
          Review creator submissions. Approvals publish community courses to Explore on this
          device; decisions update the shared mock state. Drafts are never purchasable.
        </p>
      </div>

      {/* Status tabs */}
      <div className="flex snap-x gap-2 overflow-x-auto pb-1 scrollbar-hide" role="tablist" aria-label="Moderation status">
        {TABS.map((t) => {
          const meta = t === "all" ? null : STATUS_META[t];
          const active = tab === t;
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t)}
              className={cn(
                "flex h-8.5 shrink-0 cursor-pointer snap-start items-center gap-1.5 rounded-full border px-3.5 text-[12.5px] font-medium whitespace-nowrap transition-all",
                active ? "border-primary bg-primary text-white shadow-sm" : "border-border bg-white text-muted-foreground hover:border-zinc-300 hover:text-foreground"
              )}
            >
              {t === "all" ? "All" : meta!.label}
              <span className={cn("rounded px-1 text-[10.5px] tabular-nums", active ? "bg-white/20" : "bg-muted")}>
                {counts[t] ?? 0}
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
            placeholder="Search title or creator…"
            aria-label="Search submissions"
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
        <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
          <SelectTrigger className="w-44" aria-label="Sort submissions">
            <SlidersHorizontal className="size-3.5 text-zinc-400" aria-hidden />
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="updated">Recently updated</SelectItem>
            <SelectItem value="submitted">Oldest first (queue)</SelectItem>
            <SelectItem value="price">Highest price</SelectItem>
            <SelectItem value="title">Title A–Z</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {!hydrated ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={rows.length === 0 ? ClipboardCheck : SearchX}
          title={rows.length === 0 ? "No submissions yet" : "Nothing matches"}
          description={
            rows.length === 0
              ? "When creators submit courses for review, they appear in this queue."
              : "Try another status tab, category or search term."
          }
          action={
            rows.length > 0 ? (
              <Button
                variant="outline"
                onClick={() => {
                  setTab("all");
                  setQuery("");
                  setCategory("all");
                }}
              >
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-border bg-white shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-200 text-left">
                <thead>
                  <tr className="border-b border-border text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
                    <th className="py-3 pr-4 pl-5">Course</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3">Submitted</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="py-3 pr-5 pl-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((course) => {
                    const instructor = getInstructorById(course.instructorId);
                    return (
                      <tr key={course.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                        <td className="max-w-72 py-3 pr-4 pl-5">
                          <div className="flex items-center gap-3">
                            {/* 16:9 thumbnail */}
                            <Link
                              href={`/admin/courses/${course.id}`}
                              className="relative block aspect-video w-24 shrink-0 overflow-hidden rounded-md border border-border bg-muted"
                            >
                              <Image src={course.thumbnail} alt="" fill sizes="96px" className="object-cover" />
                            </Link>
                            <div className="min-w-0">
                              <Link href={`/admin/courses/${course.id}`} className="block truncate text-[13px] font-semibold hover:text-primary">
                                {course.title}
                              </Link>
                              <p className="truncate text-[11.5px] text-muted-foreground">{instructor?.name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[12.5px] text-muted-foreground">
                          {CATEGORIES.find((c) => c.slug === course.category)?.name}
                        </td>
                        <td className="px-4 py-3 text-[12.5px] whitespace-nowrap tabular-nums">
                          {course.price === 0 ? <span className="font-semibold text-success">Free</span> : formatPrice(course.price)}
                        </td>
                        <td className="px-4 py-3 text-[12px] whitespace-nowrap text-muted-foreground">
                          {formatDate(course.lastUpdated)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={course.status} />
                        </td>
                        <td className="py-3 pr-5 pl-4">
                          <div className="flex items-center justify-end gap-1">
                            {course.status === "pending" && (
                              <>
                                <ActionButton
                                  label="Approve"
                                  icon={ClipboardCheck}
                                  size="sm"
                                  confirmTitle={`Approve “${course.title}”?`}
                                  confirmBody="The course becomes published and the community copy appears in Explore on this device."
                                  confirmLabel="Approve & publish"
                                  onAction={() => approveCourse(course.id)}
                                  toastText={`“${course.title}” published (simulated)`}
                                />
                                <ActionButton
                                  label="Reject"
                                  icon={Ban}
                                  variant="outline"
                                  size="sm"
                                  danger
                                  confirmTitle={`Reject “${course.title}”?`}
                                  confirmBody="You'll be able to send the creator a required note on the detail page. Prefer requesting changes for fixable issues."
                                  confirmLabel="Reject submission"
                                  onAction={() => rejectCourse(course.id, "Rejected from the moderation table — see the course detail page for full notes. (Simulated)")}
                                  toastText="Submission rejected (simulated)"
                                />
                              </>
                            )}
                            {(course.status === "published" || course.status === "rejected" || course.status === "changes_requested") && course.id !== "crs_chatgpt" && course.id !== "crs_prompt" && (
                              <ActionButton
                                label="Queue"
                                icon={RotateCcw}
                                variant="ghost"
                                size="sm"
                                confirmTitle="Return to review queue?"
                                confirmBody="The course moves back to Pending Review in this local simulation."
                                confirmLabel="Return to queue"
                                onAction={() => returnToQueue(course.id)}
                                toastText="Course returned to the queue"
                              />
                            )}
                            <Button asChild variant="outline" size="sm">
                              <Link href={`/admin/courses/${course.id}`}>
                                <Eye aria-hidden />
                                Review
                              </Link>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
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
