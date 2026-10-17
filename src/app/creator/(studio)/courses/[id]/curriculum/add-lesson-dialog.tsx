"use client";

import * as React from "react";
import {
  AlertCircle,
  FileUp,
  Film,
  HelpCircle,
  Link2,
  Loader2,
  Plus,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { saveLesson } from "@/app/creator/actions";
import {
  lessonResourceLinkSchema,
  type LessonResourceLink,
  type QuizQuestion,
} from "@/lib/course-wizard";
import { MAX_RESOURCE_MB } from "@/lib/upload-limits";
import {
  createDefaultQuestion,
  QuizBuilder,
  validateQuizQuestions,
} from "./quiz-builder";
import {
  formatResourceBytes,
  resolveResourceMimeType,
  validateResourceFileClient,
} from "./resources-lesson-panel";
import {
  formatVideoBytes,
  tusUploadVideo,
  validateVideoFileClient,
} from "./video-lesson-panel";
import { cn } from "@/lib/utils";

type Mode = "video" | "quiz" | "resource";

interface AddLessonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  sectionId: string;
  sectionTitle: string;
  nextSortOrder: number;
  initialMode?: Mode;
  onCreated: () => void;
}

export function AddLessonDialog({
  open,
  onOpenChange,
  courseId,
  sectionId,
  sectionTitle,
  nextSortOrder,
  initialMode = "video",
  onCreated,
}: AddLessonDialogProps) {
  const [mode, setMode] = React.useState<Mode>(initialMode);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [durationMinutes, setDurationMinutes] = React.useState(10);
  const [isPreview, setIsPreview] = React.useState(false);

  const [videoFile, setVideoFile] = React.useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = React.useState<string | null>(
    null
  );
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(
    null
  );
  const videoInputRef = React.useRef<HTMLInputElement>(null);

  const [quizQuestions, setQuizQuestions] = React.useState<QuizQuestion[]>(() => [
    createDefaultQuestion("multiple-choice"),
  ]);
  const [passingScorePercent, setPassingScorePercent] = React.useState(70);
  const [questionErrors, setQuestionErrors] = React.useState<
    Record<string, string>
  >({});

  const [resourceFile, setResourceFile] = React.useState<File | null>(null);
  const [resourceFileTitle, setResourceFileTitle] = React.useState("");
  const [resourceLinks, setResourceLinks] = React.useState<LessonResourceLink[]>(
    []
  );
  const [newLinkTitle, setNewLinkTitle] = React.useState("");
  const [newLinkUrl, setNewLinkUrl] = React.useState("");
  const [newLinkDesc, setNewLinkDesc] = React.useState("");
  const resourceInputRef = React.useRef<HTMLInputElement>(null);

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    return () => {
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    };
  }, [videoPreviewUrl]);

  function reset() {
    setTitle("");
    setDescription("");
    setDurationMinutes(10);
    setIsPreview(false);
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setVideoPreviewUrl(null);
    setVideoFile(null);
    setUploadProgress(null);
    setQuizQuestions([createDefaultQuestion("multiple-choice")]);
    setPassingScorePercent(70);
    setQuestionErrors({});
    setResourceFile(null);
    setResourceFileTitle("");
    setResourceLinks([]);
    setNewLinkTitle("");
    setNewLinkUrl("");
    setNewLinkDesc("");
    setBusy(false);
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    if (busy) return;
    if (!next) reset();
    onOpenChange(next);
  }

  function handlePickVideo(file: File | null) {
    setError(null);
    if (!file) return;
    const validationErr = validateVideoFileClient(file);
    if (validationErr) {
      setError(validationErr);
      if (videoInputRef.current) videoInputRef.current.value = "";
      return;
    }
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    const localUrl = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoPreviewUrl(localUrl);
    if (!title.trim()) {
      setTitle(file.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " "));
    }
  }

  function handlePickResourceFile(file: File | null) {
    setError(null);
    if (!file) return;
    const validationErr = validateResourceFileClient(file);
    if (validationErr) {
      setError(validationErr);
      if (resourceInputRef.current) resourceInputRef.current.value = "";
      return;
    }
    setResourceFile(file);
    const defaultTitle = file.name.replace(/\.[a-z0-9]+$/i, "");
    if (!resourceFileTitle.trim()) setResourceFileTitle(defaultTitle);
    if (!title.trim()) setTitle(defaultTitle);
  }

  function handleAddResourceLinkToStaging() {
    setError(null);
    const candidate = {
      id: `lnk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      title: newLinkTitle.trim(),
      url: newLinkUrl.trim(),
      description: newLinkDesc.trim(),
    };
    const parsed = lessonResourceLinkSchema.safeParse(candidate);
    if (!parsed.success) {
      setError(
        parsed.error.issues[0]?.message ?? "Enter a valid link title and URL."
      );
      return;
    }
    setResourceLinks((prev) => [...prev, parsed.data]);
    if (!title.trim()) setTitle(parsed.data.title);
    setNewLinkTitle("");
    setNewLinkUrl("");
    setNewLinkDesc("");
  }

  async function handleCreateVideoLesson() {
    if (!title.trim()) {
      setError("Enter a lesson title.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const saved = await saveLesson({
        courseId,
        sectionId,
        title: title.trim(),
        description: description.trim(),
        kind: "video",
        sortOrder: nextSortOrder,
        durationMinutes: Math.max(
          0,
          Math.min(600, Number(durationMinutes) || 0)
        ),
        isPreview,
      });
      if (!saved.ok || !saved.id) {
        setError(saved.error ?? "Could not create the video lesson.");
        return;
      }

      if (videoFile) {
        setUploadProgress(0);
        const grantResponse = await fetch("/api/media/video/grant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lessonId: saved.id,
            fileName: videoFile.name,
            contentType: videoFile.type || "video/mp4",
            sizeBytes: videoFile.size,
          }),
        });
        if (grantResponse.ok) {
          const grant = (await grantResponse.json()) as {
            endpoint?: string;
            tusEndpoint?: string;
            signature?: string;
            expiration?: number;
            videoId?: string;
            libraryId?: string;
            headers?: Record<string, string>;
          };
          const endpoint =
            grant.tusEndpoint ??
            grant.endpoint ??
            "https://video.bunnycdn.com/tusupload";
          const headers =
            grant.headers ??
            ({
              AuthorizationSignature: String(grant.signature ?? ""),
              AuthorizationExpire: String(grant.expiration ?? ""),
              VideoId: String(grant.videoId ?? ""),
              LibraryId: String(grant.libraryId ?? ""),
            } satisfies Record<string, string>);
          await tusUploadVideo(endpoint, headers, videoFile, (pct) =>
            setUploadProgress(Math.round(pct))
          );
        }
      }

      reset();
      onOpenChange(false);
      onCreated();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not finish creating the video lesson."
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateQuizLesson() {
    if (!title.trim()) {
      setError("Enter a quiz title.");
      return;
    }

    const validation = validateQuizQuestions(quizQuestions);
    setQuestionErrors(validation.questionErrors);
    if (!validation.valid) {
      setError(validation.error ?? "Complete all quiz questions before saving.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const saved = await saveLesson({
        courseId,
        sectionId,
        title: title.trim(),
        description: description.trim(),
        kind: "quiz",
        sortOrder: nextSortOrder,
        durationMinutes: Math.max(
          1,
          Math.min(
            600,
            Number(durationMinutes) || Math.max(5, quizQuestions.length * 2)
          )
        ),
        isPreview,
        quizConfig: {
          passingScorePercent,
          questions: quizQuestions,
        },
      });
      if (!saved.ok) {
        setError(saved.error ?? "Could not create the quiz lesson.");
        return;
      }
      reset();
      onOpenChange(false);
      onCreated();
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateResourcesLesson() {
    if (!title.trim()) {
      setError("Enter a title for this resources lesson.");
      return;
    }

    let finalLinks = [...resourceLinks];
    if (newLinkTitle.trim() || newLinkUrl.trim()) {
      const parsedLink = lessonResourceLinkSchema.safeParse({
        id: `lnk-${Date.now().toString(36)}`,
        title: newLinkTitle.trim() || title.trim(),
        url: newLinkUrl.trim(),
        description: newLinkDesc.trim(),
      });
      if (!parsedLink.success) {
        setError(
          parsedLink.error.issues[0]?.message ??
            "Enter a valid URL for the external link."
        );
        return;
      }
      finalLinks = [...finalLinks, parsedLink.data];
    }

    setBusy(true);
    setError(null);
    try {
      const saved = await saveLesson({
        courseId,
        sectionId,
        title: title.trim(),
        description: description.trim(),
        kind: "reading",
        sortOrder: nextSortOrder,
        durationMinutes: Math.max(
          0,
          Math.min(600, Number(durationMinutes) || 5)
        ),
        isPreview,
        resourceLinks: finalLinks,
      });
      if (!saved.ok || !saved.id) {
        setError(saved.error ?? "Could not create the resources lesson.");
        return;
      }

      if (resourceFile) {
        const mimeType = resolveResourceMimeType(resourceFile);
        const res = await fetch("/api/storage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "upload",
            kind: "resource",
            courseId,
            lessonId: saved.id,
            fileName: resourceFile.name,
            contentType: mimeType,
            sizeBytes: resourceFile.size,
            title:
              resourceFileTitle.trim() || title.trim() || resourceFile.name,
          }),
        });
        const payload = (await res.json().catch(() => ({}))) as {
          url?: string;
        };
        if (res.ok && payload.url) {
          await fetch(payload.url, {
            method: "PUT",
            headers: { "Content-Type": mimeType },
            body: resourceFile,
          });
        }
      }

      reset();
      onOpenChange(false);
      onCreated();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not save the resources lesson."
      );
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "video") void handleCreateVideoLesson();
    else if (mode === "quiz") void handleCreateQuizLesson();
    else void handleCreateResourcesLesson();
  }

  const options = [
    {
      id: "video" as Mode,
      label: "Video lesson",
      desc: "Upload a video & configure preview",
      icon: Video,
    },
    {
      id: "quiz" as Mode,
      label: "Interactive quiz",
      desc: "Multiple-choice & true/false questions",
      icon: HelpCircle,
    },
    {
      id: "resource" as Mode,
      label: "Resources & reading",
      desc: "Downloadable files, notes & links",
      icon: FileUp,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a lesson to &ldquo;{sectionTitle}&rdquo;</DialogTitle>
          <DialogDescription>
            Choose the lesson type below. Everything you enter is saved to your course curriculum.
          </DialogDescription>
        </DialogHeader>

        {/* Lesson Kind Selector */}
        <div
          className="grid grid-cols-3 gap-2.5"
          role="radiogroup"
          aria-label="Lesson type"
        >
          {options.map((opt) => {
            const Icon = opt.icon;
            const active = mode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={busy}
                onClick={() => {
                  setMode(opt.id);
                  setError(null);
                }}
                className={cn(
                  "flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-all",
                  active
                    ? "border-primary bg-primary/[0.06] text-foreground shadow-2xs"
                    : "border-border bg-white text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                )}
              >
                <Icon
                  className={cn(
                    "size-4",
                    active ? "text-primary" : "text-zinc-400"
                  )}
                  aria-hidden="true"
                />
                <div>
                  <p className="text-[12.5px] font-semibold leading-tight text-foreground">
                    {opt.label}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                    {opt.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700"
            >
              <AlertCircle
                className="mt-0.5 size-3.5 shrink-0 text-red-600"
                aria-hidden="true"
              />
              <span>{error}</span>
            </div>
          ) : null}

          {/* VIDEO LESSON MODE */}
          {mode === "video" ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="add-video-title"
                  className="block text-[12.5px] font-medium text-foreground"
                >
                  Lesson title <span className="text-primary">*</span>
                </label>
                <Input
                  id="add-video-title"
                  value={title}
                  maxLength={160}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={busy}
                  placeholder="e.g. Lesson 1: Architecture of a Tool-Calling Agent"
                />
              </div>

              {/* Video File Picker & Local Preview */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[12.5px] font-medium text-foreground">
                    Video file{" "}
                    <span className="font-normal text-muted-foreground">
                      (upload now or attach later on the lesson card)
                    </span>
                  </label>
                  <span className="text-[11px] text-zinc-400">
                    MP4, MOV, WebM, M4V · up to 2 GB
                  </span>
                </div>

                {videoFile && videoPreviewUrl ? (
                  <div className="rounded-xl border border-primary/30 bg-accent/30 p-3">
                    <div className="grid gap-3 sm:grid-cols-[200px_1fr] sm:items-center">
                      <div className="aspect-video w-full overflow-hidden rounded-lg border border-border bg-black">
                        <video
                          src={videoPreviewUrl}
                          controls
                          preload="metadata"
                          onLoadedMetadata={(e) => {
                            const secs = Math.round(
                              e.currentTarget.duration || 0
                            );
                            if (secs > 0) {
                              setDurationMinutes(
                                Math.max(1, Math.round(secs / 60))
                              );
                            }
                          }}
                          className="h-full w-full object-contain"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-[12.5px] font-semibold text-foreground">
                            {videoFile.name}
                          </p>
                          {!busy ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => {
                                setVideoFile(null);
                                if (videoPreviewUrl)
                                  URL.revokeObjectURL(videoPreviewUrl);
                                setVideoPreviewUrl(null);
                                if (videoInputRef.current)
                                  videoInputRef.current.value = "";
                              }}
                              aria-label="Remove selected video"
                            >
                              <X className="size-3.5" />
                            </Button>
                          ) : null}
                        </div>
                        <p className="text-[11.5px] text-muted-foreground">
                          {formatVideoBytes(videoFile.size)}
                        </p>
                        {uploadProgress !== null ? (
                          <div className="space-y-1 pt-1">
                            <div className="flex justify-between text-[11px] font-medium text-primary">
                              <span>Uploading video…</span>
                              <span>{uploadProgress}%</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200">
                              <div
                                className="h-full bg-primary transition-all"
                                style={{ width: `${uploadProgress}%` }}
                              />
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => videoInputRef.current?.click()}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/60 px-4 py-3.5 text-left transition-colors hover:border-primary/40 hover:bg-accent/30"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-primary">
                        <Film className="size-4" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="text-[12.5px] font-medium text-foreground">
                          Click to select an MP4, MOV, WebM, or M4V video
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Or leave empty to create the lesson placeholder and upload later
                        </p>
                      </div>
                    </div>
                    <span className="rounded-md border border-border bg-white px-2.5 py-1 text-[11.5px] font-medium text-foreground shadow-2xs">
                      Browse
                    </span>
                  </button>
                )}

                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm,video/x-m4v,.mp4,.mov,.webm,.m4v"
                  className="hidden"
                  onChange={(e) =>
                    handlePickVideo(e.target.files?.[0] ?? null)
                  }
                />
              </div>

              {/* Optional Lesson Description & Settings */}
              <div className="space-y-1.5">
                <label
                  htmlFor="add-video-desc"
                  className="block text-[12.5px] font-medium text-foreground"
                >
                  Lesson description / summary{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </label>
                <Textarea
                  id="add-video-desc"
                  rows={2}
                  maxLength={2000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={busy}
                  placeholder="Briefly summarize key takeaways or timestamps for learners…"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label
                    htmlFor="add-video-duration"
                    className="block text-[12px] font-medium text-foreground"
                  >
                    Duration (minutes)
                  </label>
                  <Input
                    id="add-video-duration"
                    type="number"
                    min={0}
                    max={600}
                    value={durationMinutes}
                    onChange={(e) =>
                      setDurationMinutes(Number(e.target.value) || 0)
                    }
                    disabled={busy}
                    className="h-9"
                  />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-foreground">
                    <input
                      type="checkbox"
                      checked={isPreview}
                      onChange={(e) => setIsPreview(e.target.checked)}
                      disabled={busy}
                      className="size-4 rounded border-zinc-300 accent-primary"
                    />
                    <span>Allow free preview on public course page</span>
                  </label>
                </div>
              </div>
            </div>
          ) : null}

          {/* QUIZ LESSON MODE */}
          {mode === "quiz" ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                <div className="space-y-1.5">
                  <label
                    htmlFor="add-quiz-title"
                    className="block text-[12.5px] font-medium text-foreground"
                  >
                    Quiz title <span className="text-primary">*</span>
                  </label>
                  <Input
                    id="add-quiz-title"
                    value={title}
                    maxLength={160}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={busy}
                    placeholder="e.g. Module 1 Knowledge Check"
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="add-quiz-duration"
                    className="block text-[12.5px] font-medium text-foreground"
                  >
                    Est. time (min)
                  </label>
                  <Input
                    id="add-quiz-duration"
                    type="number"
                    min={1}
                    max={600}
                    value={durationMinutes}
                    onChange={(e) =>
                      setDurationMinutes(Number(e.target.value) || 5)
                    }
                    disabled={busy}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="add-quiz-instructions"
                  className="block text-[12.5px] font-medium text-foreground"
                >
                  Quiz instructions{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </label>
                <Textarea
                  id="add-quiz-instructions"
                  rows={2}
                  maxLength={2000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={busy}
                  placeholder="Instructions or topics covered in this knowledge check…"
                />
              </div>

              <QuizBuilder
                questions={quizQuestions}
                onChange={(next) => {
                  setQuizQuestions(next);
                  setQuestionErrors({});
                }}
                passingScorePercent={passingScorePercent}
                onPassingScoreChange={setPassingScorePercent}
                questionErrors={questionErrors}
                disabled={busy}
              />
            </div>
          ) : null}

          {/* RESOURCES & READING LESSON MODE */}
          {mode === "resource" ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="add-res-title"
                  className="block text-[12.5px] font-medium text-foreground"
                >
                  Resources lesson title <span className="text-primary">*</span>
                </label>
                <Input
                  id="add-res-title"
                  value={title}
                  maxLength={160}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={busy}
                  placeholder="e.g. Starter Templates, Cheat Sheet & Reference Links"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="add-res-notes"
                  className="block text-[12.5px] font-medium text-foreground"
                >
                  Reading notes &amp; instructions for learners{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </label>
                <Textarea
                  id="add-res-notes"
                  rows={3}
                  maxLength={2000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={busy}
                  placeholder="Explain how learners should use the attached downloadable files or reference links…"
                />
              </div>

              {/* Attach a downloadable file */}
              <div className="rounded-xl border border-border bg-zinc-50/60 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[12.5px] font-semibold text-foreground">
                      Attach downloadable file{" "}
                      <span className="font-normal text-muted-foreground">
                        (optional)
                      </span>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      PDF, ZIP, DOCX, XLSX, PPTX, CSV, TXT, MD · up to{" "}
                      {MAX_RESOURCE_MB} MB
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    onClick={() => resourceInputRef.current?.click()}
                  >
                    <Upload className="size-3.5" aria-hidden="true" />
                    {resourceFile ? "Change file" : "Choose file"}
                  </Button>
                </div>

                {resourceFile ? (
                  <div className="mt-3 space-y-2 rounded-lg border border-sky-200 bg-sky-50/60 p-2.5">
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="truncate font-semibold text-foreground">
                        {resourceFile.name}
                      </span>
                      <span className="text-muted-foreground">
                        {formatResourceBytes(resourceFile.size)}
                      </span>
                    </div>
                    <Input
                      value={resourceFileTitle}
                      maxLength={200}
                      onChange={(e) => setResourceFileTitle(e.target.value)}
                      placeholder="Display name for this downloadable file"
                      className="h-8 bg-white text-[12px]"
                    />
                  </div>
                ) : null}

                <input
                  ref={resourceInputRef}
                  type="file"
                  accept=".pdf,.zip,.txt,.md,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                  className="hidden"
                  onChange={(e) =>
                    handlePickResourceFile(e.target.files?.[0] ?? null)
                  }
                />
              </div>

              {/* Attach external reference links */}
              <div className="rounded-xl border border-border bg-zinc-50/60 p-3.5">
                <p className="text-[12.5px] font-semibold text-foreground">
                  External reference links{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </p>
                <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                  <Input
                    value={newLinkTitle}
                    maxLength={160}
                    onChange={(e) => setNewLinkTitle(e.target.value)}
                    placeholder="Link title (e.g. GitHub Repo)"
                    className="h-9 bg-white text-[12px]"
                  />
                  <div className="flex gap-1.5">
                    <Input
                      type="url"
                      value={newLinkUrl}
                      onChange={(e) => setNewLinkUrl(e.target.value)}
                      placeholder="https://..."
                      className="h-9 bg-white text-[12px]"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddResourceLinkToStaging}
                      className="shrink-0"
                    >
                      <Plus className="size-3.5" aria-hidden="true" />
                      Add
                    </Button>
                  </div>
                </div>

                {resourceLinks.length > 0 ? (
                  <ul className="mt-2.5 space-y-1.5">
                    {resourceLinks.map((lnk) => (
                      <li
                        key={lnk.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border bg-white px-2.5 py-1.5 text-[12px]"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <Link2 className="size-3.5 shrink-0 text-primary" />
                          <span className="truncate font-medium text-foreground">
                            {lnk.title}
                          </span>
                          <span className="truncate text-muted-foreground">
                            ({lnk.url})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setResourceLinks((prev) =>
                              prev.filter((item) => item.id !== lnk.id)
                            )
                          }
                          className="text-muted-foreground hover:text-red-600"
                          aria-label={`Remove ${lnk.title}`}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
              {mode === "video"
                ? videoFile
                  ? "Create & upload video"
                  : "Create video lesson"
                : mode === "quiz"
                  ? `Save quiz (${quizQuestions.length} ${
                      quizQuestions.length === 1 ? "question" : "questions"
                    })`
                  : "Create resources lesson"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
