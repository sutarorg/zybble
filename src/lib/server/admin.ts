/**
 * Admin portal data.
 *
 * Every figure is read from Postgres. There are no seeded users, no simulated
 * payouts and no fabricated activity feed: an empty database produces an empty
 * portal, which is the correct state before the marketplace has any traffic.
 */

import "server-only";
import { cache } from "react";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { requireAdmin } from "@/lib/server/session";
import { CATEGORIES } from "@/lib/config/catalog";

/* -------------------------------------------------------------------------- */
/* Overview                                                                    */
/* -------------------------------------------------------------------------- */

export interface AdminOverview {
  courses: number;
  publishedCourses: number;
  pendingCourses: number;
  learners: number;
  creators: number;
  orders: number;
  grossPaise: number;
  commissionPaise: number;
  creatorPayablePaise: number;
  refundedPaise: number;
  openReports: number;
  routeTransfers: number;
  failedTransfers: number;
  settledPaise: number;
}

export const getAdminOverview = cache(async (): Promise<AdminOverview> => {
  await requireAdmin();
  const empty: AdminOverview = {
    courses: 0, publishedCourses: 0, pendingCourses: 0, learners: 0, creators: 0, orders: 0,
    grossPaise: 0, commissionPaise: 0, creatorPayablePaise: 0, refundedPaise: 0,
    openReports: 0, routeTransfers: 0, failedTransfers: 0, settledPaise: 0,
  };
  if (!isSupabaseConfigured()) return empty;
  const service = createServiceClient();
  if (!service) return empty;

  const [
    courses, published, pending, learners, creators, orders,
    commissionLedger, creatorLedger, refunds, reports, transfers, failedTransfers, settlements,
  ] = await Promise.all([
    service.from("courses").select("id", { count: "exact", head: true }),
    service.from("courses").select("id", { count: "exact", head: true }).eq("status", "published"),
    service.from("courses").select("id", { count: "exact", head: true }).eq("status", "pending"),
    service.from("profiles").select("id", { count: "exact", head: true }).eq("role", "learner"),
    service.from("creator_profiles").select("user_id", { count: "exact", head: true }),
    service.from("orders").select("id", { count: "exact", head: true }),
    service.from("ledger_entries").select("amount_paise").eq("kind", "commission"),
    service.from("ledger_entries").select("amount_paise").eq("kind", "sale").eq("account", "platform").eq("direction", "debit"),
    service.from("refunds").select("amount_paise"),
    service.from("reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    service.from("route_transfers").select("id", { count: "exact", head: true }),
    service.from("route_transfers").select("id", { count: "exact", head: true }).eq("status", "failed"),
    service.from("route_settlements").select("amount_paise").eq("status", "processed"),
  ]);

  const sum = (rows: { amount_paise: number }[] | null) =>
    (rows ?? []).reduce((total, row) => total + Number(row.amount_paise ?? 0), 0);

  const { data: sales } = await service
    .from("ledger_entries")
    .select("amount_paise")
    .eq("kind", "sale")
    .eq("direction", "credit")
    .not("account", "eq", "platform");

  return {
    courses: courses.count ?? 0,
    publishedCourses: published.count ?? 0,
    pendingCourses: pending.count ?? 0,
    learners: learners.count ?? 0,
    creators: creators.count ?? 0,
    orders: orders.count ?? 0,
    grossPaise: sum(creatorLedger.data as { amount_paise: number }[]) + sum(commissionLedger.data as { amount_paise: number }[]),
    commissionPaise: sum(commissionLedger.data as { amount_paise: number }[]),
    creatorPayablePaise: sum(sales as { amount_paise: number }[]),
    refundedPaise: sum(refunds.data as { amount_paise: number }[]),
    openReports: reports.count ?? 0,
    routeTransfers: transfers.count ?? 0,
    failedTransfers: failedTransfers.count ?? 0,
    settledPaise: sum(settlements.data as { amount_paise: number }[]),
  };
});

/* -------------------------------------------------------------------------- */
/* Moderation queue                                                            */
/* -------------------------------------------------------------------------- */

export interface AdminCourseRow {
  id: string;
  slug: string;
  title: string;
  status: string;
  categoryName: string | null;
  creatorName: string;
  creatorUsername: string | null;
  routeStatus: string | null;
  pricePaise: number;
  lessonsCount: number;
  durationMinutes: number;
  thumbnailKey: string | null;
  submittedAt: string | null;
  publishedAt: string | null;
  rejectionReason: string | null;
  studentsCount: number;
  rating: number;
  ratingsCount: number;
}

export const getAdminCourses = cache(async (status?: string | null): Promise<AdminCourseRow[]> => {
  await requireAdmin();
  if (!isSupabaseConfigured()) return [];
  const service = createServiceClient();
  if (!service) return [];

  let query = service
    .from("courses")
    .select(
      `id, slug, title, status, price_paise, lessons_count, duration_minutes, thumbnail_key,
       submitted_at, published_at, rejection_reason, students_count, rating, ratings_count,
       categories ( name ),
       profiles!courses_creator_id_fkey ( full_name ),
       creator_profiles ( display_name, username, route_account_status )`
    )
    .order("updated_at", { ascending: false })
    .limit(200);

  if (status && status !== "all") query = query.eq("status", status);
  const { data } = await query;

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const category = (row.categories ?? null) as { name: string } | null;
    const creator = (row.creator_profiles ?? null) as
      | { display_name: string | null; username: string | null; route_account_status: string | null }
      | null;
    return {
      id: String(row.id),
      slug: String(row.slug),
      title: String(row.title),
      status: String(row.status),
      categoryName: category?.name ?? null,
      creatorName: creator?.display_name ?? "Unknown creator",
      creatorUsername: creator?.username ?? null,
      routeStatus: creator?.route_account_status ?? null,
      pricePaise: Number(row.price_paise ?? 0),
      lessonsCount: Number(row.lessons_count ?? 0),
      durationMinutes: Number(row.duration_minutes ?? 0),
      thumbnailKey: (row.thumbnail_key as string) ?? null,
      submittedAt: (row.submitted_at as string) ?? null,
      publishedAt: (row.published_at as string) ?? null,
      rejectionReason: (row.rejection_reason as string) ?? null,
      studentsCount: Number(row.students_count ?? 0),
      rating: Number(row.rating ?? 0),
      ratingsCount: Number(row.ratings_count ?? 0),
    };
  });
});

