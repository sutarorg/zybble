import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLearningCourse } from "@/lib/server/learner";
import { getCourseViewerState } from "@/lib/server/catalog";
import { LearnPlayer, type LearningLesson, type LearningResource } from "./learn-player";

export const metadata: Metadata = {
  title: "Course player",
  description: "Your Zybble learning workspace.",
};

export const dynamic = "force-dynamic";

/**
 * Lesson player route.
 *
 * `getLearningCourse` returns `null` unless the caller has an active
 * entitlement or the course is published with preview lessons, and it already
 * hides non-preview lessons from non-entitled visitors. A guessed course id
 * therefore renders a 404 rather than a player.
 */
export default async function LearnPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ lesson?: string }>;
}) {
  const { courseId } = await params;
  const { lesson } = await searchParams;

  const detail = await getLearningCourse(courseId);
  if (!detail) notFound();

  const viewer = await getCourseViewerState(courseId, detail.course.pricePaise);

  // Group the server-authorised lessons under their real sections.
  const lessons: LearningLesson[] = detail.lessons.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    kind: row.kind,
    sortOrder: row.sortOrder,
    durationMinutes: row.durationMinutes,
    isPreview: row.isPreview,
    hasVideo: row.hasVideo,
    videoReady: row.videoReady,
    sectionId: row.sectionId,
  }));

  const sections = detail.sections.map((section) => ({
    id: section.id,
    title: section.title,
    sortOrder: section.sortOrder,
    lessons: lessons
      .filter((lesson) => lesson.sectionId === section.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((lesson) => ({
        id: lesson.id,
        sectionId: section.id,
        title: lesson.title,
        description: lesson.description ?? "",
        kind: lesson.kind,
        sortOrder: lesson.sortOrder,
        durationMinutes: lesson.durationMinutes,
        isPreview: lesson.isPreview,
        playbackReady: lesson.videoReady,
      })),
  }));

  // Lessons with no section still need to appear in the rail.
  const orphans = lessons.filter((lesson) => !lesson.sectionId);
  if (orphans.length > 0) {
    sections.push({
      id: "unsectioned",
      title: "Course",
      sortOrder: Number.MAX_SAFE_INTEGER,
      lessons: orphans.map((lesson) => ({
        id: lesson.id,
        sectionId: "unsectioned",
        title: lesson.title,
        description: lesson.description ?? "",
        kind: lesson.kind,
        sortOrder: lesson.sortOrder,
        durationMinutes: lesson.durationMinutes,
        isPreview: lesson.isPreview,
        playbackReady: lesson.videoReady,
      })),
    });
  }

  const resources: LearningResource[] = detail.resources.map((resource) => ({
    id: resource.id,
    title: resource.title,
    fileName: resource.fileName,
    sizeBytes: resource.sizeBytes,
  }));

  return (
    <LearnPlayer
      course={{
        id: detail.course.id,
        slug: detail.course.slug,
        title: detail.course.title,
        pricePaise: detail.course.pricePaise,
      }}
      creatorName={detail.course.creatorName}
      sections={sections}
      lessons={lessons}
      completedLessonIds={detail.completedLessonIds}
      notes={detail.notes}
      lastLessonId={detail.lastLessonId}
      resources={resources}
      progressPercent={detail.progressPercent}
      enrolled={viewer.enrolled}
      checkoutBlocked={viewer.checkoutBlocked}
      initialLessonId={typeof lesson === "string" ? lesson : null}
    />
  );
}
