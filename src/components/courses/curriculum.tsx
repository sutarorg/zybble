"use client";

import { LocalizedText, useTranslate } from "@/components/providers/localized-text";
import { CirclePlay, FileText, FileDown, ListChecks, Lock } from "lucide-react";
import type { Course } from "@/types";
import { formatDuration } from "@/lib/format";
import { lessonDurationLabel } from "@/lib/learn";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const LESSON_ICON = {
  video: CirclePlay,
  reading: FileText,
  quiz: ListChecks,
  resource: FileDown,
} as const;

export function Curriculum({ course }: { course: Course }) {
  const translateUi = useTranslate();
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
        <span>
          <span className="font-semibold text-foreground">{course.curriculum.length}</span><LocalizedText text={"sections"} /></span>
        <span aria-hidden>·</span>
        <span>
          <span className="font-semibold text-foreground">{course.lessonsCount}</span><LocalizedText text={"lessons"} /></span>
        <span aria-hidden>·</span>
        <span>
          <span className="font-semibold text-foreground"><LocalizedText text={formatDuration(course.durationMinutes)} /></span><LocalizedText text={" "} /><LocalizedText text={"total"} /></span>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-white">
        <Accordion type="single" collapsible defaultValue={course.curriculum[0]?.id}>
          {course.curriculum.map((section, i) => {
            const minutes = section.lessons.reduce((a, l) => a + l.durationMinutes, 0);
            return (
              <AccordionItem key={section.id} value={section.id} className="px-4 sm:px-5">
                <AccordionTrigger className="py-4 hover:no-underline">
                  <span className="flex min-w-0 flex-col gap-0.5 text-left sm:flex-row sm:items-center sm:gap-3">
                    <span className="truncate text-[14px] font-semibold">
                      <span className="mr-2 text-zinc-400 tabular-nums">
                        <LocalizedText text={String(i + 1).padStart(2, "0")} />
                      </span>
                      <LocalizedText text={section.title} />
                    </span>
                    <span className="text-[12px] font-normal text-zinc-400">
                      {section.lessons.length}<LocalizedText text={"lessons ·"} /><LocalizedText text={formatDuration(minutes)} />
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="flex flex-col gap-0.5 pb-2">
                    {section.lessons.map((lesson) => {
                      const Icon = LESSON_ICON[lesson.type];
                      return (
                        <li key={lesson.id}>
                          <button
                            type="button"
                            onClick={() =>
                              lesson.freePreview
                                ? toast.info("Free preview — enroll to unlock the full player ")
                                : toast.info("Enroll to unlock this lesson ")
                            }
                            className="group flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted"
                          >
                            <Icon
                              className="size-4 shrink-0 text-zinc-400 transition-colors group-hover:text-primary"
                              aria-hidden
                            />
                            <span className="min-w-0 flex-1 truncate text-[13.5px] text-foreground">
                              <LocalizedText text={lesson.title} />
                            </span>
                            {lesson.downloadable && (
                              <FileDown className="size-3.5 shrink-0 text-zinc-300" aria-label={translateUi("Downloadable resource")} />
                            )}
                            {lesson.freePreview && (
                              <Badge variant="violet"><LocalizedText text={"Preview"} /></Badge>
                            )}
                            {lesson.type === "video" && !lesson.freePreview && (
                              <Lock className="size-3 shrink-0 text-zinc-300" aria-hidden />
                            )}
                            <span className="shrink-0 text-[12px] text-zinc-400 tabular-nums">
                              <LocalizedText text={lessonDurationLabel(lesson)} />
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
    </div>
  );
}
