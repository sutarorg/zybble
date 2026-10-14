/**
 * Learner data reads and mutations.
 *
 * Every function runs on the server. Private data is fetched through the
 * signed-in user's RLS-scoped client, and every mutation re-checks the session
 * server-side — a client cannot pass another learner's id and get their data.
 */

import "server-only";
import { cache } from "react";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getSession, requireSession } from "@/lib/server/session";
import { CURRENCY } from "@/lib/money";
import type {
  LearnerCertificate,
  LearnerCourse,
  LearnerEnrollment,
  LearnerOrder,
} from "@/lib/learner-types";

export type { LearnerCertificate, LearnerCourse, LearnerEnrollment, LearnerOrder };

/* -------------------------------------------------------------------------- */
/* View models                                                                 */
/* -------------------------------------------------------------------------- */

const COURSE_FIELDS = `
  id, slug, title, subtitle, thumbnail_key, price_paise, duration_minutes,
  lessons_count, level, category_id, creator_id,
  categories ( slug, name ),
  creator_profiles ( display_name, username )
`;

function mapCourse(row: Record<string, unknown>): LearnerCourse {
  const category = (row.categories ?? null) as { slug: string; name: string } | null;
  const creator = (row.creator_profiles ?? null) as { display_name: string | null; username: string | null } | null;
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    subtitle: String(row.subtitle ?? ""),
    thumbnailKey: (row.thumbnail_key as string) ?? null,
    pricePaise: Number(row.price_paise ?? 0),
    creatorName: creator?.display_name ?? "Zybble creator",
    creatorUsername: creator?.username ?? null,
    durationMinutes: Number(row.duration_minutes ?? 0),
    lessonsCount: Number(row.lessons_count ?? 0),
    level: String(row.level ?? "beginner"),
    categorySlug: category?.slug ?? null,
    categoryName: category?.name ?? null,
  };
}

/* -------------------------------------------------------------------------- */
/* Reads                                                                       */
/* -------------------------------------------------------------------------- */

export const getEnrollments = cache(async (): Promise<LearnerEnrollment[]> => {
  const session = await getSession();
  if (!session || !isSupabaseConfigured()) return [];
  const supabase = await createServerClient();

  const { data } = await supabase
    .from("entitlements")
    .select(
      `id, created_at, course_id,
       courses ( ${COURSE_FIELDS} ),
       lesson_progress ( completed ),
       course_resume ( lesson_id, last_visited_at )`
    )
    .eq("user_id", session.id)
    .is("revoked_at", null);

  if (!data) return [];

  return (data as Array<Record<string, unknown>>)
    .map((row) => {
      const course = row.courses as Record<string, unknown> | null;
      if (!course) return null;
      const progress = (row.lesson_progress ?? []) as Array<{ completed: boolean }>;
      const completedCount = progress.filter((p) => p.completed).length;
      const totalLessons = Number(course.lessons_count ?? 0);
      const resume = (row.course_resume ?? []) as Array<{ lesson_id: string | null; last_visited_at: string }>;
      return {
        course: mapCourse(course),
        enrolledAt: String(row.created_at),
        progressPercent: totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0,
        completedCount,
        totalLessons,
        lastLessonId: resume[0]?.lesson_id ?? null,
        lastVisitedAt: resume[0]?.last_visited_at ?? null,
      };
    })
    .filter(Boolean) as LearnerEnrollment[];
});

export const getOrders = cache(async (): Promise<LearnerOrder[]> => {
  const session = await getSession();
  if (!session || !isSupabaseConfigured()) return [];
  const supabase = await createServerClient();

  const { data } = await supabase
    .from("orders")
    .select(
      `id, public_id, status, currency, total_paise, is_free, created_at, paid_at,
       payments ( method ),
       order_items ( course_id, course_slug, course_title, thumbnail_key, unit_price_paise, commission_bps, creator_share_paise )`
    )
    .eq("user_id", session.id)
    .order("created_at", { ascending: false });

  if (!data) return [];

  return (data as Array<Record<string, unknown>>).map((row) => {
    const payments = (row.payments ?? []) as Array<{ method: string | null }>;
    return {
      id: String(row.id),
      publicId: String(row.public_id),
      status: String(row.status),
      currency: "INR" as const,
      totalPaise: Number(row.total_paise ?? 0),
      isFree: Boolean(row.is_free),
      createdAt: String(row.created_at),
      paidAt: (row.paid_at as string) ?? null,
      method: payments[0]?.method ?? (row.is_free ? "Free enrollment" : "—"),
      items: ((row.order_items ?? []) as Array<Record<string, unknown>>).map((item) => ({
        courseId: String(item.course_id),
        courseSlug: String(item.course_slug),
        courseTitle: String(item.course_title),
        thumbnailKey: (item.thumbnail_key as string) ?? null,
        unitPricePaise: Number(item.unit_price_paise ?? 0),
        commissionBps: Number(item.commission_bps ?? 0),
        creatorSharePaise: Number(item.creator_share_paise ?? 0),
      })),
    };
  });
});