export interface AdminCourseDetail extends AdminCourseRow {
  description: string;
  longDescription: string[];
  whatYouLearn: string[];
  requirements: string[];
  audience: string[];
  tags: string[];
  level: string;
  language: string;
  creatorId: string;
  creatorBio: string | null;
  reviewHistory: Array<{ id: string; at: string; toStatus: string; actorRole: string; note: string | null }>;
  sections: Array<{ id: string; title: string; lessons: Array<{ id: string; title: string; hasVideo: boolean; videoReady: boolean; durationMinutes: number }> }>;
  resources: Array<{ id: string; title: string; fileName: string; sizeBytes: number; contentType: string }>;
  moderationNotes: Array<{ id: string; text: string; createdAt: string; author: string | null }>;
}

export const getAdminCourseDetail = cache(async (courseId: string): Promise<AdminCourseDetail | null> => {
  await requireAdmin();
  if (!isSupabaseConfigured()) return null;
  const service = createServiceClient();
  if (!service) return null;

  const { data: row } = await service
    .from("courses")
    .select(
      `*, categories ( name ), creator_profiles ( display_name, username, bio, route_account_status, route_account_id ),
       course_review_events ( id, created_at, to_status, actor_role, note, profiles ( full_name ) ),
       course_sections ( id, title, sort_order, lessons ( id, title, duration_minutes, bunny_video_id, bunny_playback_ready ) ),
       course_resources ( id, title, file_name, size_bytes, content_type ),
       moderation_notes ( id, text, created_at, profiles ( full_name ) )`
    )
    .eq("id", courseId)
    .maybeSingle();
  if (!row) return null;

  const record = row as Record<string, unknown>;
  const category = (record.categories ?? null) as { name: string } | null;
  const creator = (record.creator_profiles ?? null) as Record<string, unknown> | null;

  return {
    id: String(record.id),
    slug: String(record.slug),
    title: String(record.title),
    status: String(record.status),
    categoryName: category?.name ?? null,
    creatorName: String(creator?.display_name ?? "Unknown creator"),
    creatorUsername: (creator?.username as string) ?? null,
    creatorId: String(record.creator_id),
    creatorBio: (creator?.bio as string) ?? null,
    routeStatus: (creator?.route_account_status as string) ?? null,
    pricePaise: Number(record.price_paise ?? 0),
    lessonsCount: Number(record.lessons_count ?? 0),
    durationMinutes: Number(record.duration_minutes ?? 0),
    thumbnailKey: (record.thumbnail_key as string) ?? null,
    submittedAt: (record.submitted_at as string) ?? null,
    publishedAt: (record.published_at as string) ?? null,
    rejectionReason: (record.rejection_reason as string) ?? null,
    studentsCount: Number(record.students_count ?? 0),
    rating: Number(record.rating ?? 0),
    ratingsCount: Number(record.ratings_count ?? 0),
    description: String(record.description ?? ""),
    longDescription: (record.long_description as string[]) ?? [],
    whatYouLearn: (record.what_you_learn as string[]) ?? [],
    requirements: (record.requirements as string[]) ?? [],
    audience: (record.audience as string[]) ?? [],
    tags: (record.tags as string[]) ?? [],
    level: String(record.level ?? "beginner"),
    language: String(record.language ?? "English"),
    reviewHistory: ((record.course_review_events ?? []) as Array<Record<string, unknown>>)
      .map((event) => {
        const actor = (event.profiles ?? null) as { full_name: string | null } | null;
        return {
          id: String(event.id),
          at: String(event.created_at),
          toStatus: String(event.to_status),
          actorRole: String(event.actor_role),
          note: (event.note as string) ?? null,
        };
      })
      .sort((a, b) => b.at.localeCompare(a.at)),
    sections: ((record.course_sections ?? []) as Array<Record<string, unknown>>).map((section) => ({
      id: String(section.id),
      title: String(section.title),
      lessons: ((section.lessons ?? []) as Array<Record<string, unknown>>).map((lesson) => ({
        id: String(lesson.id),
        title: String(lesson.title),
        hasVideo: Boolean(lesson.bunny_video_id),
        videoReady: Boolean(lesson.bunny_playback_ready),
        durationMinutes: Number(lesson.duration_minutes ?? 0),
      })),
    })),
    resources: ((record.course_resources ?? []) as Array<Record<string, unknown>>).map((resource) => ({
      id: String(resource.id),
      title: String(resource.title),
      fileName: String(resource.file_name),
      sizeBytes: Number(resource.size_bytes ?? 0),
      contentType: String(resource.content_type ?? ""),
    })),
    moderationNotes: ((record.moderation_notes ?? []) as Array<Record<string, unknown>>).map((note) => {
      const author = (note.profiles ?? null) as { full_name: string | null } | null;
      return { id: String(note.id), text: String(note.text), createdAt: String(note.created_at), author: author?.full_name ?? null };
    }),
  };
});

/* -------------------------------------------------------------------------- */
/* Users, orders, transfers                                                    */
/* -------------------------------------------------------------------------- */

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  countryCode: string | null;
  emailVerified: boolean;
  createdAt: string;
  coursesCreated: number;
  enrollments: number;
  lifetimeSpendPaise: number;
  routeStatus: string | null;
}

export const getAdminUsers = cache(async (): Promise<AdminUserRow[]> => {
  await requireAdmin();
  if (!isSupabaseConfigured()) return [];
  const service = createServiceClient();
  if (!service) return [];

  const { data } = await service
    .from("profiles")
    .select(
      `id, full_name, email, role, status, country_code, email_verified, created_at,
       creator_profiles ( route_account_status ),
       courses ( id ),
       entitlements ( id ),
       orders ( total_paise, status )`
    )
    .order("created_at", { ascending: false })
    .limit(300);

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const creator = (row.creator_profiles ?? null) as { route_account_status: string | null } | null;
    const orders = (row.orders ?? []) as Array<{ total_paise: number; status: string }>;
    return {
      id: String(row.id),
      name: String(row.full_name ?? "—"),
      email: String(row.email),
      role: String(row.role),
      status: String(row.status),
      countryCode: (row.country_code as string) ?? null,
      emailVerified: Boolean(row.email_verified),
      createdAt: String(row.created_at),
      coursesCreated: ((row.courses ?? []) as unknown[]).length,
      enrollments: ((row.entitlements ?? []) as unknown[]).length,
      lifetimeSpendPaise: orders
        .filter((order) => order.status === "paid")
        .reduce((sum, order) => sum + Number(order.total_paise ?? 0), 0),
      routeStatus: creator?.route_account_status ?? null,
    };
  });
});

