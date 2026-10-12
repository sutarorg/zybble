import { COURSES, INSTRUCTORS } from "@/data/mock-data";
import type { Course, CurriculumSection, Enrollment, Lesson } from "@/types";

/* -------------------------------------------------------------------------- */
/* Course resolution & lesson flattening                                        */
/* -------------------------------------------------------------------------- */

export interface FlatLesson {
  lesson: Lesson;
  section: CurriculumSection;
  sectionIndex: number;
  lessonIndex: number;
  /** Position across the whole course (0-based). */
  globalIndex: number;
  /** e.g. "2.3" */
  number: string;
}

export function flattenLessons(course: Course): FlatLesson[] {
  const out: FlatLesson[] = [];
  course.curriculum.forEach((section, sectionIndex) => {
    section.lessons.forEach((lesson, lessonIndex) => {
      out.push({
        lesson,
        section,
        sectionIndex,
        lessonIndex,
        globalIndex: out.length,
        number: `${sectionIndex + 1}.${lessonIndex + 1}`,
      });
    });
  });
  return out;
}

/** Resolve a course by id or slug across the static catalog + community list. */
export function resolveCourse(idOrSlug: string, community: Course[] = []): Course | undefined {
  return (
    COURSES.find((c) => c.id === idOrSlug || c.slug === idOrSlug) ??
    community.find((c) => c.id === idOrSlug || c.slug === idOrSlug)
  );
}

/* -------------------------------------------------------------------------- */
/* Progress                                                                    */
/* -------------------------------------------------------------------------- */

export interface CourseProgress {
  totalLessons: number;
  completedCount: number;
  percent: number;
  isCompleted: boolean;
  /** Minutes of completed lessons. */
  completedMinutes: number;
  /** Index of the lesson to resume at (first incomplete, else last lesson). */
  resumeIndex: number;
  resumeLesson: FlatLesson | null;
  lastVisitedAt: string | null;
}

export function progressOf(course: Course, enrollment: Enrollment | undefined): CourseProgress {
  const flat = flattenLessons(course);
  const totalLessons = flat.length;
  const completed = new Set(enrollment?.completedLessons ?? []);

  // Migration: legacy enrollments only had a percentage.
  if (enrollment && completed.size === 0 && enrollment.progress > 0 && totalLessons > 0) {
    const n = Math.round((enrollment.progress / 100) * totalLessons);
    flat.slice(0, n).forEach((f) => completed.add(f.lesson.id));
  }

  const completedCount = flat.filter((f) => completed.has(f.lesson.id)).length;
  const percent = totalLessons === 0 ? 0 : Math.round((completedCount / totalLessons) * 100);
  const completedMinutes = flat
    .filter((f) => completed.has(f.lesson.id))
    .reduce((a, f) => a + f.lesson.durationMinutes, 0);

  const firstIncomplete = flat.find((f) => !completed.has(f.lesson.id));
  let resume: FlatLesson | null = firstIncomplete ?? flat[flat.length - 1] ?? null;
  if (enrollment?.lastLessonId) {
    const known = flat.find((f) => f.lesson.id === enrollment.lastLessonId);
    if (known && !completed.has(known.lesson.id)) resume = known;
  }

  return {
    totalLessons,
    completedCount,
    percent,
    isCompleted: totalLessons > 0 && completedCount === totalLessons,
    completedMinutes,
    resumeIndex: resume?.globalIndex ?? 0,
    resumeLesson: resume,
    lastVisitedAt: enrollment?.lastVisitedAt ?? null,
  };
}

/** Aggregate stats across all enrollments for dashboard cards. */
export function learnerTotals(
  pairs: { course: Course; enrollment: Enrollment }[]
): {
  enrolledCount: number;
  completedCourses: number;
  overallPercent: number;
  lessonsCompleted: number;
  minutesLearned: number;
} {
  let lessons = 0;
  let minutes = 0;
  let percentSum = 0;
  let completedCourses = 0;
  for (const { course, enrollment } of pairs) {
    const p = progressOf(course, enrollment);
    lessons += p.completedCount;
    minutes += p.completedMinutes;
    percentSum += p.percent;
    if (p.isCompleted) completedCourses++;
  }
  return {
    enrolledCount: pairs.length,
    completedCourses,
    overallPercent: pairs.length ? Math.round(percentSum / pairs.length) : 0,
    lessonsCompleted: lessons,
    minutesLearned: minutes,
  };
}

/* -------------------------------------------------------------------------- */
/* Recommendations                                                             */
/* -------------------------------------------------------------------------- */

/** Simple, deterministic recommendations: same categories first, then popular. */
export function recommendedCourses(
  enrolledIds: Set<string>,
  community: Course[] = [],
  count = 4
): Course[] {
  const enrolled = COURSES.filter((c) => enrolledIds.has(c.id));
  const preferredCategories = new Set(enrolled.map((c) => c.category));
  const all = [...community, ...COURSES].filter((c) => !enrolledIds.has(c.id));
  const preferred = all
    .filter((c) => preferredCategories.has(c.category))
    .sort((a, b) => b.studentsCount - a.studentsCount);
  const rest = all
    .filter((c) => !preferredCategories.has(c.category))
    .sort((a, b) => b.rating - a.rating);
  return [...preferred, ...rest].slice(0, count);
}

/* -------------------------------------------------------------------------- */
/* Misc                                                                        */
/* -------------------------------------------------------------------------- */

export function instructorOf(course: Course) {
  return INSTRUCTORS.find((i) => i.id === course.instructorId);
}

export function formatHoursMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function nextLessonOf(course: Course, current: FlatLesson): FlatLesson | null {
  const flat = flattenLessons(course);
  return flat[current.globalIndex + 1] ?? null;
}

export function prevLessonOf(course: Course, current: FlatLesson): FlatLesson | null {
  const flat = flattenLessons(course);
  return flat[current.globalIndex - 1] ?? null;
}
