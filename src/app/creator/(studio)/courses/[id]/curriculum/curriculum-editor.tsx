"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  HelpCircle,
  Loader2,
  Pencil,
  PlayCircle,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
import {
  deleteLesson,
  deleteSection,
  reorderLessons,
  reorderSections,
  saveLesson,
  saveSection,
} from "@/app/creator/actions";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { AddLessonDialog } from "./add-lesson-dialog";

export interface CurriculumSection {
  id: string;
  title: string;
  sortOrder: number;
}

export interface CurriculumLesson {
  id: string;
  sectionId: string;
  title: string;
  description: string;
  kind: string;
  sortOrder: number;
  durationMinutes: number;
  isPreview: boolean;
  bunnyStatus: string | null;
  playbackReady: boolean;
  hasVideo: boolean;
}

interface UploadGrant {
  url: string;
  tusEndpoint: string;
  headers: Record<string, string>;
  expiresAt: string;
  videoId: string;
}

const KIND_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  video: { label: "Video", icon: Video },
  reading: { label: "Reading", icon: BookOpen },
  quiz: { label: "Quiz", icon: HelpCircle },
};

const LESSON_KINDS = ["video", "reading", "quiz"] as const;

const VIDEO_STATE_META: Record<string, { label: string; tone: "busy" | "ready" | "error" }> = {
  uploading: { label: "Uploading video…", tone: "busy" },
  processing: { label: "Processing — playback unlocks when processing finishes", tone: "busy" },
  ready: { label: "Ready to play", tone: "ready" },
  error: { label: "Processing failed — upload the video again", tone: "error" },
  deleted: { label: "Video removed — upload a new one", tone: "error" },
};

/**
 * Curriculum editor — wizard step 2.
 *
 * Structure is persisted by server actions that re-check ownership; ordering is
 * persisted through `reorderSections` / `reorderLessons`, so the Move up/down
 * controls change the real saved order. Video bytes go straight to the video host
 * over a short-lived, video-scoped TUS grant minted by `/api/media/video/grant`
 * — the hosting key never reaches the browser, and a lesson is only marked
 * playable once processing is reported finished.
 */