export interface AdminOrderRow {
  id: string;
  publicId: string;
  learnerName: string;
  learnerEmail: string;
  courseTitle: string;
  creatorName: string;
  grossPaise: number;
  commissionBps: number;
  commissionPaise: number;
  creatorSharePaise: number;
  status: string;
  method: string;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  createdAt: string;
  paidAt: string | null;
}

export const getAdminOrders = cache(async (): Promise<AdminOrderRow[]> => {
  await requireAdmin();
  if (!isSupabaseConfigured()) return [];
  const service = createServiceClient();
  if (!service) return [];

  const { data } = await service
    .from("orders")
    .select(
      `id, public_id, status, created_at, paid_at, total_paise, currency,
       profiles!orders_user_id_fkey ( full_name, email ),
       payments ( razorpay_order_id, razorpay_payment_id, method, status ),
       order_items ( course_title, unit_price_paise, commission_bps, commission_paise, creator_share_paise,
                     creator_profiles ( display_name ) )`
    )
    .order("created_at", { ascending: false })
    .limit(300);

  return ((data ?? []) as Array<Record<string, unknown>>).flatMap((row) => {
    const learner = (row.profiles ?? null) as { full_name: string | null; email: string | null } | null;
    const payments = (row.payments ?? []) as Array<Record<string, unknown>>;
    const items = (row.order_items ?? []) as Array<Record<string, unknown>>;
    const payment = payments[0];
    return items.map((item) => {
      const creator = (item.creator_profiles ?? null) as { display_name: string | null } | null;
      return {
        id: String(row.id),
        publicId: String(row.public_id),
        learnerName: learner?.full_name ?? "Learner",
        learnerEmail: learner?.email ?? "",
        courseTitle: String(item.course_title ?? ""),
        creatorName: creator?.display_name ?? "Creator",
        grossPaise: Number(item.unit_price_paise ?? 0),
        commissionBps: Number(item.commission_bps ?? 0),
        commissionPaise: Number(item.commission_paise ?? 0),
        creatorSharePaise: Number(item.creator_share_paise ?? 0),
        status: String(row.status),
        method: String(payment?.method ?? "—"),
        razorpayOrderId: (payment?.razorpay_order_id as string) ?? null,
        razorpayPaymentId: (payment?.razorpay_payment_id as string) ?? null,
        createdAt: String(row.created_at),
        paidAt: (row.paid_at as string) ?? null,
      };
    });
  });
});

export interface AdminTransferRow {
  transferId: string;
  creatorName: string;
  routeAccountId: string;
  amountPaise: number;
  reversedPaise: number;
  status: string;
  settlementStatus: string | null;
  settledAt: string | null;
  createdAt: string;
  orderPublicId: string | null;
}

