import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CourseDetailView } from "@/components/courses/course-detail-view";
import {
  courseCategory,
  getCourseLessons,
  getCourseViewerState,
  getInstructorStats,
  getPublishedCourseBySlug,
  getPublishedReviews,
  relatedCourses,
} from "@/lib/server/catalog";

/**
 * Public course detail.
 *
 * Reads happen on the server under RLS, which only exposes `status =
 * 'published'` rows. A draft, pending, rejected or unpublished course 404s here
 * exactly as it does when probed through the API.
 */
export const dynamicParams = true;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const course = await getPublishedCourseBySlug(slug);
  if (!course) return { title: "Course not found", robots: { index: false } };
  return {
    title: course.title,
    description: course.subtitle || course.description.slice(0, 160),
    openGraph: {
      title: course.title,
      description: course.subtitle || course.description.slice(0, 160),
      type: "website",
    },
  };
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const course = await getPublishedCourseBySlug(slug);
  if (!course) notFound();

  const [{ lessons, sections }, reviews, related, instructorStats, viewer] = await Promise.all([
    getCourseLessons(course.id),
    getPublishedReviews(course.id),
    relatedCourses(course, 3),
    getInstructorStats(course.instructorId),
    getCourseViewerState(course.id, course.pricePaise),
  ]);

  const instructor = course.instructor!;
  const sectionMap = new Map(sections.map((section) => [String(section.id), section]));
  const curriculum = (sections as Array<Record<string, unknown>>).map((section) => ({
    id: String(section.id),
    title: String(section.title),
    lessons: ((section.lessons ?? []) as Array<Record<string, unknown>>).map((lesson) => ({
      id: String(lesson.id),
      title: String(lesson.title),
      durationMinutes: Number(lesson.duration_minutes ?? 0),
      type: String(lesson.kind ?? "video") as "video" | "reading" | "quiz",
      freePreview: Boolean(lesson.is_preview),
      description: (lesson.description as string) ?? undefined,
    })),
  }));
  void sectionMap;
  void lessons;

  return (
    <CourseDetailView
      course={{ ...course, curriculum }}
      instructor={instructor}
      instructorStats={instructorStats}
      reviews={reviews}
      related={related}
      category={courseCategory(course)}
      enrolled={viewer.enrolled}
      wishlisted={viewer.wishlisted}
      checkoutBlocked={viewer.checkoutBlocked}
    />
  );
}
