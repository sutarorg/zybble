import { notFound } from "next/navigation";
import { ListVideo } from "lucide-react";
import { getCreatorCourse, getCreatorCurriculum } from "@/lib/server/creator";
import { CurriculumEditor, type CurriculumSection, type CurriculumLesson } from "./curriculum-editor";
import { StatusBadge } from "@/components/creator/status-badge";

export const metadata = { title: "Curriculum" };
export const dynamic = "force-dynamic";

export default async function CurriculumPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [course, curriculum] = await Promise.all([getCreatorCourse(id), getCreatorCurriculum(id)]);
  if (!course) notFound();

  const sections: CurriculumSection[] = (curriculum.sections as Array<Record<string, unknown>>).map((section) => ({
    id: String(section.id),
    title: String(section.title),
    sortOrder: Number(section.sort_order ?? 0),
  }));

  const lessons: CurriculumLesson[] = (curriculum.lessons as Array<Record<string, unknown>>).map((lesson) => ({
    id: String(lesson.id),
    sectionId: (lesson.section_id as string | null) ?? "",
    title: String(lesson.title),
    description: (lesson.description as string) ?? "",
    kind: String(lesson.kind ?? "video"),
    sortOrder: Number(lesson.sort_order ?? 0),
    durationMinutes: Number(lesson.duration_minutes ?? 0),
    isPreview: Boolean(lesson.is_preview),
    bunnyStatus: (lesson.bunny_status as string) ?? null,
    playbackReady: Boolean(lesson.bunny_playback_ready),
    hasVideo: Boolean(lesson.bunny_video_id),
  }));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] leading-tight font-bold tracking-tight">Curriculum</h1>
          <p className="mt-1.5 text-[14px] text-muted-foreground">
            {course.title} · organise your material into sections and lessons.
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
        lessons={lessons}
      />

      <p className="flex items-center gap-2 text-[12px] text-zinc-400">
        <ListVideo className="size-3.5" aria-hidden /> Lesson counts and durations on the course card are
        recalculated from these rows on every save.
      </p>
    </div>
  );
}
