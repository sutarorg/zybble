/**
 * Public catalog reads.
 *
 * Every function here runs on the server and returns only what a public visitor
 * is allowed to see. When Supabase is not configured the catalog is **empty** —
 * the storefront then renders its empty state rather than sample content.
 */

import "server-only";
import { cache } from "react";
import { createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getSession } from "@/lib/server/session";
import { CATEGORIES } from "@/lib/config/catalog";
import type {
  Category,
  Course,
  CourseFilters,
  CourseLevel,
  DurationFilter,
  Review,
  SortOption,
} from "@/types";

const COURSE_SELECT = `
  id, slug, title, subtitle, description, long_description, what_you_learn,
  requirements, audience, tags, language, level, price_paise, compare_at_paise,
  thumbnail_key, duration_minutes, lessons_count, downloadable_resources,
  rating, ratings_count, students_count, published_at, created_at,
  categories ( slug, name, icon, description ),
  creator_profiles!courses_creator_id_fkey (
    username, display_name, headline, bio, avatar_key, country_code, languages
  )
`;

export interface CatalogCourseRow {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  long_description: string[] | null;
  what_you_learn: string[] | null;
  requirements: string[] | null;
  audience: string[] | null;
  tags: string[] | null;
  language: string;
  level: string;
  price_paise: number;
  compare_at_paise: number | null;
  thumbnail_key: string | null;
  duration_minutes: number;
  lessons_count: number;
  downloadable_resources: number;
  rating: number;
  ratings_count: number;
  students_count: number;
  published_at: string | null;
  created_at: string;
  categories: { slug: string; name: string; icon: string; description: string } | null;
  creator_profiles:
    | {
        username: string | null;
        display_name: string | null;
        headline: string | null;
        bio: string | null;
        avatar_key: string | null;
        country_code: string | null;
        languages: string[] | null;
      }
    | null;
}

function first<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/** Maps a catalog row onto the UI `Course` shape. */
export function mapCourseRow(row: CatalogCourseRow): Course | null {
  const category = first(row.categories);
  const creator = first(row.creator_profiles);
  const categorySlug = category?.slug;
  if (!categorySlug || !creator) return null;

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle ?? "",
    description: row.description ?? "",
    longDescription: row.long_description ?? [],
    category: categorySlug as Course["category"],
    instructorId: creator.username ?? row.id,
    instructor: {
      id: row.id,
      username: creator.username ?? "",
      name: creator.display_name ?? "Zybble creator",
      headline: creator.headline ?? "",
      bio: creator.bio ?? "",
      initials: initialsOf(creator.display_name ?? "Zybble creator"),
      avatarColor: "bg-violet-100 text-violet-700",
      country: creator.country_code ?? "IN",
      languages: creator.languages ?? ["English"],
      avatar: creator.avatar_key ?? undefined,
    } as Course["instructor"],
    thumbnail: row.thumbnail_key ?? "",
    pricePaise: row.price_paise,
    compareAtPaise: row.compare_at_paise,
    rating: Number(row.rating ?? 0),
    ratingsCount: row.ratings_count ?? 0,
    studentsCount: row.students_count ?? 0,
    level: row.level as CourseLevel,
    language: row.language as Course["language"],
    captions: [],
    durationMinutes: row.duration_minutes,
    lessonsCount: row.lessons_count,
    downloadableResources: row.downloadable_resources,
    lastUpdated: row.published_at ?? row.created_at,
    createdAt: row.created_at,
    whatYouLearn: row.what_you_learn ?? [],
    curriculum: [],
    requirements: row.requirements ?? [],
    audience: row.audience ?? [],
    tags: row.tags ?? [],
  };
}

function initialsOf(name: string): string {
  return (
    name
      .split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "Z"
  );
}

/* -------------------------------------------------------------------------- */
/* Queries                                                                     */
/* -------------------------------------------------------------------------- */

export type CatalogSort = SortOption;

export interface CatalogQuery {
  q?: string | null;
  category?: string | null;
  level?: string | null;
  price?: "all" | "free" | "paid";
  language?: string | null;
  duration?: "all" | DurationFilter;
  resources?: boolean;
  sort?: CatalogSort;
  limit?: number;
  offset?: number;
}

const SORT_CLAUSES: Record<CatalogSort, string> = {
  popular: "students_count.desc, ratings_count.desc",
  newest: "published_at.desc",
  rating: "rating.desc, ratings_count.desc",
  "price-asc": "price_paise.asc",
  "price-desc": "price_paise.desc",
};

/**
 * Searches approved, published courses. Drafts, pending, rejected and
 * unpublished records are excluded by the RLS policy *and* by this query, so a
 * hidden course cannot be discovered by probing the API.
 */