export const getOrderByPublicId = cache(async (publicId: string): Promise<LearnerOrder | null> => {
  const orders = await getOrders();
  return orders.find((order) => order.publicId === publicId) ?? null;
});

export const getWishlist = cache(async (): Promise<LearnerCourse[]> => {
  const session = await getSession();
  if (!session || !isSupabaseConfigured()) return [];
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("wishlist")
    .select(`course_id, courses ( ${COURSE_FIELDS} )`)
    .eq("user_id", session.id)
    .order("created_at", { ascending: false });
  return ((data ?? []) as Array<Record<string, unknown>>)
    .map((row) => mapCourse(row.courses as Record<string, unknown>))
    .filter(Boolean);
});

export const getCertificates = cache(async (): Promise<LearnerCertificate[]> => {
  const session = await getSession();
  if (!session || !isSupabaseConfigured()) return [];
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("certificates")
    .select("id, verification_code, course_id, course_title, student_name, lessons_count, duration_minutes, issued_at")
    .eq("user_id", session.id)
    .is("revoked_at", null)
    .order("issued_at", { ascending: false });
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    verificationCode: String(row.verification_code),
    courseId: String(row.course_id),
    courseTitle: String(row.course_title),
    studentName: String(row.student_name),
    instructorName: "",
    lessonsCount: Number(row.lessons_count ?? 0),
    durationMinutes: Number(row.duration_minutes ?? 0),
    issuedAt: String(row.issued_at),
  }));
});

export const getRecentViews = cache(async () => {
  const session = await getSession();
  if (!session || !isSupabaseConfigured()) return [];
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("recent_course_views")
    .select(`course_id, viewed_at, courses ( ${COURSE_FIELDS} )`)
    .eq("user_id", session.id)
    .order("viewed_at", { ascending: false })
    .limit(10);
  return ((data ?? []) as Array<Record<string, unknown>>)
    .map((row) => ({ course: mapCourse(row.courses as Record<string, unknown>), viewedAt: String(row.viewed_at) }))
    .filter((entry) => entry.course);
});

export const getNotifications = cache(async () => {
  const session = await getSession();
  if (!session || !isSupabaseConfigured()) return [];
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, kind, title, body, href, read_at, created_at")
    .eq("user_id", session.id)
    .order("created_at", { ascending: false })
    .limit(30);
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    kind: String(row.kind),
    title: String(row.title),
    body: (row.body as string) ?? "",
    href: (row.href as string) ?? null,
    read: Boolean(row.read_at),
    createdAt: String(row.created_at),
  }));
});

export const getLearnerPreferences = cache(async () => {
  const session = await getSession();
  if (!session || !isSupabaseConfigured()) {
    return { goalMinutesPerDay: 30, emailCourseUpdates: true, emailPromos: false, weeklyReport: true, studyReminders: true };
  }
  const supabase = await createServerClient();
  const { data } = await supabase.from("learner_preferences").select("*").eq("user_id", session.id).maybeSingle();
  return {
    goalMinutesPerDay: Number(data?.goal_minutes_per_day ?? 30),
    emailCourseUpdates: Boolean(data?.email_course_updates ?? true),
    emailPromos: Boolean(data?.email_promos ?? false),
    weeklyReport: Boolean(data?.weekly_report ?? true),
    studyReminders: Boolean(data?.study_reminders ?? true),
  };
});

