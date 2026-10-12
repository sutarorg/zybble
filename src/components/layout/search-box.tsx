"use client";

import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { CornerDownLeft, Search, UserRound } from "lucide-react";
import { INSTRUCTORS } from "@/data/mock-data";
import { searchCourses } from "@/lib/courses";
import { useCommunityCourses } from "@/components/providers/creator-provider";
import { cn } from "@/lib/utils";

export function SearchBox({ className }: { className?: string }) {
  const router = useRouter();
  const communityCourses = useCommunityCourses();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [shortcut, setShortcut] = useState("Ctrl K");

  useEffect(() => {
    const isMac = navigator.platform.toLowerCase().includes("mac");
    setShortcut(isMac ? "⌘K" : "Ctrl K");
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const trimmed = query.trim();
  const searchPool = trimmed ? [...searchCourses(trimmed), ...communityCourses.filter((c) => `${c.title} ${c.subtitle}`.toLowerCase().includes(trimmed.toLowerCase()))] : [];
  // de-dupe + cap
  const seen = new Set<string>();
  const courseMatches = searchPool.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true))).slice(0, 4);
  const instructorMatches = trimmed
    ? INSTRUCTORS.filter((i) => i.name.toLowerCase().includes(trimmed.toLowerCase())).slice(0, 2)
    : [];
  const hasResults = courseMatches.length + instructorMatches.length > 0;

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!trimmed) return;
    setOpen(false);
    router.push(`/explore?q=${encodeURIComponent(trimmed)}`);
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
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          placeholder="Search courses, topics, or instructors…"
          aria-label="Search courses"
          className="h-10 w-full rounded-full border border-transparent bg-muted pr-20 pl-10 text-sm transition-all outline-none placeholder:text-zinc-400 focus:border-primary/40 focus:bg-white focus:ring-2 focus:ring-ring/15 [&::-webkit-search-cancel-button]:hidden"
        />
        <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 items-center gap-1 rounded-md border border-border bg-white px-1.5 py-0.5 text-[10.5px] font-medium text-zinc-400 sm:flex">
          {shortcut}
        </kbd>
      </form>

      {open && trimmed.length > 0 && (
        <div className="absolute top-12 right-0 left-0 z-50 overflow-hidden rounded-xl border border-border bg-white shadow-pop">
          {hasResults ? (
            <div className="max-h-80 overflow-y-auto p-1.5 scrollbar-thin">
              {courseMatches.length > 0 && (
                <>
                  <p className="px-2.5 pt-1.5 pb-1 text-[10.5px] font-semibold tracking-wider text-zinc-400 uppercase">
                    Courses
                  </p>
                  {courseMatches.map((course) => (
                    <Link
                      key={course.id}
                      href={`/courses/${course.slug}`}
                      className="flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-muted"
                    >
                      <span className="relative block h-9 w-16 shrink-0 overflow-hidden rounded-md border border-border">
                        <Image
                          src={course.thumbnail}
                          alt=""
                          fill
                          sizes="64px"
                          className="object-cover"
                        />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium">{course.title}</span>
                        <span className="block truncate text-[11.5px] text-muted-foreground">
                          {course.price === 0 ? "Free" : `$${course.price}`} · {course.level}
                        </span>
                      </span>
                    </Link>
                  ))}
                </>
              )}
              {instructorMatches.length > 0 && (
                <>
                  <p className="px-2.5 pt-2 pb-1 text-[10.5px] font-semibold tracking-wider text-zinc-400 uppercase">
                    Instructors
                  </p>
                  {instructorMatches.map((ins) => (
                    <Link
                      key={ins.id}
                      href={`/instructors/${ins.username}`}
                      className="flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-muted"
                    >
                      <span
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                          ins.avatarColor
                        )}
                      >
                        {ins.initials}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium">{ins.name}</span>
                        <span className="flex items-center gap-1 truncate text-[11.5px] text-muted-foreground">
                          <UserRound className="size-3" /> {ins.headline}
                        </span>
                      </span>
                    </Link>
                  ))}
                </>
              )}
            </div>
          ) : (
            <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">
              No matches for “{trimmed}” — try another topic.
            </p>
          )}
          <button
            type="button"
            onMouseDown={submit}
            className="flex w-full cursor-pointer items-center justify-between border-t border-border bg-muted/60 px-4 py-2.5 text-[13px] font-medium text-primary transition-colors hover:bg-muted"
          >
            <span className="flex items-center gap-2">
              <Search className="size-3.5" aria-hidden />
              See all results for “{trimmed}”
            </span>
            <span className="flex items-center gap-1 text-[11.5px] text-zinc-400">
              <CornerDownLeft className="size-3" aria-hidden /> Enter
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
