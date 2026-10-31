"use client";

import {
  addDays,
  addMonths,
  addWeeks,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CalendarPlus, ChevronLeft, ChevronRight, Globe2, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ScheduleDialog } from "@/components/app/schedule-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useClientMounted, useLocalPosts, useLocalTimezone } from "@/lib/app/hooks";
import type { LocalPost } from "@/lib/app/local-posts";
import { cn } from "@/lib/utils";

const WEEK_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dayKey(d: Date) {
  return format(d, "yyyy-MM-dd");
}

function groupByDay(posts: LocalPost[]) {
  const map = new Map<string, LocalPost[]>();
  for (const post of posts) {
    if (!post.scheduledAt) continue;
    const key = dayKey(new Date(post.scheduledAt));
    map.set(key, [...(map.get(key) ?? []), post]);
  }
  return map;
}

function PostChip({ post, onOpen }: { post: LocalPost; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group/chip block w-full truncate rounded-md bg-brand-600 px-2 py-1 text-left text-[11px] font-medium text-white shadow-xs transition hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-brand-600"
      title={post.text}
    >
      <span className="tabular-nums">{post.scheduledAt ? format(new Date(post.scheduledAt), "HH:mm") : ""}</span>{" "}
      <span className="opacity-90">{post.text.slice(0, 24) || "Untitled"}</span>
    </button>
  );
}

