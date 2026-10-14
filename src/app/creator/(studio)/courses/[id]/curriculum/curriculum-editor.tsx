"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { GripVertical, PlayCircle, Trash2, Upload, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { deleteLesson, deleteSection, saveLesson, saveSection } from "@/app/creator/actions";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

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

/**
 * Curriculum editor.
 *
 * Structure is persisted by server actions that re-check ownership. Video bytes
 * go straight to Bunny Stream over a short-lived, video-scoped TUS grant minted
 * by `/api/media/video/grant` — the Bunny API key never reaches the browser,
 * and a lesson is only marked playable once Bunny itself reports encoding
 * finished.
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

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">{error}</p>
      ) : null}

      {sortedSections.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-muted/40 px-6 py-10 text-center">
          <p className="text-[14px] font-medium">No sections yet</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            A course can start as one section. Add your first section below.
          </p>
        </div>
      ) : null}

      {sortedSections.map((section) => {
        const sectionLessons = lessons
          .filter((lesson) => lesson.sectionId === section.id)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        return (
          <section key={section.id} className="rounded-xl border border-border bg-white shadow-card">
            <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
              <GripVertical className="size-4 shrink-0 text-zinc-400" aria-hidden />
              <span className="min-w-0 flex-1 font-display text-[14.5px] font-semibold tracking-tight">
                {section.title}
              </span>
              <span className="text-[12px] text-muted-foreground">
                {sectionLessons.length} lesson{sectionLessons.length === 1 ? "" : "s"}
              </span>
              {editable ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    if (!window.confirm(`Delete “${section.title}” and its lessons?`)) return;
                    void run(async () => {
                      const result = await deleteSection(section.id, courseId);
                      if (!result.ok) setError(result.error ?? "Could not delete the section");
                    });
                  }}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              ) : null}
            </header>

            <ul className="divide-y divide-border">
              {sectionLessons.map((lesson) => (
                <LessonRow key={lesson.id} courseId={courseId} lesson={lesson} editable={editable} />
              ))}
            </ul>

            {editable ? (
              <AddLessonForm
                courseId={courseId}
                sectionId={section.id}
                sortOrder={sectionLessons.length}
                onError={setError}
              />
            ) : null}
          </section>
        );
      })}

      {editable ? (
        <div className="rounded-xl border border-border bg-white p-4 shadow-card">
          <Label htmlFor="new-section" className="mb-1.5 block text-[13px]">Add a section</Label>
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
              Add
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

function AddLessonForm({
  courseId,
  sectionId,
  sortOrder,
  onError,
}: {
  courseId: string;
  sectionId: string;
  sortOrder: number;
  onError: (message: string | null) => void;
}) {
  const [title, setTitle] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  return (
    <form
      className="flex gap-2 border-t border-border px-4 py-3"
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        void saveLesson({ courseId, sectionId, title, kind: "video", sortOrder, durationMinutes: 0, isPreview: false })
          .then((result) => {
            if (!result.ok) onError(result.error ?? "Could not add the lesson");
            else setTitle("");
          })
          .catch(() => onError("Could not add the lesson"))
          .finally(() => setBusy(false));
      }}
    >
      <Input
        aria-label="New lesson title"
        value={title}
        maxLength={160}
        placeholder="Add a lesson…"
        onChange={(event) => setTitle(event.target.value)}
      />
      <Button type="submit" size="sm" disabled={busy || !title.trim()}>
        Add lesson
      </Button>
    </form>
  );
}

function LessonRow({
  courseId,
  lesson,
  editable,
}: {
  courseId: string;
  lesson: CurriculumLesson;
  editable: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [uploadState, setUploadState] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const fileInput = React.useRef<HTMLInputElement>(null);

  async function onFile(file: File) {
    setBusy(true);
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
      setUploadState("Uploading to Bunny Stream…");
      await tusUpload(grant, file);
      setUploadState("Upload complete — waiting for Bunny to finish encoding…");
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
            : `Bunny reports “${payload.status}”. Playback unlocks when encoding finishes.`
        );
      }
      router.refresh();
    } catch {
      setError("The upload failed. Check your connection and try again.");
      setUploadState(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <PlayCircle className="size-4 shrink-0 text-zinc-400" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-medium">{lesson.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
            <span>{lesson.kind}</span>
            {lesson.durationMinutes > 0 ? <span>· {lesson.durationMinutes} min</span> : null}
            {lesson.isPreview ? <span className="text-emerald-700">· free preview</span> : null}
            {lesson.hasVideo ? <VideoState state={lesson.bunnyStatus} ready={lesson.playbackReady} /> : null}
          </p>
        </div>
        {editable ? (
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
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => fileInput.current?.click()}>
              <Upload className="size-4" aria-hidden />
              {lesson.hasVideo ? "Replace video" : "Upload video"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(!open)}>
              {open ? "Close" : "Edit"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                if (!window.confirm(`Delete “${lesson.title}”?`)) return;
                setBusy(true);
                void deleteLesson(lesson.id, courseId)
                  .then((result) => !result.ok && setError(result.error ?? "Could not delete the lesson"))
                  .finally(() => {
                    setBusy(false);
                    router.refresh();
                  });
              }}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </>
        ) : null}
      </div>

      {uploadState ? <p className="mt-2 text-[12.5px] text-muted-foreground">{uploadState}</p> : null}
      {error ? <p className="mt-2 text-[12.5px] text-red-600">{error}</p> : null}

      {open && editable ? <LessonEditor courseId={courseId} lesson={lesson} /> : null}
    </li>
  );
}

function VideoState({ state, ready }: { state: string | null; ready: boolean }) {
  const Icon = ready ? CheckCircle2 : Loader2;
  return (
    <span className={cn("inline-flex items-center gap-1", ready ? "text-emerald-700" : "text-amber-700")}>
      <Icon className={cn("size-3.5", !ready && "animate-spin")} aria-hidden />
      {state ?? "uploading"}
    </span>
  );
}

function LessonEditor({ courseId, lesson }: { courseId: string; lesson: CurriculumLesson }) {
  const router = useRouter();
  const [title, setTitle] = React.useState(lesson.title);
  const [description, setDescription] = React.useState(lesson.description);
  const [kind, setKind] = React.useState(lesson.kind);
  const [duration, setDuration] = React.useState(String(lesson.durationMinutes));
  const [isPreview, setIsPreview] = React.useState(lesson.isPreview);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  return (
    <form
      className="mt-3 grid gap-3 rounded-lg border border-border bg-muted/30 p-3.5 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        setMessage(null);
        void saveLesson({
          courseId,
          id: lesson.id,
          sectionId: lesson.sectionId,
          title,
          description,
          kind,
          sortOrder: lesson.sortOrder,
          durationMinutes: Number(duration) || 0,
          isPreview,
        })
          .then((result) => {
            if (!result.ok) setMessage(result.error ?? "Could not save");
            else {
              setMessage("Saved");
              router.refresh();
            }
          })
          .finally(() => setBusy(false));
      }}
    >
      <div className="sm:col-span-2">
        <Label htmlFor={`lt-${lesson.id}`} className="mb-1.5 block text-[12.5px]">Lesson title</Label>
        <Input id={`lt-${lesson.id}`} value={title} maxLength={160} onChange={(event) => setTitle(event.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor={`ld-${lesson.id}`} className="mb-1.5 block text-[12.5px]">Lesson notes</Label>
        <Textarea id={`ld-${lesson.id}`} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
      </div>
      <div>
        <Label htmlFor={`lk-${lesson.id}`} className="mb-1.5 block text-[12.5px]">Type</Label>
        <select
          id={`lk-${lesson.id}`}
          className="h-9.5 w-full rounded-lg border border-input bg-white px-3 text-sm"
          value={kind}
          onChange={(event) => setKind(event.target.value)}
        >
          <option value="video">Video</option>
          <option value="reading">Reading</option>
          <option value="quiz">Quiz</option>
        </select>
      </div>
      <div>
        <Label htmlFor={`lmin-${lesson.id}`} className="mb-1.5 block text-[12.5px]">Duration (minutes)</Label>
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
        <Button type="submit" size="sm" disabled={busy}>{busy ? "Saving…" : "Save lesson"}</Button>
        {message ? <span className="text-[12.5px] text-muted-foreground">{message}</span> : null}
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

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload rejected (${xhr.status})`));
    };

    xhr.send(file);
  });
}