export const queryPublishedCourses = cache(async (query: CatalogQuery = {}): Promise<Course[]> => {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createServerClient();

  let builder = supabase
    .from("courses")
    .select(COURSE_SELECT, { count: "exact" })
    .eq("status", "published");

  const search = query.q?.trim();
  if (search) {
    // Parameterised, so a crafted query cannot alter the statement.
    builder = builder.or(
      `title.ilike.%${escapeLike(search)}%,subtitle.ilike.%${escapeLike(search)}%,description.ilike.%${escapeLike(search)}%`
    );
  }
  if (query.category) builder = builder.eq("categories.slug", query.category);
  if (query.level && query.level !== "all") builder = builder.eq("level", query.level);
  if (query.price === "free") builder = builder.eq("price_paise", 0);
  if (query.price === "paid") builder = builder.gt("price_paise", 0);
  if (query.language && query.language !== "all") builder = builder.eq("language", query.language);
  if (query.resources) builder = builder.gt("downloadable_resources", 0);
  if (query.duration && query.duration !== "all") {
    const bounds = durationBounds(query.duration);
    builder = builder.gte("duration_minutes", bounds.min).lte("duration_minutes", bounds.max);
  }

  builder = builder
    .order(SORT_CLAUSES[query.sort ?? "popular"], { ascending: false })
    .range(query.offset ?? 0, (query.offset ?? 0) + (query.limit ?? 48) - 1);

  const { data, error } = await builder;
  if (error || !data) return [];
  return (data as unknown as CatalogCourseRow[]).map(mapCourseRow).filter(Boolean) as Course[];
});

function escapeLike(value: string): string {
  return value.replace(/[%_,()]/g, (match) => `\\${match}`);
}

function durationBounds(bucket: Exclude<DurationFilter, "all">): { min: number; max: number } {
  if (bucket === "short") return { min: 0, max: 179 };
  if (bucket === "medium") return { min: 180, max: 480 };
  return { min: 481, max: 100000 };
}

export const getPublishedCourseBySlug = cache(async (slug: string): Promise<Course | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("courses")
    .select(COURSE_SELECT)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (!data) return null;
  return mapCourseRow(data as unknown as CatalogCourseRow);
});

export const getPublishedCourseById = cache(async (id: string): Promise<Course | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("courses")
    .select(COURSE_SELECT)
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();
  if (!data) return null;
  return mapCourseRow(data as unknown as CatalogCourseRow);
});

/** Published, non-draft lessons for a course. Previews are flagged, not hidden. */
export const getCourseLessons = cache(async (courseId: string) => {
  if (!isSupabaseConfigured()) return { sections: [], lessons: [] as Array<Record<string, unknown>> };
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("course_sections")
    .select("id, title, sort_order, lessons ( id, title, description, kind, sort_order, duration_minutes, is_preview )")
    .eq("course_id", courseId)
    .order("sort_order", { ascending: true });
  const sections = (data ?? []) as Array<Record<string, unknown>>;
  const lessons = sections.flatMap((section) => (section.lessons ?? []) as Array<Record<string, unknown>>);
  return { sections, lessons };
});

export const getPublishedReviews = cache(async (courseId: string): Promise<Review[]> => {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("reviews")
    .select("id, rating, title, body, created_at, profiles ( full_name )")
    .eq("course_id", courseId)
    .eq("published", true)
    .order("created_at", { ascending: false })
    .limit(50);
  if (!data) return [];
  return (data as Array<Record<string, unknown>>).map((row) => {
    const profile = first(row.profiles as { full_name: string | null } | null);
    const authorName = profile?.full_name ?? "Zybble learner";
    return {
      id: String(row.id),
      courseId,
      author: authorName,
      initials: initialsOf(authorName),
      avatarColor: "bg-zinc-100 text-zinc-700",
      rating: Number(row.rating),
      date: String(row.created_at),
      title: (row.title as string) ?? "",
      text: (row.body as string) ?? "",
    };
  });
});

export const getInstructorByUsername = cache(async (username: string) => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerClient();
  // `creator_public_profiles`, not `creator_profiles`. The table also holds the
  // creator's Razorpay Route account identifier, which must stay private; this
  // view is the public half and is readable by signed-out visitors.
  const { data } = await supabase
    .from("creator_public_profiles")
    .select("user_id, username, display_name, headline, bio, avatar_key, country_code, languages, created_at")
    .eq("username", username)
    .maybeSingle();
  if (!data) return null;
  return data as Record<string, unknown>;
});

export const getInstructorPublishedCourses = cache(async (userId: string): Promise<Course[]> => {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("courses")
    .select(COURSE_SELECT)
    .eq("creator_id", userId)
    .eq("status", "published")
    .order("published_at", { ascending: false });
  return ((data ?? []) as unknown as CatalogCourseRow[]).map(mapCourseRow).filter(Boolean) as Course[];
});

/* -------------------------------------------------------------------------- */
/* Marketplace totals                                                          */
/* -------------------------------------------------------------------------- */

