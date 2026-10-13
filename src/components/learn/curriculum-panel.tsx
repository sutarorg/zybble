"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { Check, ChevronDown, CirclePlay, FileDown, FileText, ListChecks } from "lucide-react";
import type { Course, Enrollment } from "@/types";
import type { FlatLesson } from "@/lib/learn";
import { progressOf } from "@/lib/learn";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

const TYPE_ICON = {
  video: CirclePlay,
  reading: FileText,
  quiz: ListChecks,
  resource: FileDown,
} as const;

export function CurriculumPanel({
  course,
  enrollment,
  currentLessonId,
  onSelect,
  onToggleComplete,
  className,
}: {
  course: Course;
  enrollment: Enrollment | undefined;
  currentLessonId: string;
  onSelect: (flat: FlatLesson) => void;
  onToggleComplete: (lessonId: string) => void;
  className?: string;
}) {
  const progress = progressOf(course, enrollment);
  const completed = new Set(enrollment?.completedLessons ?? []);
  // Migration for legacy progress display
  const flatAll = course.curriculum.flatMap((s) => s.lessons);
  if (enrollment && completed.size === 0 && enrollment.progress > 0) {
    const n = Math.round((enrollment.progress / 100) * flatAll.length);
    flatAll.slice(0, n).forEach((l) => completed.add(l.id));
  }

  const [open, setOpen] = useState<Set<string>>(() => {
    // expand the section containing the current lesson by default
    const idx = course.curriculum.findIndex((s) => s.lessons.some((l) => l.id === currentLessonId));
    return new Set([course.curriculum[Math.max(0, idx)]?.id ?? ""]);
  });

  const toggleSection = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Auto-open the section containing the current lesson when it changes
  useEffect(() => {
    const idx = course.curriculum.findIndex((s) => s.lessons.some((l) => l.id === currentLessonId));
    if (idx >= 0) {
      setOpen((prev) => {
        const next = new Set(prev);
        next.add(course.curriculum[idx].id);
        return next;
      });
    }
  }, [currentLessonId, course.curriculum]);

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      {/* Progress summary */}
      <div className="border-b border-border px-4 py-3.5">
        <div className="flex items-center justify-between text-[12px]">
          <span className="font-semibold">Course content</span>
          <span className="text-muted-foreground tabular-nums">
            {progress.completedCount}/{progress.totalLessons} · {progress.percent}%
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100">
          <div
            className={cn("h-full rounded-full transition-all duration-500", progress.isCompleted ? "bg-emerald-500" : "bg-primary")}
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      </div>

      {/* Sections */}
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        {course.curriculum.map((section, si) => {
          const done = section.lessons.filter((l) => completed.has(l.id)).length;
          const isOpen = open.has(section.id);
          return (
            <div key={section.id} className="border-b border-border">
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                aria-expanded={isOpen}
                className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60"
              >
                <span className="w-6 shrink-0 text-[11px] font-bold text-zinc-400 tabular-nums">
                  {String(si + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold">{section.title}</span>
                  <span className="mt-0.5 block text-[11px] text-zinc-400">
                    {done}/{section.lessons.length} complete
                  </span>
                </span>
                <ChevronDown className={cn("size-4 shrink-0 text-zinc-400 transition-transform", isOpen && "rotate-180")} aria-hidden />
              </button>

              {isOpen && (
                <ul className="pb-1">
                  {section.lessons.map((lesson, li) => {
                    const Icon = TYPE_ICON[lesson.type];
                    const isDone = completed.has(lesson.id);
                    const isCurrent = lesson.id === currentLessonId;
                    return (
                      <li key={lesson.id}>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() =>
                            onSelect({
                              lesson,
                              section,
                              sectionIndex: si,
                              lessonIndex: li,
                              globalIndex:
                                course.curriculum.slice(0, si).reduce((n, s) => n + s.lessons.length, 0) + li,
                              number: `${si + 1}.${li + 1}`,
                            })
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onSelect({
                                lesson,
                                section,
                                sectionIndex: si,
                                lessonIndex: li,
                                globalIndex:
                                  course.curriculum.slice(0, si).reduce((n, s) => n + s.lessons.length, 0) + li,
                                number: `${si + 1}.${li + 1}`,
                              });
                            }
                          }}
                          aria-current={isCurrent}
                          className={cn(
                            "flex w-full cursor-pointer items-start gap-2.5 border-l-2 px-4 py-2.5 text-left transition-colors",
                            isCurrent
                              ? "border-primary bg-accent/70"
                              : "border-transparent hover:bg-muted/60"
                          )}
                        >
                          {/* completion toggle */}
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={isDone}
                            aria-label={`Mark “${lesson.title}” as ${isDone ? "incomplete" : "complete"}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleComplete(lesson.id);
                            }}
                            className={cn(
                              "mt-0.5 flex size-4.5 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors",
                              isDone
                                ? "border-emerald-500 bg-emerald-500 text-white"
                                : "border-zinc-300 bg-white text-transparent hover:border-primary"
                            )}
                          >
                            <Check className="size-3" strokeWidth={3.5} aria-hidden />
                          </button>
                          <span className="min-w-0 flex-1">
                            <span className={cn("block truncate text-[13px]", isCurrent ? "font-semibold text-primary" : "font-medium", isDone && !isCurrent && "text-muted-foreground")}>
                              {lesson.title}
                            </span>
                            <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-400">
                              <Icon className="size-3" aria-hidden />
                              {formatDuration(lesson.durationMinutes)}
                              {lesson.freePreview && <span className="text-accent-foreground">· Preview</span>}
                            </span>
                          </span>
                          {isCurrent && <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