export const getConversations = cache(async () => {
  const session = await getSession();
  if (!session || !isSupabaseConfigured()) return [];
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("conversations")
    .select(`id, subject, created_at, profiles!conversations_learner_id_fkey ( full_name ), messages ( id, sender_id, body, created_at, read_at )`)
    .or(`learner_id.eq.${session.id},creator_id.eq.${session.id},admin_id.eq.${session.id}`)
    .order("updated_at", { ascending: false });

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const person = (row.profiles ?? null) as { full_name: string | null } | null;
    const messages = ((row.messages ?? []) as Array<Record<string, unknown>>).map((m) => ({
      id: String(m.id),
      mine: m.sender_id === session.id,
      text: String(m.body),
      time: String(m.created_at),
    }));
    return {
      id: String(row.id),
      name: person?.full_name ?? "Zybble support",
      subject: (row.subject as string) ?? "Support",
      messages,
    };
  });
});

/* -------------------------------------------------------------------------- */
/* Progress, notes and course access                                           */
/* -------------------------------------------------------------------------- */

export interface LessonRow {
  id: string;
  title: string;
  description: string | null;
  kind: string;
  sortOrder: number;
  durationMinutes: number;
  isPreview: boolean;
  hasVideo: boolean;
  videoReady: boolean;
  sectionId: string | null;
}

export interface LearningCourseDetail {
  course: LearnerCourse;
  sections: Array<{ id: string; title: string; sortOrder: number }>;
  lessons: LessonRow[];
  completedLessonIds: string[];
  notes: Record<string, string>;
  lastLessonId: string | null;
  resources: Array<{ id: string; title: string; fileName: string; sizeBytes: number }>;
  progressPercent: number;
}

/**
 * Loads a course for the lesson player.
 *
 * Returns `null` when the caller has no entitlement and the course is not
 * published with previews — a guessed `/learn/[courseId]` URL grants nothing.
 */
export const getLearningCourse = cache(
  async (courseId: string): Promise<LearningCourseDetail | null> => {
    const session = await requireSession();
    if (!isSupabaseConfigured()) return null;
    const supabase = await createServerClient();

    const { data: courseRow } = await supabase
      .from("courses")
      .select(`${COURSE_FIELDS}, status`)
      .eq("id", courseId)
      .maybeSingle();
    if (!courseRow) return null;

    const status = String((courseRow as Record<string, unknown>).status);
    const { data: entitlement } = await supabase
      .from("entitlements")
      .select("id")
      .eq("user_id", session.id)
      .eq("course_id", courseId)
      .is("revoked_at", null)
      .maybeSingle();

    const hasAccess = Boolean(entitlement);
    const isPublicPreview = status === "published";
    if (!hasAccess && !isPublicPreview) return null;

    const [{ data: sections }, { data: lessons }, { data: progress }, { data: notes }, { data: resume }, { data: resources }] =
      await Promise.all([
        supabase.from("course_sections").select("id, title, sort_order").eq("course_id", courseId).order("sort_order"),
        supabase
          .from("lessons")
          .select("id, title, description, kind, sort_order, duration_minutes, is_preview, section_id, bunny_video_id, bunny_playback_ready")
          .eq("course_id", courseId)
          .order("sort_order"),
        supabase.from("lesson_progress").select("lesson_id, completed").eq("user_id", session.id).eq("course_id", courseId),
        supabase.from("lesson_notes").select("lesson_id, body").eq("user_id", session.id).eq("course_id", courseId),
        supabase.from("course_resume").select("lesson_id").eq("user_id", session.id).eq("course_id", courseId).maybeSingle(),
        hasAccess
          ? supabase.from("course_resources").select("id, title, file_name, size_bytes").eq("course_id", courseId).order("sort_order")
          : Promise.resolve({ data: [] as unknown[] }),
      ]);

    const lessonRows: LessonRow[] = ((lessons ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id),
      title: String(row.title),
      description: (row.description as string) ?? null,
      kind: String(row.kind),
      sortOrder: Number(row.sort_order ?? 0),
      durationMinutes: Number(row.duration_minutes ?? 0),
      isPreview: Boolean(row.is_preview),
      // Preview access is limited to the lessons explicitly flagged as previews.
      hasVideo: hasAccess || Boolean(row.is_preview),
      videoReady: Boolean(row.bunny_playback_ready),
      sectionId: (row.section_id as string) ?? null,
    }));

    // Non-entitled visitors only ever see the preview lessons.
    const visibleLessons = hasAccess ? lessonRows : lessonRows.filter((lesson) => lesson.isPreview);
    const completedIds = ((progress ?? []) as Array<{ lesson_id: string; completed: boolean }>)
      .filter((p) => p.completed)
      .map((p) => p.lesson_id);

    const noteMap: Record<string, string> = {};
    for (const note of (notes ?? []) as Array<{ lesson_id: string; body: string }>) {
      noteMap[note.lesson_id] = note.body;
    }

    const totalLessons = visibleLessons.length;
    const progressPercent =
      totalLessons > 0 ? Math.round((completedIds.filter((id) => visibleLessons.some((l) => l.id === id)).length / totalLessons) * 100) : 0;

    return {
      course: mapCourse(courseRow as Record<string, unknown>),
      sections: ((sections ?? []) as Array<Record<string, unknown>>).map((row) => ({
        id: String(row.id),
        title: String(row.title),
        sortOrder: Number(row.sort_order ?? 0),
      })),
      lessons: visibleLessons,
      completedLessonIds: completedIds,
      notes: noteMap,
      lastLessonId: (resume?.lesson_id as string) ?? visibleLessons[0]?.id ?? null,
      resources: ((resources ?? []) as Array<Record<string, unknown>>).map((row) => ({
        id: String(row.id),
        title: String(row.title),
        fileName: String(row.file_name),
        sizeBytes: Number(row.size_bytes ?? 0),
      })),
      progressPercent,
    };
  }
);

