"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowUpDown,
  BadgeCheck,
  BookOpen,
  ChevronRight,
  Compass,
  GraduationCap,
  Play,
  Search,
  SearchX,
} from "lucide-react";
import type { Course, Enrollment } from "@/types";
import { COURSES } from "@/data/mock-data";
import { useApp } from "@/components/providers/app-providers";
import { useCommunityCourses } from "@/components/providers/creator-provider";
import { instructorOf, progressOf } from "@/lib/learn";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Tab = "all" | "in-progress" | "completed";
type Sort = "recent" | "progress" | "title" | "enrolled";

function timeAgoShort(iso?: string | null): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function LearningCard({
  course,
  enrollment,
}: {
  course: Course;
  enrollment: Enrollment;
}) {
  const instructor = instructorOf(course);
  const p = progressOf(course, enrollment);

  return (
    <li className="group flex flex-col gap-4 rounded-xl border border-border bg-white p-4 shadow-card transition-all hover:border-zinc-300 hover:shadow-card-hover sm:flex-row">
      {/* 16:9 thumbnail */}
      <Link
        href={`/courses/${course.slug}`}
        className="relative block aspect-video w-full shrink-0 self-start overflow-hidden rounded-lg bg-muted sm:w-52 lg:w-60"
        aria-label={course.title}
      >
        <Image
          src={course.thumbnail}
          alt={course.title}
          fill
          sizes="(max-width: 640px) 100vw, 240px"
          className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
        />
        {p.isCompleted && (
          <span className="absolute inset-0 flex items-center justify-center bg-emerald-950/40">
            <Badge className="bg-emerald-500 text-white">Completed</Badge>
          </span>
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={`/courses/${course.slug}`}
              className="font-display block truncate text-[15px] font-semibold tracking-tight transition-colors hover:text-primary"
            >
              {course.title}
            </Link>
            <div className="mt-1 flex items-center gap-2">
              <Avatar className="size-4.5">
                <AvatarFallback className={cn("text-[7px]", instructor?.avatarColor)}>
                  {instructor?.initials}
                </AvatarFallback>
              </Avatar>
              <span className="truncate text-[12px] text-muted-foreground">{instructor?.name}</span>
            </div>
          </div>
          <Link
            href={`/courses/${course.slug}`}
            aria-label={`Open curriculum for ${course.title}`}
            title="Course details & curriculum"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-muted hover:text-foreground sm:size-8"
          >
            <ChevronRight className="size-4.5" aria-hidden />
          </Link>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between text-[11.5px] text-muted-foreground">
            <span>
              {p.isCompleted
                ? "Course completed"
                : p.completedCount === 0
                  ? "Not started"
                  : `${p.completedCount} of ${p.totalLessons} lessons`}
            </span>
            <span className="tabular-nums">{p.percent}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-100">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                p.isCompleted ? "bg-emerald-500" : "bg-primary"
              )}
              style={{ width: `${p.percent}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11.5px] break-anywhere text-zinc-400">
            Last visited {timeAgoShort(enrollment.lastVisitedAt ?? enrollment.enrolledAt)}
            {p.resumeLesson && !p.isCompleted && (
              <>
                {" "}· up next:{" "}
                <span className="font-medium text-foreground">
                  {p.resumeLesson.number} {p.resumeLesson.lesson.title}
                </span>
              </>
            )}
          </p>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
          {p.isCompleted ? (
            <>
              <Button asChild variant="outline" size="sm">
                <Link href="/certificates">
                  <BadgeCheck aria-hidden />
                  View certificate
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/learn/${course.id}`}>Review course</Link>
              </Button>
            </>
          ) : (
            <Button asChild size="sm">
              <Link href={`/learn/${course.id}`}>
                <Play aria-hidden />
                {p.completedCount === 0 ? "Start course" : "Continue learning"}
              </Link>
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

export function MyLearningClient() {
  const { enrollments, hydrated } = useApp();
  const community = useCommunityCourses();
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("recent");

  const pairs = useMemo(() => {
    const pool = [...community, ...COURSES];
    return enrollments
      .map((enrollment) => ({ enrollment, course: pool.find((c) => c.id === enrollment.courseId) }))
      .filter((x): x is { enrollment: Enrollment; course: Course } => !!x.course);
  }, [enrollments, community]);

  const counts = useMemo(
    () => ({
      all: pairs.length,
      "in-progress": pairs.filter(({ course, enrollment }) => {
        const p = progressOf(course, enrollment);
        return !p.isCompleted;
      }).length,
      completed: pairs.filter(({ course, enrollment }) => progressOf(course, enrollment).isCompleted).length,
    }),
    [pairs]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = pairs.filter(({ course, enrollment }) => {
      const p = progressOf(course, enrollment);
      if (tab === "in-progress" && p.isCompleted) return false;
      if (tab === "completed" && !p.isCompleted) return false;
      if (q && !`${course.title} ${instructorOf(course)?.name ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
    return [...list].sort((a, b) => {
      switch (sort) {
        case "progress":
          return progressOf(b.course, b.enrollment).percent - progressOf(a.course, a.enrollment).percent;
        case "title":
          return a.course.title.localeCompare(b.course.title);
        case "enrolled":
          return +new Date(b.enrollment.enrolledAt) - +new Date(a.enrollment.enrolledAt);
        default:
          return (
            +new Date(b.enrollment.lastVisitedAt ?? b.enrollment.enrolledAt) -
            +new Date(a.enrollment.lastVisitedAt ?? a.enrollment.enrolledAt)
          );
      }
    });
  }, [pairs, tab, query, sort]);

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "all", label: "All", count: counts.all },
    { id: "in-progress", label: "In Progress", count: counts["in-progress"] },
    { id: "completed", label: "Completed", count: counts.completed },
  ];

  return (
    <div className="page-container py-7 sm:py-9">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold tracking-[0.14em] text-primary uppercase">My Learning</p>
          <h1 className="font-display mt-2 text-[26px] font-bold tracking-tight sm:text-[34px]">
            Your courses
          </h1>
          <p className="mt-2 text-[14.5px] text-muted-foreground">
            {hydrated
              ? counts.all > 0
                ? `${counts.all} enrolled · ${counts.completed} completed. Progress saves on this device.`
                : "Enroll in a course and it will show up here."
              : "Loading your courses…"}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/explore">
            <Compass aria-hidden />
            Browse catalog
          </Link>
        </Button>
      </header>

      {/* Tabs */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div
          className="flex max-w-full gap-1 overflow-x-auto rounded-lg bg-muted p-1 scrollbar-hide"
          role="tablist"
          aria-label="Filter courses"
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-3 text-[13px] font-medium whitespace-nowrap transition-all sm:h-8",
                tab === t.id ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
              <span className={cn("rounded px-1 text-[10.5px] tabular-nums", tab === t.id ? "bg-accent text-accent-foreground" : "bg-white text-zinc-400")}>
                {t.count}
              </span>
            </button>
          ))}
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="relative min-w-0 flex-1 sm:flex-none">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-zinc-400" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search enrolled…"
              aria-label="Search enrolled courses"
              className="h-10 w-full rounded-lg border border-input bg-white pr-3 pl-8.5 text-[13px] shadow-xs outline-none placeholder:text-zinc-400 focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/20 sm:h-9 sm:w-52 [&::-webkit-search-cancel-button]:hidden"
            />
          </div>
          <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
            <SelectTrigger className="h-10 w-36 shrink-0 text-[13px] sm:h-9 sm:w-40" aria-label="Sort courses">
              <ArrowUpDown className="size-3.5 text-zinc-400" aria-hidden />
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="recent">Recently viewed</SelectItem>
              <SelectItem value="progress">Most progress</SelectItem>
              <SelectItem value="enrolled">Recently enrolled</SelectItem>
              <SelectItem value="title">Title A–Z</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content */}
      <div className="mt-6">
        {!hydrated ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-44 rounded-xl" />
            ))}
          </div>
        ) : pairs.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="No courses yet"
            description="When you enroll — free or paid — your learning dashboard starts here, with lesson-by-lesson progress."
            action={
              <Button asChild size="lg">
                <Link href="/explore">
                  <BookOpen aria-hidden />
                  Explore Courses
                </Link>
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title={tab === "completed" ? "Nothing completed yet" : "No matching courses"}
            description={
              tab === "completed"
                ? "Finish all lessons in a course and it appears here with a certificate."
                : "Try a different search, or switch tabs."
            }
            action={
              tab === "completed" ? (
                <Button variant="outline" onClick={() => setTab("in-progress")}>
                  View in-progress courses
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => {
                    setQuery("");
                    setTab("all");
                  }}
                >
                  Clear filters
                </Button>
              )
            }
          />
        ) : (
          <ul className="grid gap-4 lg:grid-cols-2">
            {filtered.map(({ course, enrollment }) => (
              <LearningCard key={course.id} course={course} enrollment={enrollment} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