export const marketplaceStats = cache(async () => {
  if (!isSupabaseConfigured()) {
    return { courses: 0, instructors: 0, students: 0, lessons: 0, categories: CATEGORIES.length };
  }
  const supabase = await createServerClient();
  const [courses, lessons, instructors] = await Promise.all([
    supabase.from("courses").select("id, students_count", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("lessons").select("id", { count: "exact", head: true }),
    // Counted through the public view: `creator_profiles` itself is not readable
    // by anonymous sessions any more, and an authenticated session may only see
    // its own row, so either table would report "1".
    supabase.from("creator_public_profiles").select("user_id", { count: "exact", head: true }),
  ]);
  const { data: rows } = await supabase
    .from("courses")
    .select("students_count")
    .eq("status", "published");
  const students = (rows ?? []).reduce((sum, row) => sum + (row.students_count ?? 0), 0);
  return {
    courses: courses.count ?? 0,
    instructors: instructors.count ?? 0,
    students,
    lessons: lessons.count ?? 0,
    categories: CATEGORIES.length,
  };
});

/**
 * Viewer-specific state for a course page.
 *
 * Entitlement and wishlist membership are read under the caller's own RLS
 * scope. Paid checkout is only offered when Razorpay reports the creator's Route
 * linked account as active — otherwise a sale could not be settled, so the page
 * explains that instead of taking money.
 */
export const getCourseViewerState = cache(async (courseId: string, pricePaise: number) => {
  const session = await getSession();
  if (!session || !isSupabaseConfigured()) {
    return { enrolled: false, wishlisted: false, checkoutBlocked: blockedReason(pricePaise, null) };
  }

  const supabase = await createServerClient();
  const [entitlement, wishlist, course] = await Promise.all([
    supabase.from("entitlements").select("id").eq("user_id", session.id).eq("course_id", courseId).is("revoked_at", null).maybeSingle(),
    supabase.from("wishlist").select("course_id").eq("user_id", session.id).eq("course_id", courseId).maybeSingle(),
    supabase.from("courses").select("creator_id, creator_profiles ( route_account_status )").eq("id", courseId).maybeSingle(),
  ]);

  const creator = first((course as { creator_profiles?: unknown } | null)?.creator_profiles as never) as
    | { route_account_status: string | null }
    | null;

  return {
    enrolled: Boolean(entitlement),
    wishlisted: Boolean(wishlist),
    checkoutBlocked: blockedReason(pricePaise, creator?.route_account_status ?? null),
  };
});

function blockedReason(pricePaise: number, routeStatus: string | null): string | null {
  if (pricePaise <= 0) return null;
  if (routeStatus === "active") return null;
  return "Paid checkout is unavailable for this course: Razorpay has not reported the creator's Route settlement account as active, so Zybble could not pay them out. You can still watch the free preview lessons.";
}

/**
 * Aggregate figures for one creator's public profile.
 *
 * Counted from published courses and their published reviews only, so a
 * creator's card cannot advertise reach the marketplace does not have.
 */
export const getInstructorStats = cache(async (userId: string) => {
  if (!isSupabaseConfigured()) return { courses: 0, students: 0, reviews: 0, rating: 0 };
  const supabase = await createServerClient();
  const [courses, reviews] = await Promise.all([
    supabase.from("courses").select("id, rating, ratings_count, students_count").eq("creator_id", userId).eq("status", "published"),
    supabase.from("reviews").select("id", { count: "exact", head: true }).eq("published", true).eq("creator_id", userId),
  ]);

  const rows = (courses.data ?? []) as Array<{ rating: number; ratings_count: number; students_count: number }>;
  const ratingCount = rows.reduce((sum, row) => sum + (row.ratings_count ?? 0), 0);
  const weightedRating = rows.reduce((sum, row) => sum + (row.rating ?? 0) * (row.ratings_count ?? 0), 0);
  return {
    courses: rows.length,
    students: rows.reduce((sum, row) => sum + (row.students_count ?? 0), 0),
    reviews: reviews.count ?? 0,
    rating: ratingCount > 0 ? Math.round((weightedRating / ratingCount) * 10) / 10 : 0,
  };
});

export const relatedCourses = cache(async (course: Course, count = 3): Promise<Course[]> => {
  const same = await queryPublishedCourses({ category: course.category, sort: "popular", limit: count + 1 });
  const rest = same.filter((item) => item.id !== course.id).slice(0, count);
  if (rest.length >= count) return rest;
  const others = await queryPublishedCourses({ sort: "rating", limit: count + rest.length });
  return [...rest, ...others.filter((item) => item.id !== course.id && item.category !== course.category)].slice(0, count);
});

export function courseCategory(course: Course): Category {
  return CATEGORIES.find((category) => category.slug === course.category) ?? CATEGORIES[0];
}

export const EMPTY_FILTERS: CourseFilters = {
  price: "all",
  level: "all",
  duration: "all",
  language: "all",
  resources: false,
};
