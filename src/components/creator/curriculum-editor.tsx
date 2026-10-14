"use client";

import { LocalizedText, useTranslate } from "@/components/providers/localized-text";
import * as React from "react";
import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Eye,
  ListTree,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { Course, CurriculumSection, Lesson } from "@/types";
import { starterSection, uid } from "@/lib/creator";
import { lessonDurationLabel } from "@/lib/learn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Curriculum } from "@/components/courses/curriculum";
import { EmptyState } from "@/components/ui/empty-state";
import {
  LessonWizardDialog,
  LESSON_TYPES as LESSON_TYPE_META,
  type LessonDraft,
  draftToLesson,
} from "@/components/creator/lesson-wizard";
import { cn } from "@/lib/utils";

/** Lesson type metadata (video · quiz · resource) shared with the wizard. */
const LESSON_TYPES = LESSON_TYPE_META;

/** Compact "meta" line shown under a lesson row in the editor. */
function lessonSummary(lesson: Lesson): string {
  if (lesson.type === "quiz") {
    const count = lesson.quiz?.length ?? 0;
    return count > 0 ? `${count} question${count === 1 ? "" : "s"}` : "Quiz";
  }
  if (lesson.type === "resource") {
    return lesson.media ? `${lesson.media.extension.toUpperCase()} · ${lesson.media.fileName}` : "Reference file";
  }
  return lesson.media?.fileName ?? lessonDurationLabel(lesson);
}

/* ------------------------------ Main editor -------------------------------- */

