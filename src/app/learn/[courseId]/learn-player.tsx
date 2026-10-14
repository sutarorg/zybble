"use client";

import { LocalizedText, useTranslate } from "@/components/providers/localized-text";
import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  CircleCheck,
  Download,
  FileDown,
  FileText,
  Package,
  PanelRight,
  GraduationCap,
  Lock,
} from "lucide-react";
import type { Certificate, Course, CreatorResource, Enrollment } from "@/types";
import type { FlatLesson } from "@/lib/learn";
import { useApp } from "@/components/providers/app-providers";
import { useCreator, useCommunityCourses } from "@/components/providers/creator-provider";
import { flattenLessons, instructorOf, lessonDurationLabel, nextLessonOf, prevLessonOf, progressOf, resolveCourse } from "@/lib/learn";
import { SimulatedPlayer } from "@/components/learn/video-player";
import { CurriculumPanel } from "@/components/learn/curriculum-panel";
import { CourseReviewPanel } from "@/components/learn/course-review";
import { CertificateDialog } from "@/components/certificate/certificate-dialog";
import { EnrollCard } from "@/components/courses/enroll-card";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { formatDuration } from "@/lib/format";
import { formatFileSize } from "@/lib/utils";
import { cn } from "@/lib/utils";

/* ------------------------------ main player -------------------------------- */

