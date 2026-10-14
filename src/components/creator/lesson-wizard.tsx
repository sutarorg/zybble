"use client";

import { LocalizedText, useTranslate } from "@/components/providers/localized-text";
import * as React from "react";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CirclePlay,
  CloudUpload,
  FileDown,
  FileVideo,
  GripVertical,
  ListChecks,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import type { Lesson, LessonMedia, QuizQuestion } from "@/types";
import { fileExtension, readVideoDurationMinutes, uid } from "@/lib/creator";
import { formatFileSize } from "@/lib/utils";
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
import { cn } from "@/lib/utils";
import { useKeyedState } from "@/lib/hooks";

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

/** Reading and the old "downloadable resource" flag are gone: lessons are
 *  videos, quizzes or resource files. */
export const LESSON_TYPES: {
  value: Lesson["type"];
  label: string;
  blurb: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: "video", label: "Video", blurb: "Recorded lesson — duration is read from the file", icon: CirclePlay },
  { value: "quiz", label: "Quiz", blurb: "Check understanding with questions and answers", icon: ListChecks },
  { value: "resource", label: "Resource", blurb: "Attach a template, deck or dataset to download", icon: FileDown },
];

export interface LessonDraft {
  title: string;
  type: Lesson["type"];
  description: string;
  freePreview: boolean;
  /** Video lessons: minutes, detected from the uploaded file. */
  durationMinutes: number;
  media: LessonMedia | null;
  quiz: QuizQuestion[];
}

export const EMPTY_LESSON_DRAFT: LessonDraft = {
  title: "",
  type: "video",
  description: "",
  freePreview: false,
  durationMinutes: 0,
  media: null,
  quiz: [],
};

export function lessonToDraft(lesson: Lesson): LessonDraft {
  return {
    title: lesson.title,
    type: lesson.type,
    description: lesson.description ?? "",
    freePreview: lesson.freePreview ?? false,
    durationMinutes: lesson.durationMinutes,
    media: lesson.media ?? null,
    quiz: lesson.quiz ?? [],
  };
}

/** Turns a saved draft back into the stored lesson shape. */
export function draftToLesson(draft: LessonDraft, existing?: Lesson): Lesson {
  return {
    ...(existing ?? { id: uid("les"), title: "", durationMinutes: 0, type: draft.type }),
    id: existing?.id ?? uid("les"),
    title: draft.title.trim(),
    type: draft.type,
    description: draft.description.trim() || undefined,
    freePreview: draft.freePreview || undefined,
    // Video duration comes from the file; quizzes and resources have none.
    durationMinutes: draft.type === "video" ? draft.durationMinutes : 0,
    downloadable: draft.type === "resource" ? true : undefined,
    quiz: draft.type === "quiz" ? draft.quiz : undefined,
    media: draft.media ?? undefined,
  };
}

/* -------------------------------------------------------------------------- */
/* Step chrome                                                                 */
/* -------------------------------------------------------------------------- */

function StepTrail({ step, type }: { step: number; type: Lesson["type"] }) {
  const second = type === "quiz" ? "Make the quiz" : type === "resource" ? "Upload resource" : "Upload video";
  const steps = ["Details", second];
  return (
    <ol className="flex items-center gap-2 text-[11.5px] font-medium">
      {steps.map((label, i) => (
        <li key={label} className="flex items-center gap-2">
          <span
            className={cn(
              "flex size-5 items-center justify-center rounded-full border text-[10.5px] font-bold",
              i < step && "border-emerald-500 bg-emerald-500 text-white",
              i === step && "border-primary bg-primary text-white",
              i > step && "border-border bg-white text-zinc-400"
            )}
          >
            {i < step ? <Check className="size-3" strokeWidth={3.5} aria-hidden /> : i + 1}
          </span>
          <span className={cn(i === step ? "text-foreground" : "text-muted-foreground")}>
            <LocalizedText text={label} />
          </span>
          {i === 0 && <span className="h-px w-6 bg-border" aria-hidden />}
        </li>
      ))}
    </ol>
  );
}

/* -------------------------------------------------------------------------- */
/* Video upload                                                                */
/* -------------------------------------------------------------------------- */

