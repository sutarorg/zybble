"use client";

import * as React from "react";
import { Check, ChevronDown, CirclePlay, FileText, ListChecks, Lock } from "lucide-react";
import type { FlatLesson, FlatSection } from "@/lib/learn";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  video: CirclePlay,
  reading: FileText,
  quiz: ListChecks,
};

/**
 * Curriculum rail.
 *
 * The section/lesson tree and the completion set are both produced by the
 * server (`getLearningCourse`), and marking a lesson complete posts to a
 * server action that re-checks the entitlement. Nothing here decides access.
 */
export function CurriculumPanel({
  sections,
  lessons,
  completedLessonIds,
  currentLessonId,
  onSelect,
  onToggleComplete,
  className,
}: {
  sections: FlatSection[];
  lessons: FlatLesson[];
  /** Lesson ids the server has on record as complete. */
  completedLessonIds: string[];
  currentLessonId: string | null;
  onSelect: (lessonId: string) => void;
  onToggleComplete: (lessonId: string) => void;
  className?: string;
}) {
  const completed = React.useMemo(() => new Set(completedLessonIds), [completedLessonIds]);

  const [open, setOpen] = React.useState<Set<string>>(() => {
    const owner = sections.find((section) => section.lessons.some((lesson) => lesson.id === currentLessonId));
    return new Set(owner ? [owner.id] : sections.slice(0, 1).map((section) => section.id));
  });

  // Expand the current lesson's section when the lesson changes, during render
  // rather than in a cascading effect.
  const [trackedLesson, setTrackedLesson] = React.useState(currentLessonId);
  if (trackedLesson !== currentLessonId) {
    setTrackedLesson(currentLessonId);
    const owner = sections.find((section) => section.lessons.some((lesson) => lesson.id === currentLessonId));
    if (owner) setOpen((previous) => new Set([...previous, owner.id]));
  }

  const toggleSection = (id: string) =>
    setOpen((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const total = lessons.length;
  const done = lessons.filter((lesson) => completed.has(lesson.id)).length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="border-b border-border px-4 py-3.5">
        <div className="flex items-center justify-between text-[12px]">
          <span className="font-semibold">Course content</span>
          <span className="text-muted-foreground tabular-nums">
            {done}/{total} · {percent}%
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100">
          <div
            className={cn("h-full rounded-full transition-all duration-500", percent === 100 ? "bg-emerald-500" : "bg-primary")}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        {sections.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13px] text-muted-foreground">
            This course has no lessons yet.
          </p>
        ) : null}

        {sections.map((section, sectionIndex) => {
          const sectionDone = section.lessons.filter((lesson) => completed.has(lesson.id)).length;
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
                  {String(sectionIndex + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold">{section.title}</span>
                  <span className="mt-0.5 block text-[11px] text-zinc-400">
                    {sectionDone}/{section.lessons.length} complete
                  </span>
                </span>
                <ChevronDown className={cn("size-4 shrink-0 text-zinc-400 transition-transform", isOpen && "rotate-180")} aria-hidden />
              </button>

              {isOpen ? (
                <ul className="pb-1">
                  {section.lessons.map((lesson) => {
                    const Icon = TYPE_ICON[lesson.kind] ?? CirclePlay;
                    const isDone = completed.has(lesson.id);
                    const isCurrent = lesson.id === currentLessonId;
                    return (
                      <li key={lesson.id}>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => onSelect(lesson.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              onSelect(lesson.id);
                            }
                          }}
                          aria-current={isCurrent}
                          className={cn(
                            "flex w-full cursor-pointer items-start gap-2.5 border-l-2 px-4 py-2.5 text-left transition-colors",
                            isCurrent ? "border-primary bg-accent/70" : "border-transparent hover:bg-muted/60"
                          )}
                        >
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={isDone}
                            aria-label={`Mark “${lesson.title}” as ${isDone ? "incomplete" : "complete"}`}
                            onClick={(event) => {
                              event.stopPropagation();
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
                            <span
                              className={cn(
                                "block truncate text-[13px]",
                                isCurrent ? "font-semibold text-primary" : "font-medium",
                                isDone && !isCurrent && "text-muted-foreground"
                              )}
                            >
                              {lesson.title}
                            </span>
                            <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-400">
                              <Icon className="size-3" aria-hidden />
                              {formatDuration(lesson.durationMinutes)}
                              {lesson.isPreview ? <span className="text-accent-foreground">· Preview</span> : null}
                              {lesson.kind === "video" && !lesson.playbackReady ? (
                                <span className="inline-flex items-center gap-0.5">
                                  · processing
                                </span>
                              ) : null}
                              {!lesson.playbackReady && lesson.kind !== "video" ? <Lock className="size-3" aria-hidden /> : null}
                            </span>
                          </span>
                          {isCurrent ? <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden /> : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}