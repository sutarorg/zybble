"use client";

import { LocalizedText, useTranslate } from "@/components/providers/localized-text";
import * as React from "react";
import { useState } from "react";
import { Check, ChevronDown, CirclePlay, FileDown, FileText, ListChecks } from "lucide-react";
import type { Course, Enrollment } from "@/types";
import type { FlatLesson } from "@/lib/learn";
import { lessonDurationLabel, progressOf } from "@/lib/learn";
import { cn } from "@/lib/utils";

const TYPE_ICON = {
  video: CirclePlay,
  reading: FileText,
  quiz: ListChecks,
  resource: FileDown,
} as const;

/** Index of the section that owns a lesson (falls back to the first one). */
function sectionIndexOf(course: Course, lessonId: string): number {
  const idx = course.curriculum.findIndex((s) => s.lessons.some((l) => l.id === lessonId));
  return Math.max(0, idx);
}

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
  const translateUi = useTranslate();
  const progress = progressOf(course, enrollment);
  const completed = new Set(enrollment?.completedLessons ?? []);
  // Migration for legacy progress display
  const flatAll = course.curriculum.flatMap((s) => s.lessons);
  if (enrollment && completed.size === 0 && enrollment.progress > 0) {
    const n = Math.round((enrollment.progress / 100) * flatAll.length);
    flatAll.slice(0, n).forEach((l) => completed.add(l.id));
  }

  /*
   * Exactly one module can be open. Moving to another lesson (Next, Previous or
   * a click in the list) closes the open module with a swipe-up collapse and
   * swipes the new module open, so the learner never loses their place.
   */
  const [openId, setOpenId] = useState<string | null>(
    () => course.curriculum[sectionIndexOf(course, currentLessonId)]?.id ?? null
  );

  // Derive expansion on lesson changes instead of a cascading effect update.
  const [trackedLesson, setTrackedLesson] = useState(currentLessonId);
  if (trackedLesson !== currentLessonId) {
    setTrackedLesson(currentLessonId);
    const section = course.curriculum[sectionIndexOf(course, currentLessonId)];
    if (section) setOpenId(section.id);
  }

  const toggleSection = (id: string) => setOpenId((prev) => (prev === id ? null : id));

  const openLesson = (sectionIndex: number, lessonIndex: number) => {
    const section = course.curriculum[sectionIndex];
    const lesson = section?.lessons[lessonIndex];
    if (!section || !lesson) return;
    onSelect({
      lesson,
      section,
      sectionIndex,
      lessonIndex,
      globalIndex:
        course.curriculum.slice(0, sectionIndex).reduce((n, s) => n + s.lessons.length, 0) + lessonIndex,
      number: `${sectionIndex + 1}.${lessonIndex + 1}`,
    });
  };

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      {/* Progress summary */}
      <div className="border-b border-border px-4 py-3.5">
        <div className="flex items-center justify-between text-[12px]">
          <span className="font-semibold"><LocalizedText text={"Course content"} /></span>
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
          const isOpen = openId === section.id;
          return (
            <div key={section.id} className="border-b border-border">
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                aria-expanded={isOpen}
                aria-controls={`course-module-${section.id}`}
                className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60"
              >
                <span className="w-6 shrink-0 text-[11px] font-bold text-zinc-400 tabular-nums">
                  <LocalizedText text={String(si + 1).padStart(2, "0")} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold"><LocalizedText text={section.title} /></span>
                  <span className="mt-0.5 block text-[11px] text-zinc-400">
                    {done}/{section.lessons.length}<LocalizedText text={"complete"} /></span>
                </span>
                <ChevronDown className={cn("size-4 shrink-0 text-zinc-400 transition-transform duration-300", isOpen && "rotate-180")} aria-hidden />
              </button>

              {/*
               * Height is animated with the grid-rows trick (0fr → 1fr), which
               * transitions reliably without measuring DOM heights. The closed
               * state also lifts up and fades — the "swipe up" close.
               */}
              <div
                id={`course-module-${section.id}`}
                role="region"
                aria-hidden={!isOpen}
                className={cn(
                  "grid transition-[grid-template-rows,opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  isOpen
                    ? "translate-y-0 grid-rows-[1fr] opacity-100"
                    : "pointer-events-none -translate-y-3 grid-rows-[0fr] opacity-0"
                )}
              >
                <div className="overflow-hidden">
                  <ul className="pb-1">
                    {section.lessons.map((lesson, li) => {
                      const Icon = TYPE_ICON[lesson.type];
                      const isDone = completed.has(lesson.id);
                      const isCurrent = lesson.id === currentLessonId;
                      return (
                        <li key={lesson.id}>
                          <div
                            role="button"
                            tabIndex={isOpen ? 0 : -1}
                            onClick={() => openLesson(si, li)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                openLesson(si, li);
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
                              aria-label={translateUi(`Mark “${lesson.title}” as ${isDone ? "incomplete" : "complete"}`)}
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
                                <LocalizedText text={lesson.title} />
                              </span>
                              <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-400">
                                <Icon className="size-3" aria-hidden />
                                <LocalizedText text={lessonDurationLabel(lesson)} />
                                {lesson.freePreview && <span className="text-accent-foreground"><LocalizedText text={"· Preview"} /></span>}
                              </span>
                            </span>
                            {isCurrent && <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