export function CurriculumEditor({
  sections,
  onChange,
  onSave,
  saving = false,
}: {
  sections: CurriculumSection[];
  onChange: (sections: CurriculumSection[]) => void;
  /** Optional explicit save action (e.g. persist to the creator store). */
  onSave?: () => void;
  saving?: boolean;
}) {
  const translateUi = useTranslate();
  const [newSection, setNewSection] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set(sections.map((s) => s.id)));
  const [lessonDialog, setLessonDialog] = useState<{
    open: boolean;
    sectionId: string | null;
    lesson: Lesson | null;
    /** Bumped per open so the wizard resets instead of resuming mid-flow. */
    session: number;
  }>({ open: false, sectionId: null, lesson: null, session: 0 });
  const [preview, setPreview] = useState(false);

  const lessonsTotal = useMemo(() => sections.reduce((n, s) => n + s.lessons.length, 0), [sections]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const mutate = (fn: (draft: CurriculumSection[]) => CurriculumSection[]) => {
    onChange(fn(sections.map((s) => ({ ...s, lessons: [...s.lessons] }))));
  };

  /* section ops */
  const addSection = () => {
    const title = newSection.trim();
    if (!title) return;
    const section: CurriculumSection = { id: uid("sec"), title, lessons: [] };
    onChange([...sections, section]);
    setExpanded((prev) => new Set(prev).add(section.id));
    setNewSection("");
  };
  const renameSection = (id: string, title: string) =>
    mutate((d) => d.map((s) => (s.id === id ? { ...s, title } : s)));
  const moveSection = (index: number, dir: -1 | 1) =>
    mutate((d) => {
      const j = index + dir;
      if (j < 0 || j >= d.length) return d;
      const copy = [...d];
      [copy[index], copy[j]] = [copy[j], copy[index]];
      return copy;
    });
  const deleteSection = (id: string) => {
    const section = sections.find((s) => s.id === id);
    mutate((d) => d.filter((s) => s.id !== id));
    toast.success(`Deleted section “${section?.title ?? ""}”`);
  };

  /* lesson ops */
  const openAddLesson = (sectionId: string) =>
    setLessonDialog((prev) => ({ open: true, sectionId, lesson: null, session: prev.session + 1 }));
  const openEditLesson = (sectionId: string, lesson: Lesson) =>
    setLessonDialog((prev) => ({ open: true, sectionId, lesson, session: prev.session + 1 }));

  const saveLesson = (draft: LessonDraft, existing: Lesson | null) => {
    const { sectionId } = lessonDialog;
    if (!sectionId) return;
    mutate((d) =>
      d.map((s) => {
        if (s.id !== sectionId) return s;
        if (existing) {
          return {
            ...s,
            lessons: s.lessons.map((l) => (l.id === existing.id ? draftToLesson(draft, l) : l)),
          };
        }
        return { ...s, lessons: [...s.lessons, draftToLesson(draft)] };
      })
    );
    toast.success(existing ? "Lesson updated" : "Lesson added");
  };

  const addStarterSection = () => {
    const section = starterSection();
    onChange([...sections, section]);
    setExpanded((prev) => new Set(prev).add(section.id));
    toast.success("Added “Getting Started”");
  };
  const moveLesson = (sectionId: string, index: number, dir: -1 | 1) =>
    mutate((d) =>
      d.map((s) => {
        if (s.id !== sectionId) return s;
        const j = index + dir;
        if (j < 0 || j >= s.lessons.length) return s;
        const lessons = [...s.lessons];
        [lessons[index], lessons[j]] = [lessons[j], lessons[index]];
        return { ...s, lessons };
      })
    );
  const deleteLesson = (sectionId: string, lessonId: string) => {
    mutate((d) =>
      d.map((s) => (s.id === sectionId ? { ...s, lessons: s.lessons.filter((l) => l.id !== lessonId) } : s))
    );
    toast.success("Lesson deleted");
  };

  /* learner preview */
  const previewCourse = useMemo(() => {
    if (!preview) return null;
    return {
      id: "preview",
      lessonsCount: lessonsTotal,
      durationMinutes: sections.reduce((n, s) => n + s.lessons.reduce((m, l) => m + l.durationMinutes, 0), 0),
      curriculum: sections,
    } as Course;
  }, [preview, sections, lessonsTotal]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-muted-foreground">
          <span className="font-semibold text-foreground">{sections.length}</span><LocalizedText text={"sections ·"} /><LocalizedText text={" "} />
          <span className="font-semibold text-foreground">{lessonsTotal}</span><LocalizedText text={"lessons"} /></p>
        <div className="flex items-center gap-2">
          <Button
            variant={preview ? "secondary" : "outline"}
            size="sm"
            onClick={() => setPreview((v) => !v)}
            disabled={sections.length === 0}
          >
            <Eye aria-hidden />
            {preview ? "Hide learner preview" : "Preview as learner"}
          </Button>
          {onSave && (
            <Button size="sm" onClick={onSave} loading={saving}><LocalizedText text={"Save curriculum"} /></Button>
          )}
        </div>
      </div>

      {preview && previewCourse ? (
        <div className="rounded-xl border border-violet-200 bg-accent/40 p-4 sm:p-5">
          <p className="mb-3 text-[11px] font-bold tracking-[0.1em] text-accent-foreground uppercase"><LocalizedText text={"Learner preview"} /></p>
          <Curriculum course={previewCourse} />
        </div>
      ) : sections.length === 0 ? (
        <EmptyState
          icon={ListTree}
          title={translateUi("No sections yet")}
          description={translateUi("Structure your course into sections and lessons. A great course usually has 4–6 sections.")}
          action={
            <Button variant="outline" onClick={addStarterSection}>
              <Sparkles aria-hidden /><LocalizedText text={"Add “Getting Started” section"} />
            </Button>
          }
        />
      ) : (
        <ol className="space-y-3">
          {sections.map((section, si) => {
            const isOpen = expanded.has(section.id);
            return (
              <li key={section.id} className="overflow-hidden rounded-xl border border-border bg-white shadow-card">
                {/* Section header */}
                <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2.5">
                  <span className="w-7 shrink-0 text-center text-[12px] font-bold text-zinc-400 tabular-nums">
                    <LocalizedText text={String(si + 1).padStart(2, "0")} />
                  </span>
                  <Input
                    value={section.title}
                    onChange={(e) => renameSection(section.id, e.target.value)}
                    aria-label={translateUi(`Section ${si + 1} title`)}
                    className="h-8 flex-1 border-transparent bg-transparent text-[13.5px] font-semibold shadow-none hover:border-input focus-visible:bg-white"
                  />
                  <span className="hidden shrink-0 text-[11.5px] whitespace-nowrap text-zinc-400 sm:block">
                    {section.lessons.length}<LocalizedText text={"lessons"} /></span>
                  <div className="flex shrink-0 items-center">
                    <button type="button" aria-label={translateUi("Move section up")} disabled={si === 0} onClick={() => moveSection(si, -1)}
                      className="cursor-pointer rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-white hover:text-foreground disabled:opacity-25">
                      <ArrowUp className="size-3.5" aria-hidden /></button>
                    <button type="button" aria-label={translateUi("Move section down")} disabled={si === sections.length - 1} onClick={() => moveSection(si, 1)}
                      className="cursor-pointer rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-white hover:text-foreground disabled:opacity-25">
                      <ArrowDown className="size-3.5" aria-hidden /></button>
                    <button type="button" aria-label={translateUi(`Delete section ${section.title}`)} onClick={() => deleteSection(section.id)}
                      className="cursor-pointer rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-destructive">
                      <Trash2 className="size-3.5" aria-hidden /></button>
                    <button type="button" aria-expanded={isOpen} aria-label={isOpen ? "Collapse section" : "Expand section"} onClick={() => toggle(section.id)}
                      className="cursor-pointer rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white">
                      <ChevronDown className={cn("size-4 transition-transform", isOpen && "rotate-180")} aria-hidden /></button>
                  </div>
                </div>

                {/* Lessons */}
                {isOpen && (
                  <div className="p-2">
                    {section.lessons.length === 0 ? (
                      <p className="px-3 py-4 text-center text-[12.5px] text-zinc-400"><LocalizedText text={"No lessons in this section yet."} /></p>
                    ) : (
                      <ul>
                        {section.lessons.map((lesson, li) => {
                          const meta = LESSON_TYPES.find((t) => t.value === lesson.type)!;
                          return (
                            <li
                              key={lesson.id}
                              className="group flex items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-muted/70"
                            >
                              <span className="w-6 shrink-0 text-center text-[11px] text-zinc-300 tabular-nums">
                                {li + 1}
                              </span>
                              <meta.icon className="size-4 shrink-0 text-zinc-400" aria-hidden />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[13px] font-medium"><LocalizedText text={lesson.title} /></p>
                                {lesson.description && (
                                  <p className="truncate text-[11.5px] text-zinc-400"><LocalizedText text={lesson.description} /></p>
                                )}
                              </div>
                              {lesson.freePreview && (
                                <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-foreground"><LocalizedText text={"Preview"} /></span>
                              )}
                              <span className="max-w-40 shrink-0 truncate text-[11.5px] text-zinc-400 tabular-nums" title={lessonSummary(lesson)}>
                                <LocalizedText text={lessonSummary(lesson)} />
                              </span>
                              <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
                                <button type="button" aria-label={translateUi("Move lesson up")} disabled={li === 0} onClick={() => moveLesson(section.id, li, -1)}
                                  className="cursor-pointer rounded-md p-1 text-zinc-400 hover:bg-white hover:text-foreground disabled:opacity-25">
                                  <ArrowUp className="size-3.5" aria-hidden /></button>
                                <button type="button" aria-label={translateUi("Move lesson down")} disabled={li === section.lessons.length - 1} onClick={() => moveLesson(section.id, li, 1)}
                                  className="cursor-pointer rounded-md p-1 text-zinc-400 hover:bg-white hover:text-foreground disabled:opacity-25">
                                  <ArrowDown className="size-3.5" aria-hidden /></button>
                                <button type="button" aria-label={translateUi(`Edit lesson ${lesson.title}`)} onClick={() => openEditLesson(section.id, lesson)}
                                  className="cursor-pointer rounded-md p-1 text-zinc-400 hover:bg-white hover:text-foreground">
                                  <Pencil className="size-3.5" aria-hidden /></button>
                                <button type="button" aria-label={translateUi(`Delete lesson ${lesson.title}`)} onClick={() => deleteLesson(section.id, lesson.id)}
                                  className="cursor-pointer rounded-md p-1 text-zinc-400 hover:bg-red-50 hover:text-destructive">
                                  <Trash2 className="size-3.5" aria-hidden /></button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    <button
                      type="button"
                      onClick={() => openAddLesson(section.id)}
                      className="mt-1 flex w-full cursor-pointer items-center gap-2 rounded-lg border border-dashed border-zinc-300 px-3 py-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent/50 hover:text-primary"
                    >
                      <Plus className="size-4" aria-hidden /><LocalizedText text={"Add lesson to “"} /><LocalizedText text={section.title} />”
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {/* Add section */}
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          addSection();
        }}
      >
        <Input
          value={newSection}
          onChange={(e) => setNewSection(e.target.value)}
          placeholder={translateUi("New section title, e.g. Getting Started")}
          aria-label={translateUi("New section title")}
          className="flex-1"
        />
        <Button type="submit" variant="outline" disabled={!newSection.trim()}>
          <Plus aria-hidden /><LocalizedText text={"Add section"} /></Button>
      </form>

      <LessonWizardDialog
        open={lessonDialog.open}
        onOpenChange={(open) => setLessonDialog((p) => ({ ...p, open }))}
        initial={lessonDialog.lesson}
        onSave={saveLesson}
        mode={lessonDialog.lesson ? "edit" : "add"}
        sessionKey={lessonDialog.session}
      />
    </div>
  );
}