function VideoUploadStep({
  media,
  onMedia,
  onDuration,
}: {
  media: LessonMedia | null;
  onMedia: (media: LessonMedia | null) => void;
  onDuration: (minutes: number) => void;
}) {
  const translateUi = useTranslate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(media ? 100 : 0);
  const [detecting, setDetecting] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearInterval(t));
      timers.current.forEach((t) => window.clearTimeout(t));
    },
    []
  );

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const next: LessonMedia = {
      fileName: file.name,
      fileSize: file.size,
      extension: fileExtension(file.name),
      kind: "video",
    };
    onMedia(next);
    setProgress(4);
    setDetecting(true);
    // Simulated transfer: the bar climbs while we read the real duration.
    const interval = window.setInterval(() => {
      setProgress((p) => (p >= 92 ? 92 : p + 6));
    }, 90);
    timers.current.push(interval);
    void readVideoDurationMinutes(file).then((minutes) => {
      window.clearInterval(interval);
      onDuration(minutes);
      setProgress(100);
      setDetecting(false);
    });
  };

  const clear = () => {
    timers.current.forEach((t) => window.clearInterval(t));
    onMedia(null);
    setProgress(0);
    setDetecting(false);
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "group relative flex w-full cursor-pointer flex-col items-center justify-center gap-2.5 overflow-hidden rounded-2xl border-2 border-dashed px-5 py-9 text-center transition-all",
          dragOver
            ? "border-primary bg-accent"
            : "border-zinc-300 bg-gradient-to-b from-muted/50 to-white hover:border-primary/60 hover:bg-accent/40"
        )}
      >
        <span className="flex size-12 items-center justify-center rounded-2xl bg-white text-primary shadow-card ring-1 ring-border">
          <FileVideo className="size-5.5" aria-hidden />
        </span>
        <span className="text-[14px] font-semibold">
          <LocalizedText text={media ? "Replace video file" : "Select your lesson video"} />
        </span>
        <span className="max-w-xs text-[12px] leading-relaxed text-zinc-500">
          <LocalizedText text="Drop an MP4, MOV or WebM here, or click to browse. The lesson length is read from the file automatically." />
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-500 ring-1 ring-border">
          <CloudUpload className="size-3.5 text-primary" aria-hidden />
          <LocalizedText text="MP4 · MOV · WebM · up to 2 GB" />
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {media && (
        <div className="rounded-xl border border-border bg-white p-3.5 shadow-card">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
              {detecting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium"><LocalizedText text={media.fileName} /></p>
              <p className="text-[11.5px] text-zinc-400">
                <LocalizedText text={formatFileSize(media.fileSize)} />
                <LocalizedText text={" · "} />
                <span className="font-mono uppercase"><LocalizedText text={media.extension} /></span>
              </p>
            </div>
            {!detecting && (
              <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10.5px] font-semibold text-emerald-700">
                <Sparkles className="size-3" aria-hidden /><LocalizedText text={"Duration detected"} />
              </span>
            )}
            <button
              type="button"
              aria-label={translateUi("Remove file")}
              onClick={clear}
              className="cursor-pointer rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-destructive"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>

          <div className="mt-3">
            <div className="flex items-center justify-between text-[11.5px] font-medium">
              <span className={cn(progress === 100 ? "text-emerald-600" : "text-muted-foreground")}>
                {progress === 100 ? (
                  <LocalizedText text={"Upload complete"} />
                ) : (
                  <LocalizedText text={"Uploading…"} />
                )}
              </span>
              <span className="tabular-nums text-zinc-400">{progress}%</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-100">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-150 ease-out",
                  progress === 100 ? "bg-emerald-500" : "bg-primary"
                )}
                style={{ width: `${progress}%` }}
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Resource upload                                                             */
/* -------------------------------------------------------------------------- */

function ResourceUploadStep({
  media,
  onMedia,
  title,
  onTitle,
}: {
  media: LessonMedia | null;
  onMedia: (media: LessonMedia | null) => void;
  title: string;
  onTitle: (title: string) => void;
}) {
  const translateUi = useTranslate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const extension = fileExtension(file.name);
    onMedia({ fileName: file.name, fileSize: file.size, extension, kind: "resource" });
    // Naming the lesson after the file keeps the flow to a single click.
    if (!title.trim()) {
      onTitle(file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").slice(0, 70));
    }
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex w-full cursor-pointer flex-col items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed px-5 py-9 text-center transition-all",
          dragOver
            ? "border-primary bg-accent"
            : "border-zinc-300 bg-gradient-to-b from-muted/50 to-white hover:border-primary/60 hover:bg-accent/40"
        )}
      >
        <span className="flex size-12 items-center justify-center rounded-2xl bg-white text-primary shadow-card ring-1 ring-border">
          <FileDown className="size-5.5" aria-hidden />
        </span>
        <span className="text-[14px] font-semibold">
          <LocalizedText text={media ? "Replace resource file" : "Select the resource file"} />
        </span>
        <span className="max-w-xs text-[12px] leading-relaxed text-zinc-500">
          <LocalizedText text="Templates, decks, datasets or code. The file type is detected from its extension — no settings needed." />
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {media && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-white p-3.5 shadow-card">
          <span className="flex size-10 shrink-0 flex-col items-center justify-center rounded-lg bg-accent text-primary">
            <FileDown className="size-4" aria-hidden />
            <span className="font-mono text-[8.5px] font-bold uppercase"><LocalizedText text={media.extension} /></span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium"><LocalizedText text={media.fileName} /></p>
            <p className="text-[11.5px] text-zinc-400">
              <LocalizedText text={formatFileSize(media.fileSize)} />
              <LocalizedText text={" · detected "} />
              <span className="font-semibold uppercase text-zinc-500"><LocalizedText text={media.extension} /></span>
            </p>
          </div>
          <button
            type="button"
            aria-label={translateUi("Remove file")}
            onClick={() => onMedia(null)}
            className="cursor-pointer rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-destructive"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Quiz builder                                                                */
/* -------------------------------------------------------------------------- */

function QuizStep({
  quiz,
  onChange,
}: {
  quiz: QuizQuestion[];
  onChange: (quiz: QuizQuestion[]) => void;
}) {
  const translateUi = useTranslate();

  const addQuestion = () =>
    onChange([
      ...quiz,
      { id: uid("qz"), prompt: "", options: ["", ""], correctIndex: 0 },
    ]);

  const patch = (id: string, next: Partial<QuizQuestion>) =>
    onChange(quiz.map((q) => (q.id === id ? { ...q, ...next } : q)));

  return (
    <div className="space-y-4">
      {quiz.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-zinc-300 bg-gradient-to-b from-muted/50 to-white px-5 py-8 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-white text-primary shadow-card ring-1 ring-border">
            <ListChecks className="size-5.5" aria-hidden />
          </span>
          <p className="mt-3 text-[14px] font-semibold"><LocalizedText text={"Build the quiz"} /></p>
          <p className="mx-auto mt-1 max-w-xs text-[12px] leading-relaxed text-zinc-500">
            <LocalizedText text={"Add at least one question. Learners answer inside the course player and see their score instantly."} />
          </p>
          <Button type="button" className="mt-4" onClick={addQuestion}>
            <Plus aria-hidden /><LocalizedText text={"Add question"} />
          </Button>
        </div>
      )}

      {quiz.map((question, qi) => (
        <div key={question.id} className="rounded-xl border border-border bg-muted/30 p-3.5">
          <div className="flex items-start gap-2">
            <span className="mt-2 flex size-6 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-bold text-primary ring-1 ring-border">
              {qi + 1}
            </span>
            <Input
              value={question.prompt}
              onChange={(e) => patch(question.id, { prompt: e.target.value })}
              placeholder={translateUi("Question, e.g. Which prompt format works best for step-by-step reasoning?")}
              aria-label={translateUi(`Question ${qi + 1}`)}
              className="flex-1 bg-white"
            />
            <button
              type="button"
              aria-label={translateUi(`Delete question ${qi + 1}`)}
              onClick={() => onChange(quiz.filter((q) => q.id !== question.id))}
              className="mt-1 cursor-pointer rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-destructive"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </div>

          <ul className="mt-3 space-y-2 pl-8">
            {question.options.map((option, oi) => (
              <li key={oi} className="flex items-center gap-2">
                <button
                  type="button"
                  role="radio"
                  aria-checked={question.correctIndex === oi}
                  aria-label={translateUi(`Mark option ${oi + 1} as correct`)}
                  onClick={() => patch(question.id, { correctIndex: oi })}
                  className={cn(
                    "flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors",
                    question.correctIndex === oi
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-zinc-300 bg-white text-transparent hover:border-primary"
                  )}
                >
                  <Check className="size-3" strokeWidth={3.5} aria-hidden />
                </button>
                <Input
                  value={option}
                  onChange={(e) =>
                    patch(question.id, {
                      options: question.options.map((o, idx) => (idx === oi ? e.target.value : o)),
                    })
                  }
                  placeholder={translateUi(`Answer ${oi + 1}`)}
                  aria-label={translateUi(`Answer ${oi + 1}`)}
                  className="h-9 flex-1 bg-white text-[13px]"
                />
                <button
                  type="button"
                  aria-label={translateUi(`Remove answer ${oi + 1}`)}
                  disabled={question.options.length <= 2}
                  onClick={() =>
                    patch(question.id, {
                      options: question.options.filter((_, idx) => idx !== oi),
                      correctIndex:
                        question.correctIndex > oi ? question.correctIndex - 1 : Math.min(question.correctIndex, question.options.length - 2),
                    })
                  }
                  className="cursor-pointer rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-destructive disabled:opacity-30"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
            {question.options.length < 5 && (
              <li className="pl-7">
                <button
                  type="button"
                  onClick={() => patch(question.id, { options: [...question.options, ""] })}
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-[12.5px] font-medium text-primary transition-colors hover:bg-accent"
                >
                  <Plus className="size-3.5" aria-hidden /><LocalizedText text={"Add answer"} />
                </button>
              </li>
            )}
          </ul>
          <p className="mt-2 pl-8 text-[11.5px] text-zinc-400">
            <GripVertical className="mr-1 inline size-3 align-[-2px]" aria-hidden />
            <LocalizedText text={"Tick the circle next to the correct answer."} />
          </p>
        </div>
      ))}

      {quiz.length > 0 && (
        <Button type="button" variant="outline" onClick={addQuestion}>
          <Plus aria-hidden /><LocalizedText text={"Add question"} />
        </Button>
      )}

    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* The wizard dialog                                                           */
/* -------------------------------------------------------------------------- */

export function LessonWizardDialog({
  open,
  onOpenChange,
  initial,
  onSave,
  mode,
  sessionKey,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Lesson being edited, or null when adding. */
  initial: Lesson | null;
  onSave: (draft: LessonDraft, existing: Lesson | null) => void;
  mode: "add" | "edit";
  /** Changes on every open so the wizard always starts from a clean slate. */
  sessionKey?: number;
}) {
  const translateUi = useTranslate();
  const dialogKey = open ? `open:${initial?.id ?? "new"}:${sessionKey ?? 0}` : "closed";
  const [state, setState] = useKeyedState(dialogKey, {
    step: 0,
    draft: initial ? lessonToDraft(initial) : EMPTY_LESSON_DRAFT,
    error: "",
  });
  const { step, draft, error } = state;
  const setDraft = (next: Partial<LessonDraft>) =>
    setState((prev) => ({ ...prev, draft: { ...prev.draft, ...next }, error: "" }));
  const setStep = (next: number) => setState((prev) => ({ ...prev, step: next, error: "" }));

  const mediaReady =
    draft.type === "video"
      ? Boolean(draft.media)
      : draft.type === "resource"
        ? Boolean(draft.media)
        : true;

  const goNext = () => {
    if (draft.title.trim().length < 3) {
      setState((prev) => ({ ...prev, error: "Give the lesson a title (3+ characters)." }));
      return;
    }
    setStep(1);
  };

  const commit = () => {
    if (draft.type === "video" && !draft.media) {
      setState((prev) => ({ ...prev, error: "Upload the lesson video to continue." }));
      return;
    }
    if (draft.type === "resource" && !draft.media) {
      setState((prev) => ({ ...prev, error: "Upload the resource file to continue." }));
      return;
    }
    let payload = draft;
    if (draft.type === "quiz") {
      if (draft.quiz.length === 0) {
        setState((prev) => ({ ...prev, error: "Add at least one quiz question." }));
        return;
      }
      const invalid = draft.quiz.findIndex(
        (q) => q.prompt.trim().length < 3 || q.options.filter((o) => o.trim()).length < 2
      );
      if (invalid >= 0) {
        setState((prev) => ({
          ...prev,
          error: `Question ${invalid + 1} needs a prompt and at least two answers.`,
        }));
        return;
      }
      payload = {
        ...draft,
        quiz: draft.quiz.map((q) => {
          const options = q.options.map((o) => o.trim()).filter(Boolean);
          return {
            ...q,
            prompt: q.prompt.trim(),
            options,
            correctIndex: Math.min(q.correctIndex, options.length - 1),
          };
        }),
      };
    }
    onSave(payload, initial);
    onOpenChange(false);
  };

  const secondStepTitle =
    draft.type === "video" ? "Upload video" : draft.type === "resource" ? "Upload resource" : "Make the quiz";
  const TypeIcon = LESSON_TYPES.find((t) => t.value === draft.type)!.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TypeIcon className="size-4.5 text-primary" aria-hidden />
            {mode === "edit" ? "Edit lesson" : "Add lesson"}
          </DialogTitle>
          <DialogDescription>
            <LocalizedText text={step === 0 ? "Name the lesson and choose how it is delivered." : "Finish the lesson setup — one step left."} />
          </DialogDescription>
        </DialogHeader>

        <StepTrail step={step} type={draft.type} />

        {step === 0 ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="lw-title"><LocalizedText text={"Lesson title *"} /></Label>
              <Input
                id="lw-title"
                value={draft.title}
                placeholder={translateUi("e.g. Setting up your first workflow")}
                onChange={(e) => setDraft({ title: e.target.value })}
                aria-invalid={!!error}
              />
              {error && <p className="text-[12px] font-medium text-destructive"><LocalizedText text={error} /></p>}
            </div>

            <div className="space-y-2">
              <Label><LocalizedText text={"Lesson type *"} /></Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {LESSON_TYPES.map((type) => {
                  const active = draft.type === type.value;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setDraft({ type: type.value })}
                      className={cn(
                        "flex cursor-pointer flex-col gap-1.5 rounded-xl border p-3 text-left transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring/25",
                        active ? "border-primary bg-accent/60 shadow-xs" : "border-border bg-white hover:border-zinc-300"
                      )}
                    >
                      <type.icon className={cn("size-4.5", active ? "text-primary" : "text-zinc-400")} aria-hidden />
                      <span className="text-[13.5px] font-semibold"><LocalizedText text={type.label} /></span>
                      <span className="text-[11.5px] leading-snug text-muted-foreground"><LocalizedText text={type.blurb} /></span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="lw-desc"><LocalizedText text={"Description"} /><span className="font-normal text-zinc-400"><LocalizedText text={"(optional)"} /></span></Label>
              <Textarea
                id="lw-desc"
                value={draft.description}
                placeholder={translateUi("What this lesson covers, in one or two sentences.")}
                onChange={(e) => setDraft({ description: e.target.value })}
                className="min-h-20"
              />
            </div>

            {draft.type === "video" && (
              <label className="flex cursor-pointer items-center gap-2 text-[13px]">
                <Checkbox
                  checked={draft.freePreview}
                  onCheckedChange={(v) => setDraft({ freePreview: v === true })}
                /><LocalizedText text={"Free preview"} /></label>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {draft.type === "video" && (
              <VideoUploadStep
                media={draft.media}
                onMedia={(media) => setDraft({ media })}
                onDuration={(durationMinutes) => setDraft({ durationMinutes })}
              />
            )}
            {draft.type === "resource" && (
              <ResourceUploadStep
                media={draft.media}
                onMedia={(media) => setDraft({ media })}
                title={draft.title}
                onTitle={(title) => setDraft({ title })}
              />
            )}
            {draft.type === "quiz" && (
              <QuizStep quiz={draft.quiz} onChange={(quiz) => setDraft({ quiz })} />
            )}
            {error && <p className="text-[12.5px] font-medium text-destructive"><LocalizedText text={error} /></p>}
          </div>
        )}

        <DialogFooter className="sm:justify-between">
          {step === 0 ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}><LocalizedText text={"Cancel"} /></Button>
              <Button onClick={goNext}>
                <LocalizedText text={"Next"} /><ArrowRight aria-hidden />
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep(0)}>
                <ArrowLeft aria-hidden /><LocalizedText text={"Back"} />
              </Button>
              <Button onClick={commit} disabled={!mediaReady}>
                <Check aria-hidden />
                <LocalizedText text={mode === "edit" ? "Save lesson" : "Add lesson"} />
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
