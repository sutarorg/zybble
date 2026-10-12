import { CATEGORIES, COURSES, INSTRUCTORS, REVIEWS } from "@/data/mock-data";
import type {
  Category,
  Course,
  CourseFilters,
  CourseLevel,
  DurationFilter,
  Instructor,
  Review,
  SortOption,
} from "@/types";

/* -------------------------------------------------------------------------- */
/* Lookups                                                                     */
/* -------------------------------------------------------------------------- */

export const getCourseBySlug = (slug: string) => COURSES.find((c) => c.slug === slug);
export const getCourseById = (id: string) => COURSES.find((c) => c.id === id);
export const getCategoryBySlug = (slug: string) => CATEGORIES.find((c) => c.slug === slug);
export const getInstructorById = (id: string) => INSTRUCTORS.find((i) => i.id === id);
export const getInstructorByUsername = (username: string) =>
  INSTRUCTORS.find((i) => i.username === username);

export function getCourseInstructor(course: Course): Instructor {
  const instructor = getInstructorById(course.instructorId);
  if (!instructor) throw new Error(`Missing instructor for ${course.slug}`);
  return instructor;
}

export function courseCategory(course: Course): Category {
  const category = getCategoryBySlug(course.category);
  if (!category) throw new Error(`Missing category for ${course.slug}`);
  return category;
}

export const coursesByCategory = (slug: string) => COURSES.filter((c) => c.category === slug);
export const coursesByInstructor = (instructorId: string) =>
  COURSES.filter((c) => c.instructorId === instructorId);

export const getReviewsForCourse = (courseId: string): Review[] =>
  REVIEWS.filter((r) => r.courseId === courseId);

export function relatedCourses(course: Course, count = 3): Course[] {
  const same = COURSES.filter((c) => c.category === course.category && c.id !== course.id);
  const others = COURSES.filter((c) => c.category !== course.category && c.id !== course.id);
  return [...sortCourses(same, "popular"), ...sortCourses(others, "rating")].slice(0, count);
}

/* -------------------------------------------------------------------------- */
/* Derived stats                                                               */
/* -------------------------------------------------------------------------- */

export function instructorStats(instructorId: string) {
  const courses = coursesByInstructor(instructorId);
  const students = courses.reduce((acc, c) => acc + c.studentsCount, 0);
  const reviews = courses.reduce((acc, c) => acc + c.ratingsCount, 0);
  const rating =
    courses.length === 0
      ? 0
      : Math.round((courses.reduce((acc, c) => acc + c.rating, 0) / courses.length) * 10) / 10;
  return { courses: courses.length, students, reviews, rating };
}

export function marketplaceStats() {
  return {
    courses: COURSES.length,
    instructors: INSTRUCTORS.length,
    students: COURSES.reduce((acc, c) => acc + c.studentsCount, 0),
    lessons: COURSES.reduce((acc, c) => acc + c.lessonsCount, 0),
    categories: CATEGORIES.length,
  };
}

/* -------------------------------------------------------------------------- */
/* Labels                                                                      */
/* -------------------------------------------------------------------------- */

export const LEVEL_LABELS: Record<CourseLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export const SORT_LABELS: Record<SortOption, string> = {
  popular: "Most Popular",
  newest: "Newest",
  rating: "Highest Rated",
  "price-asc": "Price: Low to High",
  "price-desc": "Price: High to Low",
};

export const DEFAULT_FILTERS: CourseFilters = {
  price: "all",
  level: "all",
  duration: "all",
  language: "all",
  resources: false,
  aiTutor: false,
};

/* -------------------------------------------------------------------------- */
/* Query engine                                                                */
/* -------------------------------------------------------------------------- */

function durationBucket(minutes: number): Exclude<DurationFilter, "all"> {
  if (minutes < 180) return "short";
  if (minutes <= 480) return "medium";
  return "long";
}

export function searchCourses(query: string, pool: Course[] = COURSES): Course[] {
  const q = query.trim().toLowerCase();
  if (!q) return pool;
  const terms = q.split(/\s+/);
  return pool.filter((course) => {
    const instructor = getCourseInstructor(course);
    const haystack = [
      course.title,
      course.subtitle,
      course.description,
      instructor.name,
      courseCategory(course).name,
      course.level,
      ...course.tags,
    ]
      .join(" ")
      .toLowerCase();
    return terms.every((t) => haystack.includes(t));
  });
}

export function filterCourses(filters: CourseFilters, pool: Course[] = COURSES): Course[] {
  return pool.filter((course) => {
    if (filters.price === "free" && course.price !== 0) return false;
    if (filters.price === "paid" && course.price === 0) return false;
    if (filters.level !== "all" && course.level !== filters.level) return false;
    if (filters.duration !== "all" && durationBucket(course.durationMinutes) !== filters.duration)
      return false;
    if (filters.language !== "all" && course.language !== filters.language) return false;
    if (filters.resources && course.downloadableResources === 0) return false;
    if (filters.aiTutor && !course.hasAiTutor) return false;
    return true;
  });
}

export function sortCourses(courses: Course[], sort: SortOption): Course[] {
  const list = [...courses];
  switch (sort) {
    case "popular":
      return list.sort((a, b) => b.studentsCount - a.studentsCount);
    case "newest":
      return list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    case "rating":
      return list.sort((a, b) => b.rating - a.rating || b.ratingsCount - a.ratingsCount);
    case "price-asc":
      return list.sort((a, b) => a.price - b.price);
    case "price-desc":
      return list.sort((a, b) => b.price - a.price);
  }
}

export interface CourseQuery {
  q?: string;
  category?: string | null;
  filters: CourseFilters;
  sort: SortOption;
}

export function queryCourses({ q, category, filters, sort }: CourseQuery): Course[] {
  let pool: Course[] = COURSES;
  if (category) pool = pool.filter((c) => c.category === category);
  if (q) pool = searchCourses(q, pool);
  pool = filterCourses(filters, pool);
  return sortCourses(pool, sort);
}

/** Did the user change anything away from defaults? Drives curated vs results mode. */
export function hasActiveQuery(q: string, category: string | null, filters: CourseFilters): boolean {
  if (q.trim()) return true;
  if (category) return true;
  return (
    filters.price !== "all" ||
    filters.level !== "all" ||
    filters.duration !== "all" ||
    filters.language !== "all" ||
    filters.resources ||
    filters.aiTutor
  );
}

export function activeFilterCount(filters: CourseFilters): number {
  let n = 0;
  if (filters.price !== "all") n++;
  if (filters.level !== "all") n++;
  if (filters.duration !== "all") n++;
  if (filters.language !== "all") n++;
  if (filters.resources) n++;
  if (filters.aiTutor) n++;
  return n;
}