export function LearnPlayer({
  courseKey,
  initialLessonId,
}: {
  courseKey: string;
  initialLessonId: string | null;
}) {
  const translateUi = useTranslate();
  const community = useCommunityCourses();
  const { profile: creatorProfile } = useCreator();
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
    user,
    issueCertificate,
    revokeCertificate,
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
  const [panelOpen, setPanelOpen] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [certificate, setCertificate] = useState<Certificate | null>(null);
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
      if (nowCompleted === null) return;

      /**
       * Enrollment state updates asynchronously, so fold this toggle into a
       * local copy before deciding whether the whole course is now finished.
       */
      const base: Enrollment =
        enrollment ?? {
          courseId: course.id,
          orderId: "",
          enrolledAt: "",
          lastLessonId: null,
          progress: 0,
          completedLessons: [],
        };
      const completedLessons =
        nowCompleted && !base.completedLessons?.includes(id)
          ? [...(base.completedLessons ?? []), id]
          : (base.completedLessons ?? []).filter((l) => l !== id);
      const updated = progressOf(course, { ...base, completedLessons, progress: 0 });

      if (updated.isCompleted) {
        // Certificate is issued whether or not the toggle came from a silent
        // call (curriculum panel), so the learner never misses an earned award.
        const issued = issueCertificate({
          courseId: course.id,
          courseSlug: course.slug,
          courseTitle: course.title,
          studentName: user?.name?.trim() || "Zybble Learner",
          instructorName: community.some((c) => c.id === course.id)
            ? creatorProfile.displayName
            : instructorOf(course)?.name ?? "Zybble Instructor",
          lessonsCount: updated.totalLessons,
          durationMinutes: course.durationMinutes,
        });
        setCertificate(issued);
        setCompletedOpen(true);
        toast.success(`You completed “${course.title}” — your certificate is ready!`);
        return;
      }

      revokeCertificate(course.id);
      if (silent) return;

      if (nowCompleted) {
        const next = nextLessonOf(course, current);
        toast.success("Lesson marked complete", {
          action: next
            ? {
                label: "Next lesson",
                onClick: () => setCurrentId(next.lesson.id),
              }
            : undefined,
        });
      } else {
        toast("Lesson marked incomplete");
      }
    },
    [course, current, enrollment, toggleLessonComplete, setCurrentId, user?.name, issueCertificate, revokeCertificate, community, creatorProfile.displayName]
  );

  /* free-course instant enroll */
  const enrollFree = () => {
    if (!course) return;
    completeOrder({
      id: `zyb_${Math.random().toString(36).slice(2, 10)}`,
      courseId: course.id,
      userId: null,
      email: "preview@learner.local",
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
          <Logo href="/" />
        </header>
        <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-16 text-center">
          <GraduationCap className="size-9 text-zinc-300" aria-hidden />
          <h1 className="font-display mt-4 text-2xl font-bold tracking-tight"><LocalizedText text={"This course has no lessons yet"} /></h1>
          <p className="mt-2 max-w-sm text-[14.5px] leading-relaxed text-muted-foreground"><LocalizedText text={"The curriculum for “"} /><LocalizedText text={course.title} /><LocalizedText text={"” is still being built. Check back soon — or pick another course meanwhile."} /></p>
          <div className="mt-6 flex gap-2">
            <Button asChild>
              <Link href="/my-learning"><LocalizedText text={"My Learning"} /></Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/"><LocalizedText text={"Explore courses"} /></Link>
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
          <Logo href="/" />
        </header>
        <main className="mx-auto flex w-full max-w-5xl flex-1 items-center px-4 py-12">
          <div className="grid w-full gap-8 md:grid-cols-[minmax(0,1fr)_340px]">
            <div>
              <span className="flex size-12 items-center justify-center rounded-xl bg-accent text-primary">
                <Lock className="size-5.5" aria-hidden />
              </span>
              <h1 className="font-display mt-4 text-2xl font-bold tracking-tight sm:text-3xl"><LocalizedText text={"Enroll to start learning"} /></h1>
              <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
                “<LocalizedText text={course.title} /><LocalizedText text={"” unlocks the lesson player, notes, resources and progress tracking — all simulated on this device."} /></p>
              {course.price === 0 && (
                <Button size="lg" className="mt-5" onClick={enrollFree}>
                  <GraduationCap aria-hidden /><LocalizedText text={"Enroll for free — start now"} /></Button>
              )}
              <p className="mt-4 text-[13px] text-zinc-400"><LocalizedText text={"Preview environment — no real enrollment happens."} /></p>
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
  const courseProgress = progressOf(course, enrollment);
  const percent = courseProgress.percent;

  /* resources tab entries — resource lessons plus any legacy extra files */
  const resourceEntries: { title: string; size: string; lesson?: FlatLesson["lesson"] }[] = [
    ...course.curriculum.flatMap((s) =>
      s.lessons
        .filter((l) => l.downloadable || l.type === "resource")
        .map((l) => ({
          title: l.media ? l.media.fileName : `${l.title} — resources`,
          size: l.media ? formatFileSize(l.media.fileSize) : "0.4 MB",
          lesson: l,
        }))
    ),
    ...((course as Course & { resourcesExtra?: CreatorResource[] }).resourcesExtra ?? []).map((r) => ({
      title: r.title,
      size: `${r.sizeMb} MB`,
    })),
  ];

  const downloadResource = (title: string) => {
    const blob = new Blob(
      [
        `Zybble — preview resource\n\nCourse: ${course.title}\nResource: ${title}\n\nThis is a preview file generated in your browser. In production, the instructor's file would download here.\n`,
      ],
      { type: "text/plain" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-preview.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("File downloaded");
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
          <Link href="/my-learning" aria-label={translateUi("Back to My Learning")}>
            <ArrowLeft aria-hidden />
            <span className="hidden sm:inline" aria-hidden><LocalizedText text={"My Learning"} /></span>
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold"><LocalizedText text={course.title} /></p>
          <p className="truncate text-[11px] text-muted-foreground">
            {instructor?.name} · <LocalizedText text={percentOf(progressOf(course, enrollment))} />
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
          variant="outline"
          size="sm"
          className="lg:hidden"
          onClick={() => setPanelOpen(true)}
          aria-label={translateUi("Open course curriculum")}
        >
          <PanelRight aria-hidden />
          <span className="hidden sm:inline" aria-hidden><LocalizedText text={"Curriculum"} /></span>
        </Button>
      </header>

      <div className="mx-auto flex w-full max-w-[1500px] flex-1">
        {/* Main column */}
        <main className="min-w-0 flex-1 px-3 pb-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl pt-4">
            <SimulatedPlayer
              key={current.lesson.id}
              thumbnail={course.thumbnail}
              title={translateUi(current.lesson.title)}
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
                <p className="text-[11.5px] font-bold tracking-[0.1em] text-primary uppercase"><LocalizedText text={"Lesson"} /><LocalizedText text={current.number} /> · <LocalizedText text={current.section.title} />
                </p>
                <h1 className="font-display mt-1.5 text-xl font-bold tracking-tight sm:text-2xl">
                  <LocalizedText text={current.lesson.title} />
                </h1>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  <LocalizedText text={lessonDurationLabel(current.lesson)} />
                  {current.lesson.type === "quiz" && current.lesson.quiz?.length
                    ? ` · ${current.lesson.quiz.length} question${current.lesson.quiz.length === 1 ? "" : "s"}`
                    : ""}
                  {current.lesson.media && current.lesson.type === "resource"
                    ? ` · ${current.lesson.media.extension.toUpperCase()} file`
                    : ""}
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
                <ArrowLeft aria-hidden /><LocalizedText text={"Previous"} /></Button>
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
                <TabsTrigger value="overview"><LocalizedText text={"Overview"} /></TabsTrigger>
                <TabsTrigger value="resources"><LocalizedText text={"Resources"} />{resourceEntries.length > 0 && (
                    <span className="rounded bg-zinc-100 px-1 text-[10px] font-semibold text-zinc-500 group-data-[state=active]:bg-accent">
                      {resourceEntries.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="notes"><LocalizedText text={"Notes"} /></TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="max-w-3xl">
                {current.lesson.description ? (
                  <p className="text-[14px] leading-relaxed text-muted-foreground"><LocalizedText text={current.lesson.description} /></p>
                ) : (
                  <p className="text-[14px] leading-relaxed text-muted-foreground">
                    <LocalizedText text={capitalize(current.lesson.type)} /><LocalizedText text={"lesson in section “"} /><LocalizedText text={current.section.title} />”.<LocalizedText text={" "} />
                    {<LocalizedText text={course.whatYouLearn[0]
                      ? `By the end of this course you will: ${course.whatYouLearn[0].charAt(0).toLowerCase()}${course.whatYouLearn[0].slice(1)}.`
                      : "Follow along, take notes, and mark the lesson complete when you're done."} />}
                  </p>
                )}
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border bg-muted/40 p-4">
                    <p className="text-[11px] font-bold tracking-[0.1em] text-zinc-400 uppercase"><LocalizedText text={"In this section"} /></p>
                    <p className="mt-1.5 text-[13px] font-semibold"><LocalizedText text={current.section.title} /></p>
                    <p className="mt-1 text-[12.5px] text-muted-foreground">
                      {current.section.lessons.length}<LocalizedText text={"lessons ·"} /><LocalizedText text={" "} />
                      <LocalizedText text={formatDuration(current.section.lessons.reduce((a, l) => a + l.durationMinutes, 0))} />
                    </p>
                  </div>
                  {next && (
                    <button
                      type="button"
                      onClick={() => setCurrentId(next.lesson.id)}
                      className="cursor-pointer rounded-xl border border-border bg-white p-4 text-left shadow-card transition-all hover:border-violet-200 hover:shadow-card-hover"
                    >
                      <p className="text-[11px] font-bold tracking-[0.1em] text-zinc-400 uppercase"><LocalizedText text={"Up next"} /></p>
                      <p className="mt-1.5 truncate text-[13px] font-semibold text-primary">
                        <LocalizedText text={next.number} /> — <LocalizedText text={next.lesson.title} />
                      </p>
                      <p className="mt-1 text-[12.5px] text-muted-foreground"><LocalizedText text={lessonDurationLabel(next.lesson)} /></p>
                    </button>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="resources" className="max-w-2xl">
                {resourceEntries.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-zinc-300 bg-muted/40 px-6 py-10 text-center">
                    <Package className="size-6 text-zinc-300" aria-hidden />
                    <p className="text-[13.5px] font-medium"><LocalizedText text={"No downloadable resources in this course"} /></p>
                    <p className="max-w-sm text-[12.5px] text-muted-foreground"><LocalizedText text={"When the instructor attaches templates or files, they appear here."} /></p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {resourceEntries.map((r, i) => (
                      <li key={i} className="flex items-center gap-3 rounded-lg border border-border bg-white px-3.5 py-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                          <FileDown className="size-4" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13.5px] font-medium"><LocalizedText text={r.title} /></p>
                          <p className="text-[11.5px] text-zinc-400">
                            <LocalizedText text={r.size} /><LocalizedText text={"· preview file"} /><LocalizedText text={r.lesson ? ` · from lesson ${r.lesson.title}` : ""} />
                          </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => downloadResource(r.title)}>
                          <Download aria-hidden /><LocalizedText text={"Download"} /></Button>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="notes" className="max-w-2xl">
                <div className="rounded-xl border border-border bg-white p-4">
                  <div className="flex items-center justify-between">
                    <label htmlFor="lesson-notes" className="flex items-center gap-2 text-[13px] font-semibold">
                      <FileText className="size-4 text-zinc-400" aria-hidden /><LocalizedText text={"Your notes for this lesson"} /></label>
                    <span className="text-[11.5px] text-muted-foreground">
                      {noteSaved ? "Saved" : "Autosaves as you type"}
                    </span>
                  </div>
                  <Textarea
                    id="lesson-notes"
                    value={noteDraft}
                    onChange={(e) => persistNote(e.target.value)}
                    placeholder={translateUi("Key insights, timestamps, questions to revisit…")}
                    className="mt-3 min-h-40 resize-y bg-muted/30"
                  />
                  <p className="mt-2 text-[11.5px] text-zinc-400"><LocalizedText text={"Notes are tied to lesson"} /><LocalizedText text={current.number} /><LocalizedText text={"and saved on this device only."} /></p>
                </div>
              </TabsContent>
            </Tabs>

            {/* Reviews unlock only once every lesson is complete. */}
            {courseProgress.isCompleted && <CourseReviewPanel course={course} />}
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
            <SheetTitle><LocalizedText text={"Course curriculum"} /></SheetTitle>
          </VisuallyHidden.Root>
          <div className="h-full">{curriculumPanel}</div>
        </SheetContent>
      </Sheet>

      {/* Completion certificate */}
      <CertificateDialog
        certificate={certificate}
        open={completedOpen}
        onOpenChange={setCompletedOpen}
        description={
          <><LocalizedText text={"You finished every lesson in “"} /><LocalizedText text={course.title} /><LocalizedText text={"”. Your certificate is issued in the name on your account and saved on this device."} /></>
        }
      />
    </div>
  );
}

function percentOf(p: { completedCount: number; totalLessons: number }): string {
  return `${p.completedCount}/${p.totalLessons} lessons`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
