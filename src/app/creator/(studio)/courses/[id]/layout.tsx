import { notFound } from "next/navigation";
import { getCreatorCourse } from "@/lib/server/creator";
import { buildCourseWizardSteps } from "@/lib/course-wizard";
import { CourseWizardFrame } from "@/components/creator/course-wizard-frame";

export const dynamic = "force-dynamic";

/**
 * Wraps the existing per-course routes (edit, curriculum, content, publish) in
 * the four-step course wizard. The routes themselves are unchanged — every
 * direct URL keeps working — and the step states are derived from the saved
 * course rows, never from client-side wizard state.
 */
export default async function CourseWizardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const course = await getCreatorCourse(id);
  if (!course) notFound();

  const steps = buildCourseWizardSteps({
    courseId: course.id,
    title: course.title,
    description: course.description,
    categorySlug: course.categorySlug,
    thumbnailKey: course.thumbnailKey,
    lessonsCount: course.lessonsCount,
    status: course.status,
  });

  return <CourseWizardFrame steps={steps}>{children}</CourseWizardFrame>;
}
