"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Bot,
  CheckCircle2,
  CircleCheck,
  Download,
  FileDown,
  FileText,
  Package,
  PanelRight,
  GraduationCap,
  Lock,
} from "lucide-react";
import type { Course, CreatorResource } from "@/types";
import type { FlatLesson } from "@/lib/learn";
import { useApp } from "@/components/providers/app-providers";
import { useCommunityCourses } from "@/components/providers/creator-provider";
import { flattenLessons, instructorOf, nextLessonOf, prevLessonOf, progressOf, resolveCourse } from "@/lib/learn";
import { SimulatedPlayer } from "@/components/learn/video-player";
import { CurriculumPanel } from "@/components/learn/curriculum-panel";
import { TutorPanel } from "@/components/learn/tutor-panel";
import { EnrollCard } from "@/components/courses/enroll-card";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

/* ------------------------------ main player -------------------------------- */

export function LearnPlayer({
  courseKey,
  initialLessonId,
}: {
  courseKey: string;
  initialLessonId: string | null;
}) {
  const community = useCommunityCourses();
  const {
    hydrated,
    enrollments,
    isEnrolled,
    toggleLessonComplete,
    setLastLesson,
    notes,
    setNote,
    recordCourseView,
    completeOrder,
  } = useApp();

  const course = useMemo(
    () => (hydrated ? resolveCourse(courseKey, community) : undefined),
    [hydrated, courseKey, community]
  );
  const enrollment = enrollments.find((e) => e.courseId === course?.id);
  const flat = useMemo(() => (course ? flattenLessons(course) : []), [course]);

  /**
   * Current lesson: explicitly chosen lesson, else the `?lesson=` deep link,
   * else where the learner left off, else the first lesson. Derived during
   * render so the player is correct on the very first hydrated paint.
   */
  const [lessonOverride, setLessonOverride] = useState<string | null>(null);
  const initialLesson = useMemo(() => {
    if (!course || flat.length === 0) return null;
    const fromParam = initialLessonId ? flat.find((f) => f.lesson.id === initialLessonId) : undefined;
    const fromEnrollment = enrollment?.lastLessonId
      ? flat.find((f) => f.lesson.id === enrollment.lastLessonId)
      : undefined;
    return (
      fromParam ??
      fromEnrollment ??
      progressOf(course, enrollment).resumeLesson ??
      flat[0] ??
      null
    );
  }, [course, flat, initialLessonId, enrollment]);
  const currentLessonId = lessonOverride ?? initialLesson?.lesson.id ?? null;
  const setCurrentId = setLessonOverride;
  const current: FlatLesson | null =
    flat.find((f) => f.lesson.id === currentLessonId) ?? flat[0] ?? null;

  /* ui state */
  const [playing, setPlaying] = useState(false);
  const [tab, setTab] = useState("overview");
  const [tutorOpen, setTutorOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);
  /* Note draft: trusted only while it belongs to the lesson being viewed. */
  const [noteState, setNoteState] = useState<{ lessonId: string; text: string } | null>(null);
  const [noteSaved, setNoteSaved] = useState(false);
  const noteTimer = useRef<number | null>(null);

  /* view tracking */
  useEffect(() => {
    if (course && hydrated) recordCourseView(course.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course?.id, hydrated]);

  /* persist last lesson */
  useEffect(() => {
    if (course && current && enrollment) setLastLesson(course.id, current.lesson.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.lesson.id]);

  const existingNote =
    course && current
      ? notes.find((n) => n.courseId === course.id && n.lessonId === current.lesson.id)
      : undefined;
  const noteDraft =
    noteState && current && noteState.lessonId === current.lesson.id
      ? noteState.text
      : (existingNote?.text ?? "");

  const persistNote = useCallback(
    (text: string) => {
      if (!course || !current) return;
      setNoteState({ lessonId: current.lesson.id, text });
      setNoteSaved(false);
      if (noteTimer.current) window.clearTimeout(noteTimer.current);
      noteTimer.current = window.setTimeout(() => {
        setNote(course.id, current.lesson.id, text);
        setNoteSaved(true);
      }, 700);
    },
    [course, current, setNote]
  );

  const enrolled = course ? isEnrolled(course.id) : false;

  const markComplete = useCallback(
    (lessonId?: string, silent = false) => {
      if (!course || !current) return;
      const id = lessonId ?? current.lesson.id;
      const nowCompleted = toggleLessonComplete(course.id, id);
      if (silent) return;
      if (nowCompleted) {
        const updated = progressOf(course, {
          ...(enrollment ?? { courseId: course.id, orderId: "", enrolledAt: "", lastLessonId: null }),
          completedLessons: [
            ...(enrollment?.completedLessons ?? []),
            ...(id === current.lesson.id && enrollment?.completedLessons.includes(id) ? [] : [id]),
          ],
          progress: 0,
        });
        if (updated.isCompleted) {
          setCompletedOpen(true);
          toast.success(`You completed “${course.title}” — amazing work!`);
        } else {
          const next = nextLessonOf(course, current);
          toast.success("Lesson marked complete", {
            action: next
              ? {
                  label: "Next lesson",
                  onClick: () => setCurrentId(next.lesson.id),
                }
              : undefined,
          });
        }
      } else {
        toast("Lesson marked incomplete");
      }
    },
    [course, current, enrollment, toggleLessonComplete, setCurrentId]
  );

  /* free-course instant enroll */
  const enrollFree = () => {
    if (!course) return;
    completeOrder({
      id: `zyb_${Math.random().toString(36).slice(2, 10)}`,
      courseId: course.id,
      userId: null,
      email: "demo@learner.local",
      total: 0,
      createdAt: new Date().toISOString(),
      status: "paid",
      cardLast4: "FREE",
    });
    toast.success(`Enrolled in “${course.title}” — enjoy!`);
  };

  /* ------------------------------ render gates ----------------------------- */

  if (!hydrated) {
    return (
      <div className="flex min-h-dvh flex-col bg-white" aria-busy>
        <div className="flex h-14 items-center gap-3 border-b border-border px-4">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-5 w-64" />
        </div>
        <div className="mx-auto w-full max-w-6xl px-4 py-6">
          <Skeleton className="aspect-video w-full rounded-xl" />
          <Skeleton className="mt-4 h-6 w-1/2" />
        </div>
      </div>
    );
  }

  if (!course) notFound();

  if (flat.length === 0 || !current) {
    return (
      <div className="flex min-h-dvh flex-col bg-white">
        <header className="flex h-14 items-center gap-3 border-b border-border px-4">
          <Logo href="/explore" />
        </header>
        <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-16 text-center">
          <GraduationCap className="size-9 text-zinc-300" aria-hidden />
          <h1 className="font-display mt-4 text-2xl font-bold tracking-tight">This course has no lessons yet</h1>
          <p className="mt-2 max-w-sm text-[14.5px] leading-relaxed text-muted-foreground">
            The curriculum for “{course.title}” is still being built. Check back soon — or pick
            another course meanwhile.
          </p>
          <div className="mt-6 flex gap-2">
            <Button asChild>
              <Link href="/my-learning">My Learning</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/explore">Explore courses</Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  if (!enrolled && hydrated) {
    if (course.price === 0) {
      // fallthrough to enroll prompt below (still offers instant enroll)
    }
    return (
      <div className="flex min-h-dvh flex-col bg-white">
        <header className="flex h-14 items-center gap-3 border-b border-border px-4">
          <Logo href="/explore" />
        </header>
        <main className="mx-auto flex w-full max-w-5xl flex-1 items-center px-4 py-12">
          <div className="grid w-full gap-8 md:grid-cols-[minmax(0,1fr)_340px]">
            <div>
              <span className="flex size-12 items-center justify-center rounded-xl bg-accent text-primary">
                <Lock className="size-5.5" aria-hidden />
              </span>
              <h1 className="font-display mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
                Enroll to start learning
              </h1>
              <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
                “{course.title}” unlocks the lesson player, notes, resources and progress tracking —
                all simulated on this device.
              </p>
              {course.price === 0 && (
                <Button size="lg" className="mt-5" onClick={enrollFree}>
                  <GraduationCap aria-hidden />
                  Enroll for free — start now
                </Button>
              )}
              <p className="mt-4 text-[13px] text-zinc-400">Demo environment — no real enrollment happens.</p>
            </div>
            {course.price > 0 && <EnrollCard course={course} />}
          </div>
        </main>
      </div>
    );
  }

  const next = nextLessonOf(course, current);
  const prev = prevLessonOf(course, current);
  const isCurrentDone = (enrollment?.completedLessons ?? []).includes(current.lesson.id);
  const instructor = instructorOf(course);
  const percent = progressOf(course, enrollment).percent;

  /* resources tab entries */
  const resourceEntries: { title: string; size: string; lesson?: FlatLesson["lesson"] }[] = [
    ...course.curriculum.flatMap((s) =>
      s.lessons
        .filter((l) => l.downloadable)
        .map((l) => ({ title: `${l.title} — resources`, size: "0.4 MB", lesson: l }))
    ),
    ...((course as Course & { resourcesExtra?: CreatorResource[] }).resourcesExtra ?? []).map((r) => ({
      title: r.title,
      size: `${r.sizeMb} MB`,
    })),
  ];

  const downloadResource = (title: string) => {
    const blob = new Blob(
      [
        `Zybble — Demo resource\n\nCourse: ${course.title}\nResource: ${title}\n\nThis is a demo file generated in your browser. In production, the instructor's file would download here.\n`,
      ],
      { type: "text/plain" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-demo.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Demo file downloaded");
  };

  const curriculumPanel = (
    <CurriculumPanel
      course={course}
      enrollment={enrollment}
      currentLessonId={current.lesson.id}
      onSelect={(f) => {
        setCurrentId(f.lesson.id);
        setPlaying(false);
        setPanelOpen(false);
      }}
      onToggleComplete={(id) => markComplete(id, true)}
    />
  );

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      {/* Header */}
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-white/90 px-3 backdrop-blur sm:gap-3 sm:px-4">
        <Button asChild variant="ghost" size="sm" className="-ml-1 shrink-0">
          <Link href="/my-learning" aria-label="Back to My Learning">
            <ArrowLeft aria-hidden />
            <span className="hidden sm:inline" aria-hidden>My Learning</span>
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold">{course.title}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {instructor?.name} · {percentOf(progressOf(course, enrollment))}
          </p>
        </div>
        {/* progress */}
        <div className="hidden w-40 items-center gap-2 md:flex">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
          </div>
          <span className="text-[11.5px] font-semibold text-muted-foreground tabular-nums">{percent}%</span>
        </div>
        <Button
          variant={tutorOpen ? "default" : "outline"}
          size="sm"
          onClick={() => setTutorOpen((v) => !v)}
          aria-pressed={tutorOpen}
          aria-label="AI Tutor"
        >
          <Bot aria-hidden />
          <span className="hidden sm:inline" aria-hidden>AI Tutor</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="lg:hidden"
          onClick={() => setPanelOpen(true)}
          aria-label="Open course curriculum"
        >
          <PanelRight aria-hidden />
          <span className="hidden sm:inline" aria-hidden>Curriculum</span>
        </Button>
      </header>

      <div className="mx-auto flex w-full max-w-[1500px] flex-1">
        {/* Main column */}
        <main className="min-w-0 flex-1 px-3 pb-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl pt-4">
            <SimulatedPlayer
              key={current.lesson.id}
              thumbnail={course.thumbnail}
              title={current.lesson.title}
              durationMinutes={current.lesson.durationMinutes}
              caption={`Lesson ${current.number} — ${current.lesson.title}`}
              playing={playing}
              onPlayingChange={setPlaying}
              onEnded={() => {
                if (!isCurrentDone) {
                  toast.info("Lesson finished — nice!", {
                    action: { label: "Mark complete", onClick: () => markComplete() },
                  });
                }
              }}
            />

            {/* Lesson meta + actions */}
            <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11.5px] font-bold tracking-[0.1em] text-primary uppercase">
                  Lesson {current.number} · {current.section.title}
                </p>
                <h1 className="font-display mt-1.5 text-xl font-bold tracking-tight sm:text-2xl">
                  {current.lesson.title}
                </h1>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {formatDuration(current.lesson.durationMinutes)}
                  {current.lesson.type !== "video" && ` · ${capitalize(current.lesson.type)} lesson`}
                  {current.lesson.freePreview && " · Free preview"}
                </p>
              </div>
              <Button
                variant={isCurrentDone ? "outline" : "default"}
                onClick={() => markComplete()}
                className={cn(isCurrentDone && "border-emerald-300 text-emerald-700 hover:bg-emerald-50")}
              >
                <CircleCheck aria-hidden className={cn(isCurrentDone && "text-emerald-600")} />
                {isCurrentDone ? "Completed" : "Mark as complete"}
              </Button>
            </div>

            {/* Prev / next */}
            <div className="mt-4 flex items-center justify-between gap-2">
              <Button variant="outline" size="sm" disabled={!prev} onClick={() => prev && setCurrentId(prev.lesson.id)}>
                <ArrowLeft aria-hidden />
                Previous
              </Button>
              <Button
                variant={next ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  if (next) {
                    setCurrentId(next.lesson.id);
                  } else if (!isCurrentDone) {
                    markComplete();
                  }
                }}
              >
                {next ? "Next lesson" : "Finish course"}
                <ArrowRight aria-hidden />
              </Button>
            </div>

            {/* Tabs */}
            <Tabs value={tab} onValueChange={setTab} className="mt-6">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="resources">
                  Resources{resourceEntries.length > 0 && (
                    <span className="rounded bg-zinc-100 px-1 text-[10px] font-semibold text-zinc-500 group-data-[state=active]:bg-accent">
                      {resourceEntries.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="max-w-3xl">
                {current.lesson.description ? (
                  <p className="text-[14px] leading-relaxed text-muted-foreground">{current.lesson.description}</p>
                ) : (
                  <p className="text-[14px] leading-relaxed text-muted-foreground">
                    {capitalize(current.lesson.type)} lesson in section “{current.section.title}”.{" "}
                    {course.whatYouLearn[0]
                      ? `By the end of this course you will: ${course.whatYouLearn[0].charAt(0).toLowerCase()}${course.whatYouLearn[0].slice(1)}.`
                      : "Follow along, take notes, and mark the lesson complete when you're done."}
                  </p>
                )}
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border bg-muted/40 p-4">
                    <p className="text-[11px] font-bold tracking-[0.1em] text-zinc-400 uppercase">In this section</p>
                    <p className="mt-1.5 text-[13px] font-semibold">{current.section.title}</p>
                    <p className="mt-1 text-[12.5px] text-muted-foreground">
                      {current.section.lessons.length} lessons ·{" "}
                      {formatDuration(current.section.lessons.reduce((a, l) => a + l.durationMinutes, 0))}
                    </p>
                  </div>
                  {next && (
                    <button
                      type="button"
                      onClick={() => setCurrentId(next.lesson.id)}
                      className="cursor-pointer rounded-xl border border-border bg-white p-4 text-left shadow-card transition-all hover:border-violet-200 hover:shadow-card-hover"
                    >
                      <p className="text-[11px] font-bold tracking-[0.1em] text-zinc-400 uppercase">Up next</p>
                      <p className="mt-1.5 truncate text-[13px] font-semibold text-primary">
                        {next.number} — {next.lesson.title}
                      </p>
                      <p className="mt-1 text-[12.5px] text-muted-foreground">{formatDuration(next.lesson.durationMinutes)}</p>
                    </button>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="resources" className="max-w-2xl">
                {resourceEntries.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-zinc-300 bg-muted/40 px-6 py-10 text-center">
                    <Package className="size-6 text-zinc-300" aria-hidden />
                    <p className="text-[13.5px] font-medium">No downloadable resources in this course</p>
                    <p className="max-w-sm text-[12.5px] text-muted-foreground">
                      When the instructor attaches templates or files, they appear here.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {resourceEntries.map((r, i) => (
                      <li key={i} className="flex items-center gap-3 rounded-lg border border-border bg-white px-3.5 py-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                          <FileDown className="size-4" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13.5px] font-medium">{r.title}</p>
                          <p className="text-[11.5px] text-zinc-400">
                            {r.size} · demo file{r.lesson ? ` · from lesson ${r.lesson.title}` : ""}
                          </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => downloadResource(r.title)}>
                          <Download aria-hidden />
                          Download
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
                      <FileText className="size-4 text-zinc-400" aria-hidden />
                      Your notes for this lesson
                    </label>
                    <span className="text-[11.5px] text-muted-foreground">
                      {noteSaved ? "Saved" : "Autosaves as you type"}
                    </span>
                  </div>
                  <Textarea
                    id="lesson-notes"
                    value={noteDraft}
                    onChange={(e) => persistNote(e.target.value)}
                    placeholder="Key insights, timestamps, questions to revisit…"
                    className="mt-3 min-h-40 resize-y bg-muted/30"
                  />
                  <p className="mt-2 text-[11.5px] text-zinc-400">
                    Notes are tied to lesson {current.number} and saved on this device only.
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </main>

        {/* Curriculum sidebar (desktop) */}
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-85 shrink-0 border-l border-border bg-white lg:block">
          {curriculumPanel}
        </aside>
      </div>

      {/* Curriculum drawer (mobile) */}
      <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
        <SheetContent side="right" className="w-88 max-w-[92vw] p-0">
          <VisuallyHidden.Root>
            <SheetTitle>Course curriculum</SheetTitle>
          </VisuallyHidden.Root>
          <div className="h-full">{curriculumPanel}</div>
        </SheetContent>
      </Sheet>

      {/* AI Tutor slide-over */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-88 max-w-[92vw] border-l border-border bg-white shadow-pop transition-transform duration-300",
          tutorOpen ? "translate-x-0" : "translate-x-full"
        )}
        aria-hidden={!tutorOpen}
        role="complementary"
        aria-label="AI Tutor"
      >
        {tutorOpen && (
          <TutorPanel
            course={course}
            currentLesson={current}
            onClose={() => setTutorOpen(false)}
            onCitationClick={(lessonId) => {
              setCurrentId(lessonId);
              if (window.innerWidth < 1024) setTutorOpen(false);
            }}
          />
        )}
      </div>

      {/* Completion dialog */}
      <Dialog open={completedOpen} onOpenChange={setCompletedOpen}>
        <DialogContent className="max-w-md text-center" aria-describedby={undefined}>
          <span className="relative mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-100">
            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-200/60" aria-hidden />
            <Award className="relative size-8 text-emerald-600" aria-hidden />
          </span>
          <DialogTitle className="font-display mt-3 text-xl">Course completed!</DialogTitle>
          <DialogDescription className="mt-1">
            You finished every lesson in “{course.title}”. Your certificate is ready in this demo —
            and the course is now in the Completed tab of My Learning.
          </DialogDescription>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Button asChild className="flex-1" size="lg">
              <Link href="/my-learning">
                <GraduationCap aria-hidden />
                My Learning
              </Link>
            </Button>
            <Button variant="outline" className="flex-1" size="lg" onClick={() => setCompletedOpen(false)}>
              <CheckCircle2 aria-hidden />
              Keep reviewing
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function percentOf(p: { completedCount: number; totalLessons: number }): string {
  return `${p.completedCount}/${p.totalLessons} lessons`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
