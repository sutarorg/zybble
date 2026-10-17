"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Eye,
  FileText,
  FileUp,
  HelpCircle,
  Layers,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Video,
   type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  deleteLesson,
  deleteSection,
  reorderLessons,
  reorderSections,
  saveLesson,
  saveSection,
} from "@/app/creator/actions";
import {
  getCleanLessonDescription,
  LESSON_KINDS,
  parseLessonQuiz,
  parseLessonResources,
  type LessonKind,
  type LessonResourceLink,
  type QuizQuestion,
} from "@/lib/course-wizard";
import { AddLessonDialog } from "./add-lesson-dialog";
import {
  createDefaultQuestion,
  QuizBuilder,
  validateQuizQuestions,
} from "./quiz-builder";
import {
  detectResourceKindBadge,
  formatResourceBytes,
  ResourcesLessonPanel,
  type AttachedCourseResource,
} from "./resources-lesson-panel";
import { VideoLessonPanel } from "./video-lesson-panel";
import { cn } from "@/lib/utils";

export interface CurriculumLesson {
  id: string;
  title: string;
  description: string;
  kind: LessonKind;
  sortOrder: number;
  durationMinutes: number;
  isPreview: boolean;
  hasVideo: boolean;
  videoStatus: string | null;
  playbackReady: boolean;
}

export interface CurriculumSection {
  id: string;
  title: string;
  sortOrder: number;
  lessons: CurriculumLesson[];
}

export type CurriculumResource = AttachedCourseResource;

interface CurriculumEditorProps {
  courseId: string;
  editable?: boolean;
  sections: CurriculumSection[];
  resources?: CurriculumResource[];
}

export function CurriculumEditor({
  courseId,
  editable = true,
  sections,
  resources = [],
}: CurriculumEditorProps) {
  const router = useRouter();
  const [newSectionTitle, setNewSectionTitle] = React.useState("");
  const [addingSection, setAddingSection] = React.useState(false);
  const [reordering, setReordering] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [allResources, setAllResources] =
    React.useState<CurriculumResource[]>(resources);

  const allLessons = React.useMemo(
    () => sections.flatMap((section) => section.lessons),
    [sections]
  );

  const videoLessons = React.useMemo(
    () => allLessons.filter((l) => l.kind === "video"),
    [allLessons]
  );
  const quizLessons = allLessons.filter((l) => l.kind === "quiz");
  const resourceLessons = allLessons.filter((l) => l.kind === "reading");
  const totalMinutes = allLessons.reduce(
    (sum, l) => sum + (l.durationMinutes || 0),
    0
  );

  const unreadyVideos = videoLessons.filter((l) => !l.playbackReady);
  const encodingLessonIds = React.useMemo(
    () =>
      videoLessons
        .filter(
          (l) => l.hasVideo && !l.playbackReady && l.videoStatus !== "failed"
        )
        .map((l) => l.id),
    [videoLessons]
  );

  React.useEffect(() => {
    if (encodingLessonIds.length === 0) return;
    let cancelled = false;
    const timer = setInterval(async () => {
      for (const lessonId of encodingLessonIds) {
        if (cancelled) return;
        try {
          await fetch("/api/media/video/status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lessonId }),
          });
        } catch {
          /* next tick retries */
        }
      }
      if (!cancelled) router.refresh();
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [encodingLessonIds, router]);

  async function handleAddSection(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editable) return;
    if (!newSectionTitle.trim()) {
      setError("Enter a section title first.");
      return;
    }
    setAddingSection(true);
    setError(null);
    try {
      const result = await saveSection({
        courseId,
        title: newSectionTitle.trim(),
        sortOrder: sections.length,
      });
      if (!result.ok) {
        setError(result.error ?? "Could not add section");
        return;
      }
      setNewSectionTitle("");
      router.refresh();
    } finally {
      setAddingSection(false);
    }
  }

  async function handleMoveSection(index: number, delta: -1 | 1) {
    if (!editable) return;
    const target = index + delta;
    if (target < 0 || target >= sections.length) return;
    const ids = sections.map((s) => s.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    setReordering(true);
    setError(null);
    try {
      const result = await reorderSections({ courseId, ids });
      if (!result.ok) {
        setError(result.error ?? "Could not reorder sections");
        return;
      }
      router.refresh();
    } finally {
      setReordering(false);
    }
  }

  const courseLevelResources = allResources.filter((r) => !r.lessonId);

  return (
    <div className="space-y-6">
      {/* Top Curriculum Summary & Status Banner */}
      <div className="rounded-2xl border border-border bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground">
              Course curriculum builder
            </h2>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              Group lessons into sections. Each section can contain video lessons, interactive quizzes, and supplementary resources.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <Badge variant="default">
              {sections.length} {sections.length === 1 ? "section" : "sections"}
            </Badge>
            <Badge variant="violet">
              {videoLessons.length}{" "}
              {videoLessons.length === 1 ? "video" : "videos"}
            </Badge>
            <Badge variant="amber">
              {quizLessons.length} {quizLessons.length === 1 ? "quiz" : "quizzes"}
            </Badge>
            <Badge variant="sky">
              {resourceLessons.length + allResources.length} resources
            </Badge>
            {totalMinutes > 0 ? (
              <Badge variant="outline">
                <Clock3 className="mr-1 size-3" aria-hidden="true" />
                {totalMinutes} min total
              </Badge>
            ) : null}
          </div>
        </div>

        {/* Readiness status bar */}
        <div className="mt-4">
          {allLessons.length === 0 ? (
            <div className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/40 px-3.5 py-2.5 text-[12.5px] text-foreground">
              <Sparkles
                className="size-4 shrink-0 text-primary"
                aria-hidden="true"
              />
              <span>
                Add at least one section and one lesson to unlock course submission.
              </span>
            </div>
          ) : unreadyVideos.length > 0 ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-2.5 text-[12.5px] text-amber-900">
              <AlertCircle
                className="mt-0.5 size-4 shrink-0 text-amber-600"
                aria-hidden="true"
              />
              <div>
                <p className="font-medium">
                  {unreadyVideos.length}{" "}
                  {unreadyVideos.length === 1
                    ? "video lesson needs"
                    : "video lessons need"}{" "}
                  a ready video before submission:
                </p>
                <p className="mt-0.5 text-[11.5px] text-amber-800">
                  {unreadyVideos.map((l) => l.title).join(" · ")}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5 text-[12.5px] text-emerald-900">
              <CheckCircle2
                className="size-4 shrink-0 text-emerald-600"
                aria-hidden="true"
              />
              <span>
                All {allLessons.length}{" "}
                {allLessons.length === 1 ? "lesson is" : "lessons are"} ready for review.
              </span>
            </div>
          )}
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700"
        >
          <AlertCircle
            className="mt-0.5 size-4 shrink-0 text-red-600"
            aria-hidden="true"
          />
          <span>{error}</span>
        </div>
      ) : null}

      {/* Sections List */}
      {sections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center shadow-card">
          <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-accent text-primary">
            <Layers className="size-5" aria-hidden="true" />
          </div>
          <h3 className="mt-3 font-display text-[15px] font-semibold text-foreground">
            Start with your first curriculum section
          </h3>
          <p className="mx-auto mt-1 max-w-md text-[12.5px] text-muted-foreground">
            Sections group related lessons together (for example, &ldquo;Module 1: Foundations&rdquo;). Once created, you can add video lessons, quizzes, and downloadable resources inside.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {sections.map((section, index) => (
            <SectionCard
              key={section.id}
              courseId={courseId}
              editable={editable}
              section={section}
              index={index}
              total={sections.length}
              reordering={reordering}
              allResources={allResources}
              onResourcesChange={setAllResources}
              onMove={(delta) => void handleMoveSection(index, delta)}
              onError={setError}
            />
          ))}
        </div>
      )}

      {/* Add Section Form */}
      {editable ? (
        <form
          onSubmit={handleAddSection}
          className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-4 shadow-card sm:flex-row sm:items-center"
        >
          <div className="flex flex-1 items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40 font-mono text-[11.5px] font-semibold text-muted-foreground">
              S{sections.length + 1}
            </span>
            <Input
              value={newSectionTitle}
              maxLength={120}
              onChange={(e) => setNewSectionTitle(e.target.value)}
              placeholder="New section title — e.g. Module 1: Getting Started & Core Concepts"
              aria-label="New section title"
            />
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={addingSection}
            className="shrink-0"
          >
            {addingSection ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Plus className="size-3.5" aria-hidden="true" />
            )}
            Add section
          </Button>
        </form>
      ) : null}

      {/* Course-Level Supplementary Resources Card */}
      <section className="rounded-2xl border border-border bg-white p-5 shadow-card">
        <div className="mb-4">
          <h3 className="font-display text-[15px] font-semibold text-foreground">
            Course-wide downloadable resources
          </h3>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            Resources uploaded here are available in the course&apos;s main Resources tab alongside any lesson-specific files.
          </p>
        </div>

        <ResourcesLessonPanel
          courseId={courseId}
          lessonId={null}
          files={courseLevelResources}
          onFilesChange={(nextCourseFiles) => {
            const lessonScoped = allResources.filter((r) =>
              Boolean(r.lessonId)
            );
            setAllResources([...lessonScoped, ...nextCourseFiles]);
          }}
          allowExternalLinks={false}
          disabled={!editable}
        />
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* SectionCard                                                                 */
/* -------------------------------------------------------------------------- */

function SectionCard({
  courseId,
  editable,
  section,
  index,
  total,
  reordering,
  allResources,
  onResourcesChange,
  onMove,
  onError,
}: {
  courseId: string;
  editable: boolean;
  section: CurriculumSection;
  index: number;
  total: number;
  reordering: boolean;
  allResources: CurriculumResource[];
  onResourcesChange: (next: CurriculumResource[]) => void;
  onMove: (delta: -1 | 1) => void;
  onError: (msg: string | null) => void;
}) {
  const router = useRouter();
  const [title, setTitle] = React.useState(section.title);
  const [editingTitle, setEditingTitle] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [lessonOrderBusy, setLessonOrderBusy] = React.useState(false);
  const [addLessonOpen, setAddLessonOpen] = React.useState(false);
  const [addLessonMode, setAddLessonMode] = React.useState<
    "video" | "quiz" | "resource"
  >("video");

  async function handleSaveTitle() {
    if (!title.trim()) {
      onError("Section title cannot be empty.");
      return;
    }
    setBusy(true);
    onError(null);
    try {
      const result = await saveSection({
        courseId,
        id: section.id,
        title: title.trim(),
        sortOrder: section.sortOrder,
      });
      if (!result.ok) {
        onError(result.error ?? "Could not rename section");
        return;
      }
      setEditingTitle(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteSection() {
    setBusy(true);
    onError(null);
    try {
      const result = await deleteSection(section.id, courseId);
      if (!result.ok) {
        onError(result.error ?? "Could not delete section");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleMoveLesson(lessonIndex: number, delta: -1 | 1) {
    const target = lessonIndex + delta;
    if (target < 0 || target >= section.lessons.length) return;
    const ids = section.lessons.map((l) => l.id);
    [ids[lessonIndex], ids[target]] = [ids[target], ids[lessonIndex]];
    setLessonOrderBusy(true);
    onError(null);
    try {
      const result = await reorderLessons({
        courseId,
        sectionId: section.id,
        ids,
      });
      if (!result.ok) {
        onError(result.error ?? "Could not reorder lessons");
        return;
      }
      router.refresh();
    } finally {
      setLessonOrderBusy(false);
    }
  }

  function openAddDialog(mode: "video" | "quiz" | "resource") {
    setAddLessonMode(mode);
    setAddLessonOpen(true);
  }

  const sectionMinutes = section.lessons.reduce(
    (sum, l) => sum + (l.durationMinutes || 0),
    0
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
      {/* Section Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-zinc-50/70 px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex h-7 items-center rounded-md bg-accent px-2.5 font-mono text-[11px] font-semibold text-primary">
            Section {index + 1}
          </span>

          {editingTitle ? (
            <div className="flex flex-1 items-center gap-2">
              <Input
                value={title}
                maxLength={120}
                onChange={(e) => setTitle(e.target.value)}
                aria-label={`Section ${index + 1} title`}
                className="h-8 max-w-md bg-white text-[13px]"
              />
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() => void handleSaveTitle()}
              >
                Save
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setTitle(section.title);
                  setEditingTitle(false);
                }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex min-w-0 items-center gap-2">
              <h3 className="truncate font-display text-[15px] font-semibold text-foreground">
                {section.title}
              </h3>
              {editable ? (
                <button
                  type="button"
                  onClick={() => setEditingTitle(true)}
                  aria-label={`Rename section ${section.title}`}
                  className="rounded p-1 text-muted-foreground hover:bg-zinc-200/60 hover:text-foreground"
                  title="Rename section"
                >
                  <Pencil className="size-3.5" aria-hidden="true" />
                </button>
              ) : null}
              <span className="hidden text-[11.5px] text-muted-foreground sm:inline">
                · {section.lessons.length}{" "}
                {section.lessons.length === 1 ? "lesson" : "lessons"}
                {sectionMinutes > 0 ? ` · ${sectionMinutes} min` : ""}
              </span>
            </div>
          )}
        </div>

        {editable ? (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={busy || reordering || index === 0}
              aria-label={`Move section ${index + 1} up`}
              onClick={() => onMove(-1)}
              title="Move section up"
            >
              <ArrowUp className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={busy || reordering || index === total - 1}
              aria-label={`Move section ${index + 1} down`}
              onClick={() => onMove(1)}
              title="Move section down"
            >
              <ArrowDown className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={busy}
              aria-label={`Delete section ${section.title}`}
              onClick={() => void handleDeleteSection()}
              title="Delete section"
              className="text-muted-foreground hover:text-red-600"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ) : null}
      </header>

      {/* Lessons inside this Section */}
      <div className="p-4 sm:p-5">
        {section.lessons.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center">
            <p className="text-[13px] font-medium text-foreground">
              No lessons in &ldquo;{section.title}&rdquo; yet
            </p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Add a video lesson, an interactive multiple-choice quiz, or supplementary learning resources below.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {section.lessons.map((lesson, lessonIndex) => {
              const lessonFiles = allResources.filter(
                (r) => r.lessonId === lesson.id
              );
              return (
                <LessonCard
                  key={lesson.id}
                  courseId={courseId}
                  sectionId={section.id}
                  editable={editable}
                  lesson={lesson}
                  index={lessonIndex}
                  total={section.lessons.length}
                  reordering={lessonOrderBusy}
                  attachedFiles={lessonFiles}
                  onAttachedFilesChange={(nextLessonFiles) => {
                    const others = allResources.filter(
                      (r) => r.lessonId !== lesson.id
                    );
                    onResourcesChange([...others, ...nextLessonFiles]);
                  }}
                  onMove={(delta) => void handleMoveLesson(lessonIndex, delta)}
                  onError={onError}
                />
              );
            })}
          </div>
        )}

        {/* Section Footer: Quick-add buttons for Video, Quiz, and Resources */}
        {editable ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-zinc-50/70 px-3.5 py-2.5">
            <span className="text-[12px] font-medium text-muted-foreground">
              Add to &ldquo;{section.title}&rdquo;:
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => openAddDialog("video")}
                className="gap-1.5"
              >
                <Video className="size-3.5 text-primary" aria-hidden="true" />+
                Video lesson
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => openAddDialog("quiz")}
                className="gap-1.5"
              >
                <HelpCircle
                  className="size-3.5 text-amber-600"
                  aria-hidden="true"
                />
                + Quiz lesson
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => openAddDialog("resource")}
                className="gap-1.5"
              >
                <FileUp className="size-3.5 text-sky-600" aria-hidden="true" />+
                Resources lesson
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <AddLessonDialog
        key={addLessonMode}
        open={addLessonOpen}
        onOpenChange={setAddLessonOpen}
        courseId={courseId}
        sectionId={section.id}
        sectionTitle={section.title}
        nextSortOrder={section.lessons.length}
        initialMode={addLessonMode}
        onCreated={() => router.refresh()}
      />
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Redesigned Lesson Cards (Video, Quiz, Resources)                            */
/* -------------------------------------------------------------------------- */

const KIND_META: Record<
  LessonKind,
  {
    label: string;
    badgeTone: "violet" | "amber" | "sky";
    icon: LucideIcon;
    accentClass: string;
  }
> = {
  video: {
    label: "Video Lesson",
    badgeTone: "violet",
    icon: Video,
    accentClass: "border-l-violet-600",
  },
  quiz: {
    label: "Quiz Lesson",
    badgeTone: "amber",
    icon: HelpCircle,
    accentClass: "border-l-amber-500",
  },
  reading: {
    label: "Resources & Reading",
    badgeTone: "sky",
    icon: FileUp,
    accentClass: "border-l-sky-500",
  },
};

function LessonCard({
  courseId,
  sectionId,
  editable,
  lesson,
  index,
  total,
  reordering,
  attachedFiles,
  onAttachedFilesChange,
  onMove,
  onError,
}: {
  courseId: string;
  sectionId: string;
  editable: boolean;
  lesson: CurriculumLesson;
  index: number;
  total: number;
  reordering: boolean;
  attachedFiles: CurriculumResource[];
  onAttachedFilesChange: (next: CurriculumResource[]) => void;
  onMove: (delta: -1 | 1) => void;
  onError: (msg: string | null) => void;
}) {
  const router = useRouter();

  const parsedQuiz = React.useMemo(
    () => parseLessonQuiz(lesson.description),
    [lesson.description]
  );
  const parsedResources = React.useMemo(
    () => parseLessonResources(lesson.description),
    [lesson.description]
  );

  const needsInitialAttention =
    (lesson.kind === "video" && !lesson.hasVideo) ||
    (lesson.kind === "quiz" && parsedQuiz.questions.length === 0);

  const [expanded, setExpanded] = React.useState(needsInitialAttention);
  const [title, setTitle] = React.useState(lesson.title);
  const [cleanDescription, setCleanDescription] = React.useState(() =>
    getCleanLessonDescription(lesson.description)
  );
  const [kind, setKind] = React.useState<LessonKind>(lesson.kind);
  const [durationMinutes, setDurationMinutes] = React.useState(
    lesson.durationMinutes
  );
  const [isPreview, setIsPreview] = React.useState(lesson.isPreview);

  const [quizQuestions, setQuizQuestions] = React.useState<QuizQuestion[]>(() =>
    parsedQuiz.questions.length > 0
      ? parsedQuiz.questions
      : [createDefaultQuestion("multiple-choice")]
  );
  const [passingScorePercent, setPassingScorePercent] = React.useState(
    parsedQuiz.passingScorePercent
  );
  const [questionErrors, setQuestionErrors] = React.useState<
    Record<string, string>
  >({});

  const [resourceLinks, setResourceLinks] = React.useState<
    LessonResourceLink[]
  >(() => parsedResources.links);

  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [savedToast, setSavedToast] = React.useState<string | null>(null);

  async function handleSaveLesson() {
    if (!editable) return;
    setLocalError(null);
    setSavedToast(null);
    onError(null);

    if (!title.trim()) {
      setLocalError("Enter a lesson title before saving.");
      return;
    }

    if (kind === "quiz") {
      const validation = validateQuizQuestions(quizQuestions);
      setQuestionErrors(validation.questionErrors);
      if (!validation.valid) {
        setLocalError(
          validation.error ?? "Complete all quiz questions before saving."
        );
        return;
      }
    }

    setSaving(true);
    try {
      const result = await saveLesson({
        courseId,
        id: lesson.id,
        sectionId,
        title: title.trim(),
        description: cleanDescription.trim(),
        kind,
        sortOrder: lesson.sortOrder,
        durationMinutes: Math.max(
          0,
          Math.min(600, Number(durationMinutes) || 0)
        ),
        isPreview,
        quizConfig:
          kind === "quiz"
            ? {
                passingScorePercent,
                questions: quizQuestions,
              }
            : undefined,
        resourceLinks: kind === "reading" ? resourceLinks : undefined,
      });

      if (!result.ok) {
        setLocalError(result.error ?? "Could not save lesson");
        return;
      }

      setSavedToast("Saved");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteLesson() {
    if (!editable) return;
    setDeleting(true);
    setLocalError(null);
    onError(null);
    try {
      const result = await deleteLesson(lesson.id, courseId);
      if (!result.ok) {
        setLocalError(result.error ?? "Could not delete lesson");
        return;
      }
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  async function handleRefreshVideoStatus() {
    try {
      await fetch("/api/media/video/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId: lesson.id }),
      });
      router.refresh();
    } catch {
      setLocalError("Could not refresh video status.");
    }
  }

  const kindMeta = KIND_META[kind] ?? KIND_META.video;
  const KindIcon = kindMeta.icon;
  const totalResourcesCount = attachedFiles.length + resourceLinks.length;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border border-l-4 bg-white shadow-2xs transition-all",
        kindMeta.accentClass
      )}
    >
      {/* Card Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40 font-mono text-[11px] font-semibold text-muted-foreground">
            {index + 1}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={kindMeta.badgeTone} className="gap-1">
                <KindIcon className="size-3" aria-hidden="true" />
                {kindMeta.label}
              </Badge>

              <span className="truncate font-display text-[14px] font-semibold text-foreground">
                {lesson.title}
              </span>

              {lesson.isPreview ? (
                <Badge variant="emerald" className="gap-1">
                  <Eye className="size-3" aria-hidden="true" />
                  Free preview
                </Badge>
              ) : null}

              {/* Type-specific status pills */}
              {kind === "video" ? (
                lesson.playbackReady ? (
                  <Badge variant="emerald">Video ready</Badge>
                ) : lesson.hasVideo ? (
                  <Badge variant="amber">
                    {lesson.videoStatus === "failed"
                      ? "Encoding failed"
                      : `Encoding (${lesson.videoStatus ?? "processing"})`}
                  </Badge>
                ) : (
                  <Badge variant="amber">Video needed</Badge>
                )
              ) : null}

              {kind === "quiz" ? (
                <Badge
                  variant={parsedQuiz.questions.length > 0 ? "emerald" : "amber"}
                >
                  {parsedQuiz.questions.length}{" "}
                  {parsedQuiz.questions.length === 1 ? "question" : "questions"}{" "}
                  · Pass {parsedQuiz.passingScorePercent}%
                </Badge>
              ) : null}

              {kind === "reading" ? (
                <Badge variant={totalResourcesCount > 0 ? "sky" : "default"}>
                  {attachedFiles.length}{" "}
                  {attachedFiles.length === 1 ? "file" : "files"} ·{" "}
                  {resourceLinks.length}{" "}
                  {resourceLinks.length === 1 ? "link" : "links"}
                </Badge>
              ) : null}

              {lesson.durationMinutes > 0 ? (
                <span className="inline-flex items-center gap-1 text-[11.5px] text-muted-foreground">
                  <Clock3 className="size-3 text-zinc-400" aria-hidden="true" />
                  {lesson.durationMinutes} min
                </span>
              ) : null}
            </div>
          </div>
        </button>

        {/* Lesson Row Controls */}
        <div className="flex items-center gap-1">
          {editable ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={reordering || index === 0}
                aria-label={`Move lesson ${index + 1} up`}
                onClick={() => onMove(-1)}
                title="Move lesson up"
              >
                <ArrowUp className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={reordering || index === total - 1}
                aria-label={`Move lesson ${index + 1} down`}
                onClick={() => onMove(1)}
                title="Move lesson down"
              >
                <ArrowDown className="size-3.5" />
              </Button>
            </>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((prev) => !prev)}
            className="gap-1 text-muted-foreground hover:text-foreground"
          >
            {expanded ? (
              <>
                Collapse <ChevronUp className="size-3.5" />
              </>
            ) : (
              <>
                Edit <ChevronDown className="size-3.5" />
              </>
            )}
          </Button>
          {editable ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={deleting}
              aria-label={`Delete lesson ${lesson.title}`}
              onClick={() => void handleDeleteLesson()}
              title="Delete lesson"
              className="text-muted-foreground hover:text-red-600"
            >
              <Trash2 className="size-3.5" />
            </Button>
          ) : null}
        </div>
      </div>

      {/* Collapsed Quick Summary for Quiz & Resources Lessons */}
      {!expanded && kind === "quiz" && parsedQuiz.questions.length > 0 ? (
        <div className="border-t border-border bg-zinc-50/60 px-4 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-muted-foreground">
            <div className="flex flex-wrap items-center gap-2">
              {parsedQuiz.questions.slice(0, 3).map((q, idx) => (
                <span
                  key={q.id}
                  className="inline-flex max-w-[240px] items-center gap-1.5 truncate rounded-md border border-border bg-white px-2 py-0.5 text-foreground"
                >
                  <strong className="font-mono text-[10px] text-amber-700">
                    Q{idx + 1}
                  </strong>
                  <span className="truncate">{q.question}</span>
                </span>
              ))}
              {parsedQuiz.questions.length > 3 ? (
                <span className="text-muted-foreground">
                  +{parsedQuiz.questions.length - 3} more
                </span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="font-medium text-primary hover:underline"
            >
              Manage questions →
            </button>
          </div>
        </div>
      ) : null}

      {!expanded && kind === "reading" && totalResourcesCount > 0 ? (
        <div className="border-t border-border bg-zinc-50/60 px-4 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-muted-foreground">
            <div className="flex flex-wrap items-center gap-2">
              {attachedFiles.map((file) => {
                const b = detectResourceKindBadge(
                  file.fileName,
                  file.contentType
                );
                return (
                  <span
                    key={file.id}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-2 py-0.5 text-foreground"
                  >
                    <FileText className="size-3 text-sky-600" />
                    <span className="max-w-[180px] truncate">{file.title}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      ({b.label} · {formatResourceBytes(file.sizeBytes)})
                    </span>
                  </span>
                );
              })}
              {resourceLinks.map((lnk) => (
                <span
                  key={lnk.id}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-2 py-0.5 text-foreground"
                >
                  <Link2 className="size-3 text-primary" />
                  <span className="max-w-[180px] truncate">{lnk.title}</span>
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="font-medium text-primary hover:underline"
            >
              Manage resources →
            </button>
          </div>
        </div>
      ) : null}

      {/* Expanded Lesson Card Body */}
      {expanded ? (
        <div className="space-y-5 border-t border-border bg-zinc-50/50 p-4 sm:p-5">
          {localError ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12.5px] text-red-700"
            >
              <AlertCircle
                className="mt-0.5 size-4 shrink-0 text-red-600"
                aria-hidden="true"
              />
              <span>{localError}</span>
            </div>
          ) : null}

          {/* Core Lesson Identification Row */}
          <div className="grid gap-3.5 sm:grid-cols-[1fr_180px_130px]">
            <div className="space-y-1.5">
              <label
                htmlFor={`lesson-title-${lesson.id}`}
                className="block text-[12.5px] font-medium text-foreground"
              >
                {kind === "quiz"
                  ? "Quiz title"
                  : kind === "reading"
                    ? "Resources lesson title"
                    : "Video lesson title"}{" "}
                <span className="text-primary">*</span>
              </label>
              <Input
                id={`lesson-title-${lesson.id}`}
                disabled={!editable}
                value={title}
                maxLength={160}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter lesson title"
                className="bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor={`lesson-kind-${lesson.id}`}
                className="block text-[12.5px] font-medium text-foreground"
              >
                Lesson format
              </label>
              <select
                id={`lesson-kind-${lesson.id}`}
                disabled={!editable}
                value={kind}
                onChange={(e) => setKind(e.target.value as LessonKind)}
                className="flex h-10 w-full rounded-lg border border-input bg-white px-3 text-[13px] text-foreground shadow-2xs outline-none focus:border-primary"
              >
                {LESSON_KINDS.map((k: LessonKind) => (
                  <option key={k} value={k}>
                    {k === "video"
                      ? "Video Lesson"
                      : k === "quiz"
                        ? "Quiz Lesson"
                        : "Resources & Reading"}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor={`lesson-duration-${lesson.id}`}
                className="block text-[12.5px] font-medium text-foreground"
              >
                Duration (min)
              </label>
              <Input
                id={`lesson-duration-${lesson.id}`}
                disabled={!editable}
                type="number"
                min={0}
                max={600}
                value={durationMinutes}
                onChange={(e) =>
                  setDurationMinutes(Number(e.target.value) || 0)
                }
                className="bg-white"
              />
            </div>
          </div>

          {/* 1. VIDEO LESSON SPECIFIC CONTENT */}
          {kind === "video" ? (
            <div className="space-y-4">
              <VideoLessonPanel
                lessonId={lesson.id}
                hasVideo={lesson.hasVideo}
                videoStatus={lesson.videoStatus}
                playbackReady={lesson.playbackReady}
                disabled={!editable}
                onStatusRefresh={handleRefreshVideoStatus}
                onVideoUploaded={handleRefreshVideoStatus}
                onDetectedDurationMinutes={(mins) => {
                  if (durationMinutes === 0) setDurationMinutes(mins);
                }}
              />

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor={`lesson-desc-${lesson.id}`}
                    className="text-[12.5px] font-medium text-foreground"
                  >
                    Lesson description &amp; timestamps{" "}
                    <span className="font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </label>
                  <span className="text-[11px] text-zinc-400">
                    {cleanDescription.length}/2,000 characters
                  </span>
                </div>
                <Textarea
                  id={`lesson-desc-${lesson.id}`}
                  disabled={!editable}
                  rows={3}
                  maxLength={2000}
                  value={cleanDescription}
                  onChange={(e) => setCleanDescription(e.target.value)}
                  placeholder="Summarize what this video covers, key commands, or chapter timestamps…"
                  className="bg-white"
                />
              </div>
            </div>
          ) : null}

          {/* 2. QUIZ LESSON SPECIFIC CONTENT */}
          {kind === "quiz" ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor={`quiz-desc-${lesson.id}`}
                    className="text-[12.5px] font-medium text-foreground"
                  >
                    Quiz instructions &amp; guidance{" "}
                    <span className="font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </label>
                  <span className="text-[11px] text-zinc-400">
                    {cleanDescription.length}/2,000 characters
                  </span>
                </div>
                <Textarea
                  id={`quiz-desc-${lesson.id}`}
                  disabled={!editable}
                  rows={2}
                  maxLength={2000}
                  value={cleanDescription}
                  onChange={(e) => setCleanDescription(e.target.value)}
                  placeholder="Let learners know what concepts are tested and how to approach the quiz…"
                  className="bg-white"
                />
              </div>

              <QuizBuilder
                questions={quizQuestions}
                onChange={(next) => {
                  setQuizQuestions(next);
                  setQuestionErrors({});
                  setSavedToast(null);
                }}
                passingScorePercent={passingScorePercent}
                onPassingScoreChange={(pct) => {
                  setPassingScorePercent(pct);
                  setSavedToast(null);
                }}
                questionErrors={questionErrors}
                disabled={!editable}
              />
            </div>
          ) : null}

          {/* 3. RESOURCES & READING LESSON SPECIFIC CONTENT */}
          {kind === "reading" ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor={`res-desc-${lesson.id}`}
                    className="text-[12.5px] font-medium text-foreground"
                  >
                    Reading notes &amp; resource guide{" "}
                    <span className="font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </label>
                  <span className="text-[11px] text-zinc-400">
                    {cleanDescription.length}/2,000 characters
                  </span>
                </div>
                <Textarea
                  id={`res-desc-${lesson.id}`}
                  disabled={!editable}
                  rows={4}
                  maxLength={2000}
                  value={cleanDescription}
                  onChange={(e) => setCleanDescription(e.target.value)}
                  placeholder="Write lesson reading notes or explain how learners should use the attached files and links…"
                  className="bg-white"
                />
              </div>

              <ResourcesLessonPanel
                courseId={courseId}
                lessonId={lesson.id}
                files={attachedFiles}
                onFilesChange={onAttachedFilesChange}
                links={resourceLinks}
                onLinksChange={(nextLinks) => {
                  setResourceLinks(nextLinks);
                  setSavedToast(null);
                }}
                allowExternalLinks={true}
                disabled={!editable}
              />
            </div>
          ) : null}

          {/* Lesson Settings & Save Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3.5">
            <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-foreground">
              <input
                type="checkbox"
                disabled={!editable}
                checked={isPreview}
                onChange={(e) => setIsPreview(e.target.checked)}
                className="size-4 rounded border-zinc-300 accent-primary"
              />
              <span>
                Free preview — allow learners to open this lesson on the public course page before enrolling
              </span>
            </label>

            <div className="flex items-center gap-2">
              {savedToast ? (
                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11.5px] font-medium text-emerald-800">
                  <Check className="size-3.5" aria-hidden="true" />
                  {savedToast}
                </span>
              ) : null}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(false)}
              >
                Close
              </Button>

              {editable ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={saving}
                  onClick={() => void handleSaveLesson()}
                >
                  {saving ? (
                    <Loader2
                      className="size-3.5 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Check className="size-3.5" aria-hidden="true" />
                  )}
                  {kind === "quiz"
                    ? `Save quiz (${quizQuestions.length} ${
                        quizQuestions.length === 1 ? "question" : "questions"
                      })`
                    : "Save lesson"}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