export default function CalendarPage() {
  const router = useRouter();
  const posts = useLocalPosts();
  const mounted = useClientMounted();
  const tz = useLocalTimezone();
  const [view, setView] = useState<"month" | "week">("month");
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const [pickedDay, setPickedDay] = useState<Date | null>(null);

  const byDay = useMemo(
    () => groupByDay(posts.filter((p) => p.status === "scheduled")),
    [posts],
  );
  const drafts = posts.filter((p) => p.status === "draft");

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [cursor]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(cursor, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [cursor]);

  function navigate(dir: -1 | 1) {
    setCursor((c) => (view === "month" ? addMonths(c, dir) : addWeeks(c, dir)));
  }

  const headingLabel =
    view === "month"
      ? format(cursor, "MMMM yyyy")
      : `${format(weekDays[0], "d MMM")} – ${format(weekDays[6], "d MMM yyyy")}`;

  if (!mounted) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-40" />
        </div>
        <Skeleton className="h-[520px] w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label={view === "month" ? "Previous month" : "Previous week"}
            className="flex size-9 items-center justify-center rounded-lg text-slate-500 ring-1 ring-slate-200 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-brand-600"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => navigate(1)}
            aria-label={view === "month" ? "Next month" : "Next week"}
            className="flex size-9 items-center justify-center rounded-lg text-slate-500 ring-1 ring-slate-200 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-brand-600"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCursor(new Date())}
            className="ml-1"
          >
            Today
          </Button>
        </div>
        <h2 className="min-w-40 text-lg font-semibold tracking-tight text-slate-950" aria-live="polite">
          {headingLabel}
        </h2>
        <div className="ml-auto flex items-center gap-3">
          <p className="hidden items-center gap-1.5 text-[13px] text-slate-400 md:flex">
            <Globe2 className="size-3.5" aria-hidden />
            {tz}
          </p>
          <Tabs value={view} onValueChange={(v) => setView(v as "month" | "week")}>
            <TabsList aria-label="Calendar view">
              <TabsTrigger value="month">Month</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {posts.some((p) => p.status === "scheduled") && (
        <p className="mt-4 flex items-center gap-2 text-[13px] text-slate-500">
          <Badge variant="neutral">Local preview</Badge>
          Scheduled items below are stored in this browser.
        </p>
      )}

      {/* Month view */}
      {view === "month" && (
        <div className="mt-5 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 shadow-xs">
          <div className="grid grid-cols-7 border-b border-slate-100">
            {WEEK_LABELS.map((d) => (
              <p key={d} className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                {d}
              </p>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthDays.map((day, i) => {
              const dayPosts = byDay.get(dayKey(day)) ?? [];
              const inMonth = isSameMonth(day, cursor);
              const today = isToday(day);
              return (
                <div
                  key={i}
                  className={cn(
                    "group min-h-24 border-b border-r border-slate-100 p-2 transition-colors [&:nth-child(7n)]:border-r-0 [&:nth-last-child(-n+7)]:border-b-0",
                    !inMonth && "bg-slate-50/60",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "flex size-7 items-center justify-center rounded-full text-[13px] tabular-nums",
                        today
                          ? "bg-brand-600 font-semibold text-white"
                          : inMonth
                            ? "font-medium text-slate-700"
                            : "text-slate-400",
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    {inMonth && (
                      <button
                        type="button"
                        onClick={() => setPickedDay(day)}
                        aria-label={`Schedule a post on ${format(day, "EEEE d MMMM")}`}
                        className="flex size-7 items-center justify-center rounded-lg text-slate-300 opacity-0 transition hover:bg-brand-50 hover:text-brand-600 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-brand-600 group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100"
                      >
                        <CalendarPlus className="size-4" aria-hidden />
                      </button>
                    )}
                  </div>
                  <div className="mt-1.5 space-y-1">
                    {dayPosts.slice(0, 2).map((post) => (
                      <PostChip
                        key={post.id}
                        post={post}
                        onOpen={() => router.push(`/posts/${post.id}/edit`)}
                      />
                    ))}
                    {dayPosts.length > 2 && (
                      <p className="px-1 text-[10px] font-medium text-slate-400">
                        +{dayPosts.length - 2} more
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Week view */}
      {view === "week" && (
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
          {weekDays.map((day) => {
            const dayPosts = byDay.get(dayKey(day)) ?? [];
            const today = isToday(day);
            return (
              <section
                key={dayKey(day)}
                aria-label={format(day, "EEEE d MMMM")}
                className={cn(
                  "flex min-h-44 flex-col rounded-2xl bg-white p-3 ring-1 ring-slate-200",
                  today && "ring-2 ring-brand-500",
                )}
              >
                <header className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    {format(day, "EEE")}
                  </p>
                  <span
                    className={cn(
                      "flex size-7 items-center justify-center rounded-full text-[13px] tabular-nums",
                      today ? "bg-brand-600 font-semibold text-white" : "font-medium text-slate-700",
                    )}
                  >
                    {format(day, "d")}
                  </span>
                </header>
                <div className="mt-2.5 flex-1 space-y-1.5">
                  {dayPosts.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-200 px-2 py-3 text-center text-[11px] text-slate-300">
                      Open
                    </p>
                  ) : (
                    dayPosts.map((post) => (
                      <PostChip
                        key={post.id}
                        post={post}
                        onOpen={() => router.push(`/posts/${post.id}/edit`)}
                      />
                    ))
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setPickedDay(day)}
                  className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium text-slate-400 transition hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-600"
                >
                  <CalendarPlus className="size-3.5" aria-hidden />
                  Schedule
                </button>
              </section>
            );
          })}
        </div>
      )}

      {/* Unscheduled drafts */}
      {drafts.length > 0 && (
        <section aria-labelledby="unscheduled-heading" className="mt-8">
          <h2 id="unscheduled-heading" className="text-sm font-semibold text-slate-900">
            Unscheduled drafts
            <span className="ml-2 text-xs font-normal text-slate-400">
              {drafts.length} waiting for a slot
            </span>
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {drafts.map((draft) => (
              <li key={draft.id}>
                <Link
                  href={`/posts/${draft.id}/edit`}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-[13px] font-medium text-slate-600 ring-1 ring-slate-200 transition hover:ring-slate-300 focus-visible:outline-2 focus-visible:outline-brand-600"
                >
                  <Save className="size-3.5 text-slate-400" aria-hidden />
                  {draft.text.slice(0, 32) || "Untitled draft"}
                  {draft.text.length > 32 ? "…" : ""}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ScheduleDialog
        date={pickedDay}
        onClose={() => setPickedDay(null)}
        onOpenComposer={(day) => router.push(`/posts/new?date=${format(day, "yyyy-MM-dd")}`)}
      />
    </div>
  );
}
