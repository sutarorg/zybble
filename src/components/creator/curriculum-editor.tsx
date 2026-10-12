"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Eye,
  FileDown,
  FileText,
  CirclePlay,
  ListChecks,
  ListTree,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { Course, CurriculumSection, Lesson } from "@/types";
import { uid } from "@/lib/creator";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Curriculum } from "@/components/courses/curriculum";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { useKeyedState } from "@/lib/hooks";

const LESSON_TYPES: { value: Lesson["type"]; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "video", label: "Video", icon: CirclePlay },
  { value: "reading", label: "Reading", icon: FileText },
  { value: "quiz", label: "Quiz", icon: ListChecks },
  { value: "resource", label: "Resource", icon: FileDown },
];

/* ------------------------------ Lesson dialog ------------------------------ */

interface LessonFormState {
  title: string;
  type: Lesson["type"];
  durationMinutes: number;
  description: string;
  freePreview: boolean;
  downloadable: boolean;
}

const EMPTY_LESSON_FORM: LessonFormState = {
  title: "",
  type: "video",
  durationMinutes: 10,
  description: "",
  freePreview: false,
  downloadable: false,
};

function LessonDialog({
  open,
  onOpenChange,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: LessonFormState | null;
  onSave: (lesson: LessonFormState & { title: string }) => void;
}) {
  /**
   * The form resets whenever the dialog is (re)opened for a different lesson —
   * derived from the open state and lesson identity instead of an effect, so no
   * stale values flash and no cascading render happens.
   */
  const dialogKey = open ? `open:${initial ? "edit" : "add"}:${initial?.title ?? ""}` : "closed";
  const [state, setState] = useKeyedState(dialogKey, {
    form: initial ?? EMPTY_LESSON_FORM,
    error: "",
  });
  const form = state.form;
  const error = state.error;
  const setForm = (next: LessonFormState) => setState((prev) => ({ ...prev, form: next }));
  const setError = (next: string) => setState((prev) => ({ ...prev, error: next }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{initial ? "Edit lesson" : "Add lesson"}</DialogTitle>
          <DialogDescription>Lessons combine video, reading, quizzes and downloadable resources.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ld-title">Lesson title *</Label>
            <Input
              id="ld-title"
              value={form.title}
              placeholder="e.g. Setting up your first workflow"
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              aria-invalid={!!error}
            />
            {error && <p className="text-[12px] font-medium text-destructive">{error}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as Lesson["type"] })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LESSON_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ld-duration">Duration (minutes)</Label>
              <Input
                id="ld-duration"
                type="number"
                min={1}
                max={300}
                value={form.durationMinutes}
                onChange={(e) => setForm({ ...form, durationMinutes: Math.max(1, Number(e.target.value) || 1) })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ld-desc">Description <span className="font-normal text-zinc-400">(optional)</span></Label>
            <Textarea
              id="ld-desc"
              value={form.description}
              placeholder="What this lesson covers, in one or two sentences."
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="min-h-20"
            />
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <label className="flex cursor-pointer items-center gap-2 text-[13px]">
              <Checkbox
                checked={form.freePreview}
                onCheckedChange={(v) => setForm({ ...form, freePreview: v === true })}
              />
              Free preview
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-[13px]">
              <Checkbox
                checked={form.downloadable}
                onCheckedChange={(v) => setForm({ ...form, downloadable: v === true })}
              />
              Downloadable resource
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (form.title.trim().length < 3) {
                setError("Give the lesson a title (3+ characters).");
                return;
              }
              onSave({ ...form, title: form.title.trim() });
              onOpenChange(false);
            }}
          >
            {initial ? "Save lesson" : "Add lesson"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
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
  const [newSection, setNewSection] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set(sections.map((s) => s.id)));
  const [lessonDialog, setLessonDialog] = useState<{
    open: boolean;
    sectionId: string | null;
    lesson: (LessonFormState & { id?: string }) | null;
  }>({ open: false, sectionId: null, lesson: null });
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
  const openAddLesson = (sectionId: string) => setLessonDialog({ open: true, sectionId, lesson: null });
  const openEditLesson = (sectionId: string, lesson: Lesson) =>
    setLessonDialog({
      open: true,
      sectionId,
      lesson: {
        id: lesson.id,
        title: lesson.title,
        type: lesson.type,
        durationMinutes: lesson.durationMinutes,
        description: lesson.description ?? "",
        freePreview: lesson.freePreview ?? false,
        downloadable: lesson.downloadable ?? false,
      },
    });
  const saveLesson = (form: LessonFormState) => {
    const { sectionId, lesson } = lessonDialog;
    if (!sectionId) return;
    mutate((d) =>
      d.map((s) => {
        if (s.id !== sectionId) return s;
        if (lesson?.id) {
          return { ...s, lessons: s.lessons.map((l) => (l.id === lesson.id ? { ...l, ...form } : l)) };
        }
        const newLesson: Lesson = { id: uid("les"), ...form };
        return { ...s, lessons: [...s.lessons, newLesson] };
      })
    );
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
          <span className="font-semibold text-foreground">{sections.length}</span> sections ·{" "}
          <span className="font-semibold text-foreground">{lessonsTotal}</span> lessons
        </p>
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
            <Button size="sm" onClick={onSave} loading={saving}>
              Save curriculum
            </Button>
          )}
        </div>
      </div>

      {preview && previewCourse ? (
        <div className="rounded-xl border border-violet-200 bg-accent/40 p-4 sm:p-5">
          <p className="mb-3 text-[11px] font-bold tracking-[0.1em] text-accent-foreground uppercase">
            Learner preview
          </p>
          <Curriculum course={previewCourse} />
        </div>
      ) : sections.length === 0 ? (
        <EmptyState
          icon={ListTree}
          title="No curriculum yet"
          description="Structure your course into sections and lessons. A great course usually has 4–6 sections."
          action={null}
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
                    {String(si + 1).padStart(2, "0")}
                  </span>
                  <Input
                    value={section.title}
                    onChange={(e) => renameSection(section.id, e.target.value)}
                    aria-label={`Section ${si + 1} title`}
                    className="h-8 flex-1 border-transparent bg-transparent text-[13.5px] font-semibold shadow-none hover:border-input focus-visible:bg-white"
                  />
                  <span className="hidden shrink-0 text-[11.5px] whitespace-nowrap text-zinc-400 sm:block">
                    {section.lessons.length} lessons
                  </span>
                  <div className="flex shrink-0 items-center">
                    <button type="button" aria-label="Move section up" disabled={si === 0} onClick={() => moveSection(si, -1)}
                      className="cursor-pointer rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-white hover:text-foreground disabled:opacity-25">
                      <ArrowUp className="size-3.5" aria-hidden /></button>
                    <button type="button" aria-label="Move section down" disabled={si === sections.length - 1} onClick={() => moveSection(si, 1)}
                      className="cursor-pointer rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-white hover:text-foreground disabled:opacity-25">
                      <ArrowDown className="size-3.5" aria-hidden /></button>
                    <button type="button" aria-label={`Delete section ${section.title}`} onClick={() => deleteSection(section.id)}
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
                      <p className="px-3 py-4 text-center text-[12.5px] text-zinc-400">
                        No lessons in this section yet.
                      </p>
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
                                <p className="truncate text-[13px] font-medium">{lesson.title}</p>
                                {lesson.description && (
                                  <p className="truncate text-[11.5px] text-zinc-400">{lesson.description}</p>
                                )}
                              </div>
                              {lesson.freePreview && (
                                <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-foreground">
                                  Preview
                                </span>
                              )}
                              <span className="shrink-0 text-[11.5px] text-zinc-400 tabular-nums">
                                {lesson.durationMinutes}m
                              </span>
                              <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
                                <button type="button" aria-label="Move lesson up" disabled={li === 0} onClick={() => moveLesson(section.id, li, -1)}
                                  className="cursor-pointer rounded-md p-1 text-zinc-400 hover:bg-white hover:text-foreground disabled:opacity-25">
                                  <ArrowUp className="size-3.5" aria-hidden /></button>
                                <button type="button" aria-label="Move lesson down" disabled={li === section.lessons.length - 1} onClick={() => moveLesson(section.id, li, 1)}
                                  className="cursor-pointer rounded-md p-1 text-zinc-400 hover:bg-white hover:text-foreground disabled:opacity-25">
                                  <ArrowDown className="size-3.5" aria-hidden /></button>
                                <button type="button" aria-label={`Edit lesson ${lesson.title}`} onClick={() => openEditLesson(section.id, lesson)}
                                  className="cursor-pointer rounded-md p-1 text-zinc-400 hover:bg-white hover:text-foreground">
                                  <Pencil className="size-3.5" aria-hidden /></button>
                                <button type="button" aria-label={`Delete lesson ${lesson.title}`} onClick={() => deleteLesson(section.id, lesson.id)}
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
                      <Plus className="size-4" aria-hidden />
                      Add lesson to “{section.title}”
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
          placeholder="New section title, e.g. Getting Started"
          aria-label="New section title"
          className="flex-1"
        />
        <Button type="submit" variant="outline" disabled={!newSection.trim()}>
          <Plus aria-hidden />
          Add section
        </Button>
      </form>

      <LessonDialog
        open={lessonDialog.open}
        onOpenChange={(open) => setLessonDialog((p) => ({ ...p, open }))}
        initial={lessonDialog.lesson}
        onSave={saveLesson}
      />
    </div>
  );
}
