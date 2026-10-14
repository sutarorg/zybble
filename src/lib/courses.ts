/**
 * Client-safe catalog helpers.
 *
 * The catalog itself comes from Supabase (see `src/lib/server/catalog.ts`).
 * This module holds only pure functions that operate on a pool the caller
 * already fetched, so the same filtering/sorting code runs on the server and in
 * the browser without importing a database client.
 */

import type {
  Category,
  Course,
  CourseFilters,
  CourseLevel,
  DurationFilter,
  Instructor,
  SortOption,
} from "@/types";
import { CATEGORIES } from "@/lib/config/catalog";

export const getCategoryBySlug = (slug: string): Category | undefined =>
  CATEGORIES.find((category) => category.slug === slug);

export const LEVEL_LABELS: Record<CourseLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

/**
 * Price filter buckets are INR-only. `free` means a zero-paise course; there is
 * no currency threshold because there is no second currency.
 */
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
};

export function durationBucket(minutes: number): Exclude<DurationFilter, "all"> {
  if (minutes < 180) return "short";
  if (minutes <= 480) return "medium";
  return "long";
}

export function searchCourses(query: string, pool: Course[]): Course[] {
  const q = query.trim().toLowerCase();
  if (!q) return pool;
  const terms = q.split(/\s+/);
  return pool.filter((course) => {
    const instructor = course.instructor?.name ?? "";
    const category = getCategoryBySlug(course.category)?.name ?? "";
    const haystack = [course.title, course.subtitle, course.description, instructor, category, course.level, ...course.tags]
      .join(" ")
      .toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}

export function filterCourses(filters: CourseFilters, pool: Course[]): Course[] {
  return pool.filter((course) => {
    if (filters.price === "free" && course.pricePaise !== 0) return false;
    if (filters.price === "paid" && course.pricePaise === 0) return false;
    if (filters.level !== "all" && course.level !== filters.level) return false;
    if (filters.duration !== "all" && durationBucket(course.durationMinutes) !== filters.duration) return false;
    if (filters.language !== "all" && course.language !== filters.language) return false;
    if (filters.resources && course.downloadableResources === 0) return false;
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
      return list.sort((a, b) => a.pricePaise - b.pricePaise);
    case "price-desc":
      return list.sort((a, b) => b.pricePaise - a.pricePaise);
  }
}

export interface CourseQuery {
  q?: string;
  category?: string | null;
  filters: CourseFilters;
  sort: SortOption;
}

export function queryCourses(pool: Course[], { q, category, filters, sort }: CourseQuery): Course[] {
  let result = pool;
  if (category) result = result.filter((course) => course.category === category);
  if (q) result = searchCourses(q, result);
  result = filterCourses(filters, result);
  return sortCourses(result, sort);
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
    filters.resources
  );
}

export function activeFilterCount(filters: CourseFilters): number {
  let n = 0;
  if (filters.price !== "all") n++;
  if (filters.level !== "all") n++;
  if (filters.duration !== "all") n++;
  if (filters.language !== "all") n++;
  if (filters.resources) n++;
  return n;
}

/** Resolves a course's category from the canonical configuration. */
/** Instructor snapshot for a course. Always comes from the database. */
export function getCourseInstructor(course: Course): Instructor | undefined {
  return course.instructor;
}

/** Marketplace-wide counters, read from Postgres by the caller. */
export interface MarketplaceStats {
  courses: number;
  instructors: number;
  students: number;
  lessons: number;
  categories: number;
}

/** Aggregate figures for one creator's public profile. */
export interface InstructorStats {
  courses: number;
  students: number;
  reviews: number;
  rating: number;
}

export function courseCategory(course: Course): Category {
  return CATEGORIES.find((category) => category.slug === course.category) ?? CATEGORIES[0];
}