export const getAdminTransfers = cache(async (): Promise<AdminTransferRow[]> => {
  await requireAdmin();
  if (!isSupabaseConfigured()) return [];
  const service = createServiceClient();
  if (!service) return [];

  const { data } = await service
    .from("route_transfers")
    .select(
      `transfer_id, route_account_id, amount_paise, reversed_paise, status, created_at,
       creator_profiles ( display_name ),
       route_settlements ( status, settled_at ),
       orders ( public_id )`
    )
    .order("created_at", { ascending: false })
    .limit(300);

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const creator = (row.creator_profiles ?? null) as { display_name: string | null } | null;
    const settlements = (row.route_settlements ?? []) as Array<Record<string, unknown>>;
    const order = (row.orders ?? null) as { public_id: string } | null;
    return {
      transferId: String(row.transfer_id ?? ""),
      creatorName: creator?.display_name ?? "Creator",
      routeAccountId: String(row.route_account_id ?? ""),
      amountPaise: Number(row.amount_paise ?? 0),
      reversedPaise: Number(row.reversed_paise ?? 0),
      status: String(row.status),
      settlementStatus: settlements[0] ? String(settlements[0].status) : null,
      settledAt: (settlements[0]?.settled_at as string) ?? null,
      createdAt: String(row.created_at),
      orderPublicId: order?.public_id ?? null,
    };
  });
});

/* -------------------------------------------------------------------------- */
/* Categories, reports, reviews, settings, audit                               */
/* -------------------------------------------------------------------------- */

export const getAdminCategories = cache(async () => {
  await requireAdmin();
  if (!isSupabaseConfigured()) {
    return CATEGORIES.map((category, index) => ({ ...category, id: category.slug, sortOrder: index + 1, visible: true, courseCount: 0 }));
  }
  const service = createServiceClient();
  if (!service) return [];
  const { data } = await service
    .from("categories")
    .select("id, slug, name, description, icon, sort_order, visible, courses ( id )")
    .order("sort_order");
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    shortName: String(row.name),
    description: String(row.description ?? ""),
    icon: String(row.icon ?? "sparkles"),
    sortOrder: Number(row.sort_order ?? 0),
    visible: Boolean(row.visible),
    courseCount: ((row.courses ?? []) as unknown[]).length,
  }));
});

export const getAdminReports = cache(async () => {
  await requireAdmin();
  if (!isSupabaseConfigured()) return [];
  const service = createServiceClient();
  if (!service) return [];
  const { data } = await service
    .from("reports")
    .select("id, kind, target_id, target_label, reason, detail, priority, status, admin_note, created_at, profiles ( full_name )")
    .order("created_at", { ascending: false })
    .limit(200);
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const reporter = (row.profiles ?? null) as { full_name: string | null } | null;
    return {
      id: String(row.id),
      kind: String(row.kind),
      targetId: (row.target_id as string) ?? null,
      targetTitle: String(row.target_label ?? "—"),
      reporterName: reporter?.full_name ?? "Anonymous",
      reason: String(row.reason),
      detail: (row.detail as string) ?? "",
      priority: String(row.priority),
      status: String(row.status),
      adminNote: (row.admin_note as string) ?? "",
      submittedAt: String(row.created_at),
    };
  });
});

/**
 * Operational notifications addressed to administrators.
 *
 * Reads the same `notifications` table the learner and creator chrome uses; the
 * rows are scoped by `audience` so a creator's notification never surfaces in
 * the operations portal.
 */
