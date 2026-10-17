"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  CircleCheck,
  Download,
  FileDown,
  FileText,
  GraduationCap,
  Lock,
  Package,
  PanelRight,
} from "lucide-react";
import type { FlatLesson, FlatSection } from "@/lib/learn";
import { nextLessonOf, prevLessonOf } from "@/lib/learn";
import { setLessonProgress, saveLessonNote } from "@/app/(learner)/actions";
import { VideoPlayer } from "@/components/learn/video-player";
import { CurriculumPanel } from "@/components/learn/curriculum-panel";
import { EnrollCard } from "@/components/courses/enroll-card";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import {
  getCleanLessonDescription,
  parseLessonQuiz,
  parseLessonResources,
} from "@/lib/course-wizard";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface LearningLesson {
  id: string;
  title: string;
  description: string | null;
  kind: string;
  sortOrder: number;
  durationMinutes: number;
  isPreview: boolean;
  hasVideo: boolean;
  videoReady: boolean;
  sectionId: string | null;
}

export interface LearningResource {
  id: string;
  title: string;
  fileName: string;
  sizeBytes: number;
}

/**
 * Lesson player.
 *
 * Every fact on this screen — the course, the lesson list, the completion set,
 * the notes and the resources — arrived from the server, which already refused
 * to render lessons the learner is not entitled to. The browser can only ask the
 * server to mark a lesson complete or save a note; it cannot widen its own
 * access.
 */
