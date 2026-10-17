import { notFound } from "next/navigation";
import { ListVideo } from "lucide-react";
import {
  getCreatorCourse,
  getCreatorCurriculum,
  getCreatorResources,
} from "@/lib/server/creator";
import { StatusBadge } from "@/components/creator/status-badge";
import {
  CurriculumEditor,
  type CurriculumLesson,
  type CurriculumResource,
  type CurriculumSection,
} from "./curriculum-editor";

export const metadata = { title: "Curriculum" };
export const dynamic = "force-dynamic";

function mapLesson(lesson: Record<string, unknown>): CurriculumLesson {
  return {
    id: String(lesson.id),
    title: String(lesson.title ?? ""),
    description: (lesson.description as string) ?? "",
    kind: ((lesson.kind as string) ?? "video") as CurriculumLesson["kind"],
    sortOrder: Number(lesson.sort_order ?? 0),
    durationMinutes: Number(lesson.duration_minutes ?? 0),
    isPreview: Boolean(lesson.is_preview),
    hasVideo: Boolean(lesson.bunny_video_id),
    videoStatus: (lesson.bunny_status as string | null) ?? null,
    playbackReady: Boolean(lesson.bunny_playback_ready),
  };
}

export default async function CurriculumPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const [course, curriculum, rawResources] = await Promise.all([
    getCreatorCourse(id),
    getCreatorCurriculum(id),
    getCreatorResources(id),
  ]);
  if (!course) notFound();

  const sections: CurriculumSection[] = curriculum.sections.map((section) => ({
    id: String(section.id),
    title: String(section.title ?? ""),
    sortOrder: Number(section.sort_order ?? 0),
    lessons: ((section.lessons ?? []) as Array<Record<string, unknown>>)
      .map(mapLesson)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  }));

  const resources: CurriculumResource[] = rawResources.map((r) => ({
    id: String(r.id),
    lessonId: r.lesson_id ? String(r.lesson_id) : null,
    title: String(r.title ?? r.file_name ?? "Resource"),
    fileName: String(r.file_name ?? "file"),
    contentType: String(r.content_type ?? "application/octet-stream"),
    sizeBytes: Number(r.size_bytes ?? 0),
  }));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] leading-tight font-bold tracking-tight">
            Curriculum
          </h1>
          <p className="mt-1.5 text-[14px] text-muted-foreground">
            {course.title} · organize your material into sections and lessons.
          </p>
        </div>
        <StatusBadge status={course.status} />
      </header>

      {course.status === "pending" ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-[13px] text-amber-900">
          This course is with a reviewer. You can still edit the curriculum, but the submitted snapshot will be
          replaced with whatever you save before a decision is made.
        </div>
      ) : null}

      <CurriculumEditor
        courseId={course.id}
        editable={course.status !== "published"}
        sections={sections}
        resources={resources}
      />

      <p className="flex items-center gap-2 text-[12px] text-zinc-400">
        <ListVideo className="size-3.5" aria-hidden /> Lesson counts and durations on the course card are
        recalculated from these rows on every save.
      </p>
    </div>
  );
}