export function CurriculumEditor({
  courseId,
  sections,
  lessons,
  editable,
}: {
  courseId: string;
  sections: CurriculumSection[];
  lessons: CurriculumLesson[];
  editable: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [newSection, setNewSection] = React.useState("");

  const sortedSections = [...sections].sort((a, b) => a.sortOrder - b.sortOrder);
  const defaultSectionStarted = React.useRef(false);
  React.useEffect(() => {
    if (!editable || sortedSections.length > 0 || defaultSectionStarted.current) return;
    defaultSectionStarted.current = true;
    void saveSection({ courseId, title: "Getting Started!", sortOrder: 0 }).then(() => router.refresh());
  }, [editable, sortedSections.length, courseId, router]);

  async function run<T>(action: () => Promise<T>): Promise<T | null> {
    setBusy(true);
    setError(null);
    try {
      return await action();
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  function moveSection(sectionId: string, direction: -1 | 1) {
    const index = sortedSections.findIndex((section) => section.id === sectionId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= sortedSections.length) return;
    const ordered = [...sortedSections];
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    void run(async () => {
      const result = await reorderSections({ courseId, ids: ordered.map((section) => section.id) });
      if (!result.ok) setError(result.error ?? "Could not reorder the sections");
    });
  }

  function moveLesson(sectionId: string, lessonId: string, direction: -1 | 1) {
    const inSection = lessons
      .filter((lesson) => lesson.sectionId === sectionId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const index = inSection.findIndex((lesson) => lesson.id === lessonId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= inSection.length) return;
    const ordered = [...inSection];
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    void run(async () => {
      const result = await reorderLessons({
        courseId,
        sectionId,
        ids: ordered.map((lesson) => lesson.id),
      });
      if (!result.ok) setError(result.error ?? "Could not reorder the lessons");
    });
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">
          {error}
        </p>
      ) : null}

      {sortedSections.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-muted/40 px-6 py-10 text-center">
          <ClipboardList className="mx-auto size-6 text-zinc-400" aria-hidden />
          <p className="mt-2 text-[14px] font-medium">Setting up your first section…</p>
        </div>
      ) : null}

      {sortedSections.map((section, sectionIndex) => {
        const sectionLessons = lessons
          .filter((lesson) => lesson.sectionId === section.id)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        return (
          <SectionCard
            key={section.id}
            courseId={courseId}
            section={section}
            sectionIndex={sectionIndex}
            sectionCount={sortedSections.length}
            lessons={sectionLessons}
            editable={editable}
            busy={busy}
            onDeleteSection={(target) => {
              if (!window.confirm(`Delete “${target.title}” and its lessons?`)) return;
              void run(async () => {
                const result = await deleteSection(target.id, courseId);
                if (!result.ok) setError(result.error ?? "Could not delete the section");
              });
            }}
            onMoveSection={moveSection}
            onMoveLesson={moveLesson}
            onError={setError}
            run={run}
          />
        );
      })}

      {editable ? (
        <div className="rounded-2xl border border-border bg-white p-4 shadow-card">
          <Label htmlFor="new-section" className="mb-1.5 block text-[13px]">
            Add a section
          </Label>
          <p className="mb-2 text-[12px] text-zinc-400">
            Sections group related lessons, e.g. “Getting started” or “Building your first agent”.
          </p>
          <div className="flex gap-2">
            <Input
              id="new-section"
              value={newSection}
              maxLength={120}
              placeholder="Getting started"
              onChange={(event) => setNewSection(event.target.value)}
            />
            <Button
              type="button"
              disabled={busy || !newSection.trim()}
              onClick={() =>
                void run(async () => {
                  const result = await saveSection({
                    courseId,
                    title: newSection,
                    sortOrder: sortedSections.length,
                  });
                  if (!result.ok) setError(result.error ?? "Could not add the section");
                  else setNewSection("");
                })
              }
            >
              Add section
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-[13px] text-muted-foreground">
          This course is published, so its curriculum is locked. Ask an administrator to unpublish it to make
          changes.
        </p>
      )}
    </div>
  );
}

function SectionCard({
  courseId,
  section,
  sectionIndex,
  sectionCount,
  lessons,
  editable,
  busy,
  onDeleteSection,
  onMoveSection,
  onMoveLesson,
  onError,
  run,
}: {
  courseId: string;
  section: CurriculumSection;
  sectionIndex: number;
  sectionCount: number;
  lessons: CurriculumLesson[];
  editable: boolean;
  busy: boolean;
  onDeleteSection: (section: CurriculumSection) => void;
  onMoveSection: (sectionId: string, direction: -1 | 1) => void;
  onMoveLesson: (sectionId: string, lessonId: string, direction: -1 | 1) => void;
  onError: (message: string | null) => void;
  run: <T>(action: () => Promise<T>) => Promise<T | null>;
}) {
  const [renaming, setRenaming] = React.useState(false);
  const [title, setTitle] = React.useState(section.title);
  const totalMinutes = lessons.reduce((sum, lesson) => sum + lesson.durationMinutes, 0);

  return (
    <section className="rounded-2xl border border-border bg-white shadow-card">
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <span
          className="flex size-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[11px] font-semibold text-zinc-600"
          aria-hidden
        >
          {sectionIndex + 1}
        </span>

        {renaming && editable ? (
          <form
            className="flex min-w-0 flex-1 items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                const result = await saveSection({
                  courseId,
                  id: section.id,
                  title,
                  sortOrder: section.sortOrder,
                });
                if (!result.ok) onError(result.error ?? "Could not rename the section");
                else setRenaming(false);
              });
            }}
          >
            <Input
              aria-label="Section title"
              value={title}
              maxLength={120}
              autoFocus
              onChange={(event) => setTitle(event.target.value)}
            />
            <Button type="submit" size="sm" disabled={busy || !title.trim()}>
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setTitle(section.title);
                setRenaming(false);
              }}
            >
              Cancel
            </Button>
          </form>
        ) : (
          <>
            <h2 className="min-w-0 flex-1 truncate font-display text-[14.5px] font-semibold tracking-tight">
              {section.title}
            </h2>
            <p className="text-[12px] text-muted-foreground">
              {lessons.length} lesson{lessons.length === 1 ? "" : "s"}
              {totalMinutes > 0 ? ` · ${totalMinutes} min` : ""}
            </p>
          </>
        )}

        {editable && !renaming ? (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={`Move section “${section.title}” up`}
              title="Move up"
              disabled={busy || sectionIndex === 0}
              onClick={() => onMoveSection(section.id, -1)}
            >
              <ArrowUp className="size-4" aria-hidden />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={`Move section “${section.title}” down`}
              title="Move down"
              disabled={busy || sectionIndex === sectionCount - 1}
              onClick={() => onMoveSection(section.id, 1)}
            >
              <ArrowDown className="size-4" aria-hidden />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={`Rename section “${section.title}”`}
              title="Rename section"
              disabled={busy}
              onClick={() => setRenaming(true)}
            >
              <Pencil className="size-4" aria-hidden />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={`Delete section “${section.title}”`}
              title="Delete section"
              disabled={busy}
              onClick={() => onDeleteSection(section)}
            >
              <Trash2 className="size-4 text-red-600" aria-hidden />
            </Button>
          </div>
        ) : null}
      </header>

      {lessons.length === 0 ? (
        <p className="px-4 py-5 text-[13px] text-muted-foreground">
          No lessons in this section yet. Add the first one below — a video lesson can start as an upload you
          finish later.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {lessons.map((lesson, lessonIndex) => (
            <LessonRow
              key={lesson.id}
              courseId={courseId}
              lesson={lesson}
              lessonIndex={lessonIndex}
              lessonCount={lessons.length}
              editable={editable}
              busy={busy}
              onMove={(lessonId, direction) => onMoveLesson(section.id, lessonId, direction)}
              onError={onError}
              run={run}
            />
          ))}
        </ul>
      )}

      {editable ? (
        <AddLessonDialog courseId={courseId} sectionId={section.id} sortOrder={lessons.length} disabled={busy} />
      ) : null}
    </section>
  );
}

function LessonRow({
  courseId,
  lesson,
  lessonIndex,
  lessonCount,
  editable,
  busy,
  onMove,
  onError,
  run,
}: {
  courseId: string;
  lesson: CurriculumLesson;
  lessonIndex: number;
  lessonCount: number;
  editable: boolean;
  busy: boolean;
  onMove: (lessonId: string, direction: -1 | 1) => void;
  onError: (message: string | null) => void;
  run: <T>(action: () => Promise<T>) => Promise<T | null>;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [uploadState, setUploadState] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const fileInput = React.useRef<HTMLInputElement>(null);
  const kindMeta = KIND_META[lesson.kind] ?? KIND_META.video;
  const KindIcon = kindMeta.icon;

  async function onFile(file: File) {
    setUploading(true);
    setError(null);
    setUploadState("Requesting an upload grant…");
    try {
      const grantResponse = await fetch("/api/media/video/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId: lesson.id,
          fileName: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        }),
      });
      if (!grantResponse.ok) {
        const payload = (await grantResponse.json().catch(() => ({}))) as { error?: string };
        setError(payload.error ?? "Could not start the upload");
        setUploadState(null);
        return;
      }
      const grant = (await grantResponse.json()) as UploadGrant;
      setUploadState("Uploading video…");
      await tusUpload(grant, file);
      setUploadState("Upload complete — processing will finish shortly…");
      // Bunny encodes asynchronously; the webhook flips the lesson to playable.
      const status = await fetch("/api/media/video/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId: lesson.id }),
      });
      if (status.ok) {
        const payload = (await status.json()) as { status: string; ready: boolean };
        setUploadState(
          payload.ready
            ? "Ready to play."
            : `Status: “${payload.status}”. Playback unlocks when processing finishes.`
        );
      }
      router.refresh();
    } catch {
      setError("The upload failed. Check your connection and try again.");
      setUploadState(null);
    } finally {
      setUploading(false);
    }
  }

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <KindIcon className="size-4 shrink-0 text-zinc-400" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-medium">{lesson.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
            <span>{kindMeta.label}</span>
            {lesson.durationMinutes > 0 ? <span>· {lesson.durationMinutes} min</span> : null}
            {lesson.isPreview ? <span className="text-emerald-700">· free preview</span> : null}
            {lesson.kind === "video" ? <VideoState state={lesson.bunnyStatus} ready={lesson.playbackReady} hasVideo={lesson.hasVideo} /> : null}
          </p>
        </div>

        {editable ? (
          <>
            {lesson.kind === "video" ? (
              <>
                <input
                  ref={fileInput}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void onFile(file);
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy || uploading}
                  onClick={() => fileInput.current?.click()}
                >
                  <Upload className="size-4" aria-hidden />
                  {lesson.hasVideo ? "Replace video" : "Upload video"}
                </Button>
              </>
            ) : null}
            <Button type="button" size="icon-sm" variant="ghost" aria-label={`Move “${lesson.title}” up`} title="Move up" disabled={busy || lessonIndex === 0} onClick={() => onMove(lesson.id, -1)}>
              <ArrowUp className="size-4" aria-hidden />
            </Button>
            <Button type="button" size="icon-sm" variant="ghost" aria-label={`Move “${lesson.title}” down`} title="Move down" disabled={busy || lessonIndex === lessonCount - 1} onClick={() => onMove(lesson.id, 1)}>
              <ArrowDown className="size-4" aria-hidden />
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(!open)} aria-expanded={open}>
              {open ? "Close" : "Edit"}
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={`Delete lesson “${lesson.title}”`}
              title="Delete lesson"
              disabled={busy || uploading}
              onClick={() => {
                if (!window.confirm(`Delete “${lesson.title}”?`)) return;
                void run(async () => {
                  const result = await deleteLesson(lesson.id, courseId);
                  if (!result.ok) onError(result.error ?? "Could not delete the lesson");
                });
              }}
            >
              <Trash2 className="size-4 text-red-600" aria-hidden />
            </Button>
          </>
        ) : null}
      </div>

      {uploadState ? (
        <p role="status" className="mt-2 flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
          {uploading ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
          {uploadState}
        </p>
      ) : null}
      {error ? <p className="mt-2 text-[12.5px] text-red-600">{error}</p> : null}

      {open && editable ? <LessonEditor courseId={courseId} lesson={lesson} run={run} /> : null}
    </li>
  );
}

function VideoState({ state, ready, hasVideo }: { state: string | null; ready: boolean; hasVideo: boolean }) {
  if (ready) {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-700">
        <CheckCircle2 className="size-3.5" aria-hidden />
        Ready to play
      </span>
    );
  }
  if (!hasVideo) {
    return (
      <span className="inline-flex items-center gap-1 text-amber-700">
        <PlayCircle className="size-3.5" aria-hidden />
        No video uploaded yet
      </span>
    );
  }
  const meta = VIDEO_STATE_META[state ?? "uploading"] ?? VIDEO_STATE_META.uploading;
  const Icon = meta.tone === "error" ? AlertTriangle : Loader2;
  return (
    <span className={cn("inline-flex items-center gap-1", meta.tone === "error" ? "text-red-600" : "text-amber-700")}>
      <Icon className={cn("size-3.5", meta.tone === "busy" && "animate-spin")} aria-hidden />
      {meta.label}
    </span>
  );
}

function LessonEditor({
  courseId,
  lesson,
  run,
}: {
  courseId: string;
  lesson: CurriculumLesson;
  run: <T>(action: () => Promise<T>) => Promise<T | null>;
}) {
  const [title, setTitle] = React.useState(lesson.title);
  const [description, setDescription] = React.useState(lesson.description);
  const [kind, setKind] = React.useState(lesson.kind);
  const [duration, setDuration] = React.useState(String(lesson.durationMinutes));
  const [isPreview, setIsPreview] = React.useState(lesson.isPreview);
  const [message, setMessage] = React.useState<string | null>(null);

  return (
    <form
      className="mt-3 grid gap-3 rounded-lg border border-border bg-muted/30 p-3.5 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        setMessage(null);
        void run(async () => {
          const result = await saveLesson({
            courseId,
            id: lesson.id,
            sectionId: lesson.sectionId,
            title,
            description,
            kind,
            sortOrder: lesson.sortOrder,
            durationMinutes: Number(duration) || 0,
            isPreview,
          });
          if (!result.ok) {
            setMessage(result.error ?? "Could not save");
          } else {
            setMessage("Saved");
          }
        });
      }}
    >
      <div className="sm:col-span-2">
        <Label htmlFor={`lt-${lesson.id}`} className="mb-1.5 block text-[12.5px]">
          Lesson title
        </Label>
        <Input id={`lt-${lesson.id}`} value={title} maxLength={160} onChange={(event) => setTitle(event.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor={`ld-${lesson.id}`} className="mb-1.5 block text-[12.5px]">
          Lesson notes
        </Label>
        <Textarea
          id={`ld-${lesson.id}`}
          rows={3}
          maxLength={2000}
          value={description}
          placeholder="What does this lesson cover? Shown to learners on the curriculum list."
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>
      <div>
        <Label htmlFor={`lk-${lesson.id}`} className="mb-1.5 block text-[12.5px]">
          Type
        </Label>
        <select
          id={`lk-${lesson.id}`}
          className="h-9.5 w-full rounded-lg border border-input bg-white px-3 text-sm"
          value={kind}
          onChange={(event) => setKind(event.target.value)}
        >
          {LESSON_KINDS.map((value) => (
            <option key={value} value={value}>
              {KIND_META[value].label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor={`lmin-${lesson.id}`} className="mb-1.5 block text-[12.5px]">
          Duration (minutes)
        </Label>
        <Input
          id={`lmin-${lesson.id}`}
          inputMode="numeric"
          value={duration}
          onChange={(event) => setDuration(event.target.value)}
        />
      </div>
      <label className="flex items-center gap-2 text-[13px] sm:col-span-2">
        <input
          type="checkbox"
          checked={isPreview}
          onChange={(event) => setIsPreview(event.target.checked)}
          className="size-4 accent-[var(--primary)]"
        />
        Offer this lesson as a free preview
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" size="sm">
          Save lesson
        </Button>
        {message ? (
          <span role="status" className={message === "Saved" ? "text-[12.5px] text-emerald-700" : "text-[12.5px] text-red-600"}>
            {message}
          </span>
        ) : null}
      </div>
    </form>
  );
}

/**
 * Minimal TUS 1.0.0 upload using the server-minted grant.
 *
 * `tus-js-client` is intentionally not bundled: this is the only place Zybble
 * uploads video, and the protocol surface needed here is small.
 */
async function tusUpload(grant: UploadGrant, file: File): Promise<void> {
  const metadata = encodeURIComponent(
    Object.entries({ filename: file.name, filetype: file.type })
      .map(([key, value]) => `${key} ${btoa(value)}`)
      .join(",")
  );

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", grant.tusEndpoint, true);
    xhr.setRequestHeader("Tus-Resumable", "1.0.0");
    xhr.setRequestHeader("Upload-Length", String(file.size));
    xhr.setRequestHeader("Upload-Metadata", metadata);
    for (const [header, value] of Object.entries(grant.headers)) xhr.setRequestHeader(header, value);

    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload rejected (${xhr.status})`));
    };

    xhr.send(file);
  });
}