export function LearnPlayer({
  course,
  creatorName,
  sections,
  lessons,
  completedLessonIds,
  notes,
  lastLessonId,
  resources,
  progressPercent,
  enrolled,
  checkoutBlocked,
  initialLessonId,
}: {
  course: { id: string; slug: string; title: string; pricePaise: number };
  creatorName: string;
  sections: FlatSection[];
  lessons: LearningLesson[];
  completedLessonIds: string[];
  notes: Record<string, string>;
  lastLessonId: string | null;
  resources: LearningResource[];
  progressPercent: number;
  /** True when the server found an active entitlement. */
  enrolled: boolean;
  checkoutBlocked: string | null;
  initialLessonId: string | null;
}) {
  const router = useRouter();
  const [currentLessonId, setCurrentLessonId] = React.useState<string | null>(() => {
    if (initialLessonId && lessons.some((lesson) => lesson.id === initialLessonId)) return initialLessonId;
    if (lastLessonId && lessons.some((lesson) => lesson.id === lastLessonId)) return lastLessonId;
    return lessons[0]?.id ?? null;
  });
  const [completed, setCompleted] = React.useState<string[]>(completedLessonIds);
  const [busyLesson, setBusyLesson] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState("overview");
  const [panelOpen, setPanelOpen] = React.useState(false);

  const [noteState, setNoteState] = React.useState<{ lessonId: string; text: string } | null>(null);
  const [noteSaved, setNoteSaved] = React.useState(false);
  const noteTimer = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (noteTimer.current) window.clearTimeout(noteTimer.current);
    };
  }, []);

  const current: LearningLesson | null =
    lessons.find((lesson) => lesson.id === currentLessonId) ?? lessons[0] ?? null;
  const flat: FlatLesson[] = lessons.map((lesson) => ({
    id: lesson.id,
    sectionId: lesson.sectionId ?? "",
    title: lesson.title,
    description: lesson.description ?? "",
    kind: lesson.kind,
    sortOrder: lesson.sortOrder,
    durationMinutes: lesson.durationMinutes,
    isPreview: lesson.isPreview,
    playbackReady: lesson.videoReady,
  }));
  const next = current ? nextLessonOf(flat, current.id) : null;
  const prev = current ? prevLessonOf(flat, current.id) : null;
  const sectionTitle = current ? sections.find((section) => section.id === current.sectionId)?.title ?? "Course" : "";
  const isCurrentDone = current ? completed.includes(current.id) : false;
  const lessonNumber = current ? flat.findIndex((lesson) => lesson.id === current.id) + 1 : 0;

  const noteDraft =
    noteState && current && noteState.lessonId === current.id ? noteState.text : current ? notes[current.id] ?? "" : "";

  function persistNote(text: string) {
    if (!current) return;
    setNoteState({ lessonId: current.id, text });
    setNoteSaved(false);
    if (noteTimer.current) window.clearTimeout(noteTimer.current);
    const lessonId = current.id;
    noteTimer.current = window.setTimeout(async () => {
      const result = await saveLessonNote({ courseId: course.id, lessonId, body: text });
      if (result.ok) setNoteSaved(true);
      else toast.error(result.error ?? "Could not save this note");
    }, 800);
  }

  async function markComplete(lessonId: string, silent = false) {
    if (busyLesson) return;
    const wasDone = completed.includes(lessonId);
    setBusyLesson(lessonId);

    // Optimistic, then reconciled with whatever the server actually stored.
    setCompleted((previous) =>
      wasDone ? previous.filter((id) => id !== lessonId) : [...previous, lessonId]
    );

    const result = await setLessonProgress({ courseId: course.id, lessonId, completed: !wasDone });
    setBusyLesson(null);

    if (!result.ok) {
      setCompleted((previous) =>
        wasDone ? [...previous, lessonId] : previous.filter((id) => id !== lessonId)
      );
      toast.error(result.error ?? "Could not save your progress");
      return;
    }

    if (!wasDone && result.certificateCode) {
      toast.success(`You completed “${course.title}” — your certificate is ready.`, {
        action: { label: "View", onClick: () => router.push("/certificates") },
      });
    } else if (!silent) {
      toast.success(wasDone ? "Lesson marked incomplete" : "Lesson marked complete", {
        action: wasDone
          ? undefined
          : next
            ? { label: "Next lesson", onClick: () => setCurrentLessonId(next.id) }
            : undefined,
      });
    }
  }

  async function downloadResource(resource: LearningResource) {
    try {
      // The server verifies the entitlement before issuing a short-lived
      // pre-signed URL; the bucket itself is never public.
      const response = await fetch("/api/storage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "download", resourceId: resource.id }),
      });
      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) {
        toast.error(payload.error ?? "Download is not available");
        return;
      }
      const anchor = document.createElement("a");
      anchor.href = payload.url;
      anchor.download = resource.fileName || resource.title;
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch {
      toast.error("Could not download this file");
    }
  }

  /* -------------------------------- gates -------------------------------- */

  if (lessons.length === 0 || !current) {
    return (
      <div className="flex min-h-dvh flex-col bg-white">
        <header className="flex h-14 items-center gap-3 border-b border-border px-4">
          <Logo href="/" />
        </header>
        <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-16 text-center">
          <GraduationCap className="size-9 text-zinc-300" aria-hidden />
          <h1 className="font-display mt-4 text-2xl font-bold tracking-tight">This course has no lessons yet</h1>
          <p className="mt-2 max-w-sm text-[14.5px] leading-relaxed text-muted-foreground">
            The curriculum for “{course.title}” is still being built. Check back soon — or pick another course meanwhile.
          </p>
          <div className="mt-6 flex gap-2">
            <Button asChild>
              <Link href="/my-learning">My learning</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/">Explore courses</Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  if (!enrolled) {
    return (
      <div className="flex min-h-dvh flex-col bg-white">
        <header className="flex h-14 items-center gap-3 border-b border-border px-4">
          <Logo href="/" />
        </header>
        <main className="mx-auto flex w-full max-w-5xl flex-1 items-center px-4 py-12">
          <div className="grid w-full gap-8 md:grid-cols-[minmax(0,1fr)_340px]">
            <div>
              <span className="flex size-12 items-center justify-center rounded-xl bg-accent text-primary">
                <Lock className="size-5.5" aria-hidden />
              </span>
              <h1 className="font-display mt-4 text-2xl font-bold tracking-tight sm:text-3xl">Enrol to start learning</h1>
              <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
                “{course.title}” unlocks the full lesson player, notes, downloadable resources and progress tracking. The
                free preview lessons below stay open to everyone.
              </p>
              <Button asChild size="lg" className="mt-5">
                <Link href={`/checkout/${course.id}`}>
                  <GraduationCap aria-hidden />
                  {course.pricePaise === 0 ? "Enrol for free" : "Enrol now"}
                </Link>
              </Button>
            </div>
            <EnrollCard
              course={{
                id: course.id,
                slug: course.slug,
                title: course.title,
                pricePaise: course.pricePaise,
                compareAtPaise: null,
                lessonsCount: lessons.length,
                durationMinutes: lessons.reduce((sum, lesson) => sum + lesson.durationMinutes, 0),
                curriculum: [],
                downloadableResources: resources.length,
              } as never}
              enrolled={false}
              saved={false}
              checkoutBlocked={checkoutBlocked}
            />
          </div>
        </main>
      </div>
    );
  }

  /* --------------------------------- UI ---------------------------------- */

  const curriculumPanel = (
    <CurriculumPanel
      sections={sections}
      lessons={flat}
      completedLessonIds={completed}
      currentLessonId={current.id}
      onSelect={(lessonId) => {
        setCurrentLessonId(lessonId);
        setPanelOpen(false);
      }}
      onToggleComplete={(lessonId) => void markComplete(lessonId, true)}
    />
  );

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-white/90 px-3 backdrop-blur sm:gap-3 sm:px-4">
        <Button asChild variant="ghost" size="sm" className="-ml-1 shrink-0">
          <Link href="/my-learning" aria-label="Back to my learning">
            <ArrowLeft aria-hidden />
            <span className="hidden sm:inline">My learning</span>
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold">{course.title}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {creatorName} · {completed.filter((id) => lessons.some((lesson) => lesson.id === id)).length}/{lessons.length} lessons
          </p>
        </div>
        <div className="hidden w-40 items-center gap-2 md:flex">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressPercent}%` }} />
          </div>
          <span className="text-[11.5px] font-semibold text-muted-foreground tabular-nums">{progressPercent}%</span>
        </div>
        <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setPanelOpen(true)} aria-label="Open course curriculum">
          <PanelRight aria-hidden />
          <span className="hidden sm:inline">Curriculum</span>
        </Button>
      </header>

      <div className="mx-auto flex w-full max-w-[1500px] flex-1">
        <main className="min-w-0 flex-1 px-3 pb-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl pt-4">
            {current.kind === "quiz" ? (
              <LearnerQuizView
                key={current.id}
                title={current.title}
                rawDescription={current.description}
                onPass={() => {
                  if (!isCurrentDone) void markComplete(current.id);
                }}
              />
            ) : current.kind === "reading" && !current.hasVideo ? (
              <LearnerReadingResourcesView
                key={current.id}
                title={current.title}
                rawDescription={current.description}
              />
            ) : (
              <VideoPlayer
                key={current.id}
                lessonId={current.id}
                courseId={course.id}
                title={current.title}
                hasVideo={current.hasVideo}
                videoReady={current.videoReady}
                onEnded={() => {
                  if (!isCurrentDone) {
                    toast.info("Lesson finished", { action: { label: "Mark complete", onClick: () => void markComplete(current.id) } });
                  }
                }}
              />
            )}

            <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11.5px] font-bold tracking-[0.1em] text-primary uppercase">
                  Lesson {lessonNumber} · {sectionTitle}
                </p>
                <h1 className="font-display mt-1.5 text-xl font-bold tracking-tight sm:text-2xl">{current.title}</h1>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {formatDuration(current.durationMinutes)}
                  {current.kind !== "video" ? ` · ${current.kind} lesson` : ""}
                  {current.isPreview ? " · Free preview" : ""}
                </p>
              </div>
              <Button
                variant={isCurrentDone ? "outline" : "default"}
                loading={busyLesson === current.id}
                onClick={() => void markComplete(current.id)}
                className={cn(isCurrentDone && "border-emerald-300 text-emerald-700 hover:bg-emerald-50")}
              >
                <CircleCheck aria-hidden className={cn(isCurrentDone && "text-emerald-600")} />
                {isCurrentDone ? "Completed" : "Mark as complete"}
              </Button>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              <Button variant="outline" size="sm" disabled={!prev} onClick={() => prev && setCurrentLessonId(prev.id)}>
                <ArrowLeft aria-hidden /> Previous
              </Button>
              <Button
                variant={next ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  if (next) setCurrentLessonId(next.id);
                  else if (!isCurrentDone) void markComplete(current.id);
                }}
              >
                {next ? "Next lesson" : "Finish course"}
                <ArrowRight aria-hidden />
              </Button>
            </div>

            <Tabs value={tab} onValueChange={setTab} className="mt-6">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="resources">
                  Resources
                  {resources.length > 0 ? (
                    <span className="rounded bg-zinc-100 px-1 text-[10px] font-semibold text-zinc-500 group-data-[state=active]:bg-accent">
                      {resources.length}
                    </span>
                  ) : null}
                </TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="max-w-3xl">
                {getCleanLessonDescription(current.description) ? (
                  <p className="whitespace-pre-line text-[14px] leading-relaxed text-muted-foreground">
                    {getCleanLessonDescription(current.description)}
                  </p>
                ) : (
                  <p className="text-[14px] leading-relaxed text-muted-foreground">
                    {current.kind} lesson in section “{sectionTitle}”. Follow along, take notes, and mark the lesson complete
                    when you are done.
                  </p>
                )}
              </TabsContent>

              <TabsContent value="resources" className="max-w-2xl">
                {resources.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-zinc-300 bg-muted/40 px-6 py-10 text-center">
                    <Package className="size-6 text-zinc-300" aria-hidden />
                    <p className="text-[13.5px] font-medium">No downloadable resources in this course</p>
                    <p className="max-w-sm text-[12.5px] text-muted-foreground">
                      When the instructor attaches templates or files, they appear here.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {resources.map((resource) => (
                      <li key={resource.id} className="flex items-center gap-3 rounded-lg border border-border bg-white px-3.5 py-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                          <FileDown className="size-4" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13.5px] font-medium">{resource.title}</p>
                          <p className="text-[11.5px] text-zinc-400">
                            {resource.fileName}
                            {resource.sizeBytes > 0 ? ` · ${(resource.sizeBytes / 1_048_576).toFixed(1)} MB` : ""}
                          </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => void downloadResource(resource)}>
                          <Download aria-hidden /> Download
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="notes" className="max-w-2xl">
                <div className="rounded-xl border border-border bg-white p-4">
                  <div className="flex items-center justify-between">
                    <label htmlFor="lesson-notes" className="flex items-center gap-2 text-[13px] font-semibold">
                      <FileText className="size-4 text-zinc-400" aria-hidden /> Your notes for this lesson
                    </label>
                    <span className="text-[11.5px] text-muted-foreground">{noteSaved ? "Saved" : "Autosaves as you type"}</span>
                  </div>
                  <Textarea
                    id="lesson-notes"
                    value={noteDraft}
                    onChange={(event) => persistNote(event.target.value)}
                    placeholder="Key insights, timestamps, questions to revisit…"
                    className="mt-3 min-h-40 resize-y bg-muted/30"
                  />
                  <p className="mt-2 text-[11.5px] text-zinc-400">
                    Notes are tied to lesson {lessonNumber} and saved to your Zybble account.
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </main>

        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-85 shrink-0 border-l border-border bg-white lg:block">
          {curriculumPanel}
        </aside>
      </div>

      <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
        <SheetContent side="right" className="w-88 max-w-[92vw] p-0">
          <VisuallyHidden.Root>
            <SheetTitle>Course curriculum</SheetTitle>
          </VisuallyHidden.Root>
          <div className="h-full">{curriculumPanel}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function LearnerQuizView({
  title,
  rawDescription,
  onPass,
}: {
  title: string;
  rawDescription: string | null;
  onPass: () => void;
}) {
  const parsed = React.useMemo(() => parseLessonQuiz(rawDescription), [rawDescription]);
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [checked, setChecked] = React.useState(false);

  const questions = parsed.questions;
  const correctCount = questions.filter(
    (q) => answers[q.id] && answers[q.id] === q.correctOptionId
  ).length;
  const scorePercent =
    questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 100;
  const passed = scorePercent >= parsed.passingScorePercent;

  function handleCheckAnswers() {
    setChecked(true);
    if (questions.length > 0) {
      const nextCorrect = questions.filter(
        (q) => answers[q.id] && answers[q.id] === q.correctOptionId
      ).length;
      const pct = Math.round((nextCorrect / questions.length) * 100);
      if (pct >= parsed.passingScorePercent) {
        onPass();
      }
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-zinc-50/70 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
        <div>
          <span className="inline-flex items-center rounded-md bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
            Interactive Quiz · Passing score {parsed.passingScorePercent}%
          </span>
          <h2 className="mt-1.5 font-display text-lg font-bold text-foreground">{title}</h2>
          {parsed.instructions ? (
            <p className="mt-1 text-[13px] text-muted-foreground">{parsed.instructions}</p>
          ) : null}
        </div>
        {checked ? (
          <div
            className={cn(
              "rounded-xl border px-3.5 py-2 text-right",
              passed
                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                : "border-amber-300 bg-amber-50 text-amber-800"
            )}
          >
            <p className="text-[12px] font-semibold">
              Score: {scorePercent}% ({correctCount}/{questions.length})
            </p>
            <p className="text-[11px]">
              {passed ? "Passed! Great work." : `Need ${parsed.passingScorePercent}% to pass`}
            </p>
          </div>
        ) : null}
      </div>

      {questions.length === 0 ? (
        <p className="mt-4 text-[13.5px] text-muted-foreground">
          {parsed.instructions || "Review the material in this section and mark the quiz complete when ready."}
        </p>
      ) : (
        <div className="mt-5 space-y-5">
          {questions.map((q, qIdx) => {
            const selectedId = answers[q.id];
            return (
              <div key={q.id} className="rounded-xl border border-border bg-white p-4">
                <p className="text-[14px] font-semibold text-foreground">
                  {qIdx + 1}. {q.question}
                </p>
                <div className="mt-3 space-y-2">
                  {q.options.map((opt, optIdx) => {
                    const isSelected = selectedId === opt.id;
                    const isCorrect = opt.id === q.correctOptionId;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setChecked(false);
                          setAnswers((prev) => ({ ...prev, [q.id]: opt.id }));
                        }}
                        className={cn(
                          "flex w-full items-center justify-between rounded-lg border px-3.5 py-2.5 text-left text-[13px] transition-colors",
                          checked && isCorrect
                            ? "border-emerald-400 bg-emerald-50 font-medium text-emerald-900"
                            : checked && isSelected && !isCorrect
                              ? "border-red-300 bg-red-50 text-red-900"
                              : isSelected
                                ? "border-primary bg-accent font-medium text-foreground"
                                : "border-border bg-white hover:bg-zinc-50"
                        )}
                      >
                        <span>
                          <strong className="mr-2 font-mono text-[11.5px] text-muted-foreground">
                            {String.fromCharCode(65 + optIdx)}.
                          </strong>
                          {opt.text}
                        </span>
                        {checked && isCorrect ? (
                          <span className="text-[11px] font-semibold text-emerald-700">Correct</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                {checked && q.explanation ? (
                  <p className="mt-3 rounded-lg bg-zinc-50 px-3 py-2 text-[12px] text-muted-foreground">
                    <strong className="font-semibold text-foreground">Explanation: </strong>
                    {q.explanation}
                  </p>
                ) : null}
              </div>
            );
          })}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <span className="text-[12px] text-muted-foreground">
              {Object.keys(answers).length} of {questions.length} answered
            </span>
            <div className="flex items-center gap-2">
              {checked ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAnswers({});
                    setChecked(false);
                  }}
                >
                  Retry quiz
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                disabled={Object.keys(answers).length < questions.length}
                onClick={handleCheckAnswers}
              >
                Check answers
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LearnerReadingResourcesView({
  title,
  rawDescription,
}: {
  title: string;
  rawDescription: string | null;
}) {
  const parsed = React.useMemo(() => parseLessonResources(rawDescription), [rawDescription]);

  return (
    <div className="rounded-2xl border border-border bg-zinc-50/70 p-5 sm:p-6">
      <span className="inline-flex items-center rounded-md bg-sky-100 px-2.5 py-0.5 text-[11px] font-semibold text-sky-800">
        Reading &amp; Supplementary Resources
      </span>
      <h2 className="mt-1.5 font-display text-lg font-bold text-foreground">{title}</h2>

      {parsed.notes ? (
        <div className="mt-3 rounded-xl border border-border bg-white p-4 text-[14px] leading-relaxed whitespace-pre-line text-foreground">
          {parsed.notes}
        </div>
      ) : null}

      {parsed.links.length > 0 ? (
        <div className="mt-4 space-y-2">
          <h3 className="text-[13px] font-semibold text-foreground">
            Reference links ({parsed.links.length})
          </h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {parsed.links.map((lnk) => (
              <li
                key={lnk.id}
                className="rounded-xl border border-border bg-white p-3.5 transition-colors hover:border-primary/40"
              >
                <a
                  href={lnk.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block font-medium text-[13.5px] text-primary hover:underline"
                >
                  {lnk.title} ↗
                </a>
                {lnk.description ? (
                  <p className="mt-1 text-[12px] text-muted-foreground">{lnk.description}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}