/**
 * Issues a certificate once every lesson of a course is complete.
 *
 * Completion is recomputed from persisted `lesson_progress` rows against the
 * authoritative lesson list, so the browser cannot mint one by claiming progress
 * it never made.
 */
export async function issueCertificateIfComplete(courseId: string): Promise<string | null> {
  const session = await requireSession();
  const service = createServiceClient();
  if (!service) return null;

  const { data: entitlement } = await service
    .from("entitlements")
    .select("id")
    .eq("user_id", session.id)
    .eq("course_id", courseId)
    .is("revoked_at", null)
    .maybeSingle();
  if (!entitlement) return null;

  const { data: course } = await service
    .from("courses")
    .select("title, slug, duration_minutes, creator_id")
    .eq("id", courseId)
    .maybeSingle();

  const [{ data: lessons }, { data: progress }, { data: creator }] = await Promise.all([
    service.from("lessons").select("id").eq("course_id", courseId),
    service.from("lesson_progress").select("lesson_id, completed").eq("user_id", session.id).eq("course_id", courseId).eq("completed", true),
    service
      .from("creator_profiles")
      .select("display_name")
      .eq("user_id", course?.creator_id ?? "")
      .maybeSingle(),
  ]);

  const total = (lessons ?? []).length;
  const completed = (progress ?? []).length;
  if (total === 0 || completed < total) return null;

  const code = await generateVerificationCode();
  const { data: existing } = await service
    .from("certificates")
    .select("verification_code")
    .eq("user_id", session.id)
    .eq("course_id", courseId)
    .maybeSingle();
  if (existing) return existing.verification_code as string;

  await service.from("certificates").insert({
    verification_code: code,
    user_id: session.id,
    course_id: courseId,
    student_name: session.fullName,
    course_title: course?.title ?? "Course",
    instructor_name: creator?.display_name ?? "Zybble creator",
    lessons_count: total,
    duration_minutes: Number(course?.duration_minutes ?? 0),
  });

  await service.from("notifications").insert({
    user_id: session.id,
    kind: "course",
    title: "Certificate issued",
    body: `You completed ${course?.title ?? "a course"}.`,
    href: "/certificates",
  });

  return code;
}

/** Crockford-style base32 code, unambiguous and long enough to resist guessing. */
export async function generateVerificationCode(): Promise<string> {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  let body = "";
  for (const byte of bytes) body += alphabet[byte % alphabet.length];
  return `ZYB-${body.slice(0, 5)}-${body.slice(5, 10)}`;
}

export const CURRENCY_CODE = CURRENCY;
