import type { Metadata } from "next";
import { COURSES } from "@/data/mock-data";
import {
  getCourseInstructor,
  getCourseBySlug,
  getReviewsForCourse,
  relatedCourses,
} from "@/lib/courses";
import { CourseDetailView } from "@/components/courses/course-detail-view";
import { UserCoursePage } from "./user-course-page";

export function generateStaticParams() {
  return COURSES.map((c) => ({ slug: c.slug }));
}

export function generateStaticParamsConfig() {
  return { dynamicParams: true };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const course = getCourseBySlug(slug);
  if (!course) return { title: "Course" };
  return { title: course.title, description: course.subtitle };
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const course = getCourseBySlug(slug);

  // Unknown static slug → maybe a locally published creator course.
  if (!course) return <UserCoursePage slug={slug} />;

  return (
    <CourseDetailView
      course={course}
      instructor={getCourseInstructor(course)}
      reviews={getReviewsForCourse(course.id)}
      related={relatedCourses(course, 3)}
    />
  );
}