export const getAdminNotifications = cache(async () => {
  const session = await requireAdmin();
  if (!isSupabaseConfigured()) return [];
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, kind, title, body, href, read_at, created_at")
    .eq("user_id", session.id)
    .order("created_at", { ascending: false })
    .limit(40);
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

export const getAdminReviews = cache(async () => {
  await requireAdmin();
  if (!isSupabaseConfigured()) return [];
  const service = createServiceClient();
  if (!service) return [];
  const { data } = await service
    .from("reviews")
    .select("id, rating, title, body, published, created_at, course_id, courses ( title ), profiles ( full_name )")
    .order("created_at", { ascending: false })
    .limit(300);
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const course = (row.courses ?? null) as { title: string } | null;
    const author = (row.profiles ?? null) as { full_name: string | null } | null;
    return {
      id: String(row.id),
      courseId: String(row.course_id),
      courseTitle: course?.title ?? "—",
      author: author?.full_name ?? "Learner",
      rating: Number(row.rating),
      title: (row.title as string) ?? "",
      body: (row.body as string) ?? "",
      published: Boolean(row.published),
      createdAt: String(row.created_at),
    };
  });
});

export const getAdminSettings = cache(async () => {
  await requireAdmin();
  const fallback = {
    marketplaceName: "Zybble",
    marketplaceDescription: "",
    commissionBps: 1000,
    autoApproveFreeCourses: false,
    autoApproveReturningCreators: false,
    emailReviewDecisions: true,
    requirePayoutApproval: true,
    supportEmail: null as string | null,
    updatedAt: null as string | null,
  };
  if (!isSupabaseConfigured()) return fallback;
  const service = createServiceClient();
  if (!service) return fallback;
  const { data } = await service.from("marketplace_settings").select("*").eq("id", true).maybeSingle();
  if (!data) return fallback;
  return {
    marketplaceName: String(data.marketplace_name ?? "Zybble"),
    marketplaceDescription: String(data.marketplace_description ?? ""),
    commissionBps: Number(data.commission_bps ?? 1000),
    autoApproveFreeCourses: Boolean(data.auto_approve_free_courses),
    autoApproveReturningCreators: Boolean(data.auto_approve_returning_creators),
    emailReviewDecisions: Boolean(data.email_review_decisions),
    requirePayoutApproval: Boolean(data.require_payout_approval),
    supportEmail: (data.support_email as string) ?? null,
    updatedAt: (data.updated_at as string) ?? null,
  };
});

export const getAdminAuditLog = cache(async () => {
  await requireAdmin();
  if (!isSupabaseConfigured()) return [];
  const service = createServiceClient();
  if (!service) return [];
  const { data } = await service
    .from("admin_audit_log")
    .select("id, actor_email, action, target_type, target_id, detail, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []) as Array<Record<string, unknown>>;
});

export interface AdminAnalyticsPoint {
  label: string;
  grossPaise: number;
  orders: number;
  enrollments: number;
}

export const getAdminAnalytics = cache(async (days = 30): Promise<AdminAnalyticsPoint[]> => {
  await requireAdmin();
  if (!isSupabaseConfigured()) return [];
  const service = createServiceClient();
  if (!service) return [];

  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const [{ data: orders }, { data: enrollments }] = await Promise.all([
    service.from("orders").select("created_at, total_paise").eq("status", "paid").gte("created_at", since),
    service.from("entitlements").select("created_at").gte("created_at", since),
  ]);

  const buckets: AdminAnalyticsPoint[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(Date.now() - i * 86_400_000);
    buckets.push({ label: date.toISOString().slice(0, 10), grossPaise: 0, orders: 0, enrollments: 0 });
  }
  const index = new Map(buckets.map((bucket, i) => [bucket.label, i]));
  for (const order of (orders ?? []) as Array<{ created_at: string; total_paise: number }>) {
    const i = index.get(String(order.created_at).slice(0, 10));
    if (i !== undefined) {
      buckets[i].grossPaise += Number(order.total_paise ?? 0);
      buckets[i].orders += 1;
    }
  }
  for (const enrollment of (enrollments ?? []) as Array<{ created_at: string }>) {
    const i = index.get(String(enrollment.created_at).slice(0, 10));
    if (i !== undefined) buckets[i].enrollments += 1;
  }
  return buckets;
});
