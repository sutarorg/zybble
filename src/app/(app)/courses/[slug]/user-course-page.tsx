"use client";

import { notFound } from "next/navigation";
import { getInstructorById, relatedCourses } from "@/lib/courses";
import { COURSES } from "@/data/mock-data";
import { useCreator } from "@/components/providers/creator-provider";
import { CourseDetailView } from "@/components/courses/course-detail-view";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Client-side fallback for course slugs that are not part of the static
 * catalog — resolves courses the creator published locally in this browser.
 */
export function UserCoursePage({ slug }: { slug: string }) {
  const { communityCourses, hydrated } = useCreator();
  const course = communityCourses.find((c) => c.slug === slug);

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-330 px-4 py-6 sm:px-6 lg:px-8" aria-busy>
        <Skeleton className="h-4 w-64" />
        <Skeleton className="mt-6 h-9 w-2/3" />
        <Skeleton className="mt-3 h-4 w-1/2" />
        <Skeleton className="mt-8 aspect-video max-w-2xl rounded-xl" />
      </div>
    );
  }

  if (!course) notFound();

  return (
    <CourseDetailView
      course={course}
      instructor={getInstructorById(course.instructorId)!}
      reviews={[]}
      related={relatedCourses(COURSES.find((c) => c.category === course.category) ?? COURSES[0], 3).filter(
        (c) => c.id !== course.id
      )}
    />
  );
}
