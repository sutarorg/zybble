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
import { isPayoutEncryptionConfigured, isSupabaseConfigured } from "@/lib/env";
import { requireAdmin } from "@/lib/server/session";
import { CATEGORIES } from "@/lib/config/catalog";
import {
  computeCreatorPayoutBalance,
  type CreatorPayoutBalance,
  type PayoutRequestStatus,
} from "@/lib/server/payouts";
import type { PayoutDestinationMethod } from "@/lib/server/payout-crypto";

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
  payoutRequestsCount: number;
  pendingPayoutRequests: number;
  pendingPayoutPaise: number;
  paidOutPaise: number;
  outstandingCreatorPayablePaise: number;
}

export const getAdminOverview = cache(async (): Promise<AdminOverview> => {
  await requireAdmin();
  const empty: AdminOverview = {
    courses: 0, publishedCourses: 0, pendingCourses: 0, learners: 0, creators: 0, orders: 0,
    grossPaise: 0, commissionPaise: 0, creatorPayablePaise: 0, refundedPaise: 0,
    openReports: 0, routeTransfers: 0, failedTransfers: 0, settledPaise: 0,
    payoutRequestsCount: 0, pendingPayoutRequests: 0, pendingPayoutPaise: 0,
    paidOutPaise: 0, outstandingCreatorPayablePaise: 0,
  };
  if (!isSupabaseConfigured()) return empty;
  const service = createServiceClient();
  if (!service) return empty;

  const [
    courses, published, pending, learners, creators, orders,
    commissionLedger, creatorLedger, refunds, reports, transfers, failedTransfers, settlements,
    payoutRequestsRes, creatorAdjustmentsRes,
  ] = await Promise.all([
    service.from("courses").select("id", { count: "exact", head: true }),
    service.from("courses").select("id", { count: "exact", head: true }).eq("status", "published"),
    service.from("courses").select("id", { count: "exact", head: true }).eq("status", "pending"),
    service.from("profiles").select("id", { count: "exact", head: true }).eq("role", "learner"),
    service.from("creator_profiles").select("user_id", { count: "exact", head: true }),
    service.from("orders").select("id", { count: "exact", head: true }),
    service.from("ledger_entries").select("amount_paise").eq("kind", "commission"),
    service.from("ledger_entries").select("amount_paise").eq("kind", "sale").eq("account", "platform").eq("direction", "debit"),
    service.from("refunds").select("amount_paise").eq("status", "processed"),
    service.from("reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    service.from("route_transfers").select("id", { count: "exact", head: true }),
    service.from("route_transfers").select("id", { count: "exact", head: true }).eq("status", "failed"),
    service.from("route_settlements").select("amount_paise").eq("status", "processed"),
    service.from("payout_requests").select("amount_paise, status"),
    service
      .from("ledger_entries")
      .select("amount_paise")
      .eq("kind", "adjustment")
      .eq("direction", "debit")
      .not("account", "eq", "platform"),
  ]);

  const sum = (rows: { amount_paise: number }[] | null) =>
    (rows ?? []).reduce((total, row) => total + Number(row.amount_paise ?? 0), 0);

  const { data: sales } = await service
    .from("ledger_entries")
    .select("amount_paise")
    .eq("kind", "sale")
    .eq("direction", "credit")
    .not("account", "eq", "platform");

  const payoutRows = (payoutRequestsRes.data ?? []) as Array<{ amount_paise: number; status: string }>;
  const paidOutManualPaise = payoutRows
    .filter((row) => row.status === "paid")
    .reduce((total, row) => total + Number(row.amount_paise ?? 0), 0);
  const pendingRows = payoutRows.filter((row) => row.status === "requested" || row.status === "approved");
  const pendingPayoutPaise = pendingRows.reduce((total, row) => total + Number(row.amount_paise ?? 0), 0);
  const failedPayoutRequests = payoutRows.filter((row) => row.status === "failed").length;

  const legacySettledPaise = sum(settlements.data as { amount_paise: number }[]);
  const paidOutPaise = paidOutManualPaise + legacySettledPaise;
  const grossCreatorEarnedPaise = sum(sales as { amount_paise: number }[]);
  const creatorAdjustmentDebitPaise = sum(creatorAdjustmentsRes.data as { amount_paise: number }[]);
  const netCreatorPayablePaise = Math.max(0, grossCreatorEarnedPaise - creatorAdjustmentDebitPaise);
  const outstandingCreatorPayablePaise = Math.max(0, netCreatorPayablePaise - paidOutPaise);

  return {
    courses: courses.count ?? 0,
    publishedCourses: published.count ?? 0,
    pendingCourses: pending.count ?? 0,
    learners: learners.count ?? 0,
    creators: creators.count ?? 0,
    orders: orders.count ?? 0,
    grossPaise: sum(creatorLedger.data as { amount_paise: number }[]) + sum(commissionLedger.data as { amount_paise: number }[]),
    commissionPaise: sum(commissionLedger.data as { amount_paise: number }[]),
    creatorPayablePaise: netCreatorPayablePaise,
    refundedPaise: sum(refunds.data as { amount_paise: number }[]),
    openReports: reports.count ?? 0,
    routeTransfers: payoutRows.length + (transfers.count ?? 0),
    failedTransfers: failedPayoutRequests + (failedTransfers.count ?? 0),
    settledPaise: paidOutPaise,
    payoutRequestsCount: payoutRows.length,
    pendingPayoutRequests: pendingRows.length,
    pendingPayoutPaise,
    paidOutPaise,
    outstandingCreatorPayablePaise,
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
       creator_id,
       categories ( name ),
       profiles!courses_creator_id_fkey ( full_name ),
       creator_profiles ( display_name, username, route_account_status )`
    )
    .order("updated_at", { ascending: false })
    .limit(200);

  if (status && status !== "all") query = query.eq("status", status);
  const [{ data }, { data: destRows }] = await Promise.all([
    query,
    service.from("creator_payout_destinations").select("creator_id, method"),
  ]);

  const savedDestByCreator = new Map(
    ((destRows ?? []) as Array<{ creator_id: string; method: string }>).map((d) => [
      String(d.creator_id),
      String(d.method),
    ])
  );

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const category = (row.categories ?? null) as { name: string } | null;
    const creator = (row.creator_profiles ?? null) as
      | { display_name: string | null; username: string | null; route_account_status: string | null }
      | null;
    const creatorId = String(row.creator_id ?? "");
    const savedMethod = savedDestByCreator.get(creatorId) ?? null;
    return {
      id: String(row.id),
      slug: String(row.slug),
      title: String(row.title),
      status: String(row.status),
      categoryName: category?.name ?? null,
      creatorName: creator?.display_name ?? "Unknown creator",
      creatorUsername: creator?.username ?? null,
      routeStatus: savedMethod ? `details_saved:${savedMethod}` : "not_saved",
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
  const { data: destRow } = await service
    .from("creator_payout_destinations")
    .select("method, masked_destination")
    .eq("creator_id", String(record.creator_id))
    .maybeSingle();

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
    routeStatus: destRow ? `details_saved:${String((destRow as Record<string, unknown>).method)}` : "not_saved",
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

  const [{ data }, { data: destRows }] = await Promise.all([
    service
      .from("profiles")
      .select(
        `id, full_name, email, role, status, country_code, email_verified, created_at,
         creator_profiles ( route_account_status ),
         courses ( id ),
         entitlements ( id ),
         orders ( total_paise, status )`
      )
      .order("created_at", { ascending: false })
      .limit(300),
    service.from("creator_payout_destinations").select("creator_id, method, masked_destination"),
  ]);

  const destByCreator = new Map(
    ((destRows ?? []) as Array<{ creator_id: string; method: string; masked_destination: string }>).map((d) => [
      String(d.creator_id),
      `${d.method.toUpperCase()} (${d.masked_destination})`,
    ])
  );

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const orders = (row.orders ?? []) as Array<{ total_paise: number; status: string }>;
    const userId = String(row.id);
    return {
      id: userId,
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
      routeStatus: destByCreator.get(userId) ?? null,
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
/* Manual Creator Payouts                                                      */
/* -------------------------------------------------------------------------- */

export interface AdminPayoutRequestRow {
  id: string;
  publicId: string;
  creatorId: string;
  creatorName: string;
  creatorEmail: string;
  creatorUsername: string | null;
  amountPaise: number;
  currency: "INR";
  status: PayoutRequestStatus;
  destinationMethod: PayoutDestinationMethod;
  destinationMasked: string;
  destinationHolderMasked: string;
  destinationBankLabel: string | null;
  creatorNote: string | null;
  adminNote: string | null;
  rejectionReason: string | null;
  failureReason: string | null;
  paymentReference: string | null;
  paymentMethodUsed: string | null;
  confirmedAmountMatches: boolean;
  confirmedTransferSent: boolean;
  requestedAt: string;
  approvedAt: string | null;
  paidAt: string | null;
  rejectedAt: string | null;
  failedAt: string | null;
  cancelledAt: string | null;
  creatorBalance: CreatorPayoutBalance;
}

export interface AdminCreatorBalanceRow extends CreatorPayoutBalance {
  creatorId: string;
  creatorName: string;
  creatorEmail: string;
  creatorUsername: string | null;
  destinationMethod: PayoutDestinationMethod | null;
  destinationMasked: string | null;
  destinationHolderMasked: string | null;
  destinationBankLabel: string | null;
  destinationUpdatedAt: string | null;
}

export interface AdminPayoutAuditRow {
  id: string;
  payoutRequestId: string | null;
  creatorId: string;
  creatorName: string;
  actorEmail: string | null;
  action: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AdminPayoutsOverview {
  encryptionReady: boolean;
  requests: AdminPayoutRequestRow[];
  creatorBalances: AdminCreatorBalanceRow[];
  auditEvents: AdminPayoutAuditRow[];
  legacyTransfers: AdminTransferRow[];
}

export const getAdminPayouts = cache(async (): Promise<AdminPayoutsOverview> => {
  await requireAdmin();
  const empty: AdminPayoutsOverview = {
    encryptionReady: isPayoutEncryptionConfigured(),
    requests: [],
    creatorBalances: [],
    auditEvents: [],
    legacyTransfers: [],
  };
  if (!isSupabaseConfigured()) return empty;
  const service = createServiceClient();
  if (!service) return empty;

  const [
    { data: requestRows },
    { data: destRows },
    { data: creatorRows },
    { data: itemRows },
    { data: refundRows },
    { data: settlementRows },
    { data: auditRows },
    legacyTransfers,
  ] = await Promise.all([
    // NEVER select `destination_encrypted_payload` in list/page queries.
    service
      .from("payout_requests")
      .select(
        `id, public_id, creator_id, amount_paise, currency, status,
         destination_method, destination_masked, destination_holder_masked, destination_bank_label,
         creator_note, admin_note, rejection_reason, failure_reason,
         payment_reference, payment_method_used, confirmed_amount_matches, confirmed_transfer_sent,
         requested_at, approved_at, paid_at, rejected_at, failed_at, cancelled_at`
      )
      .order("requested_at", { ascending: false })
      .limit(300),
    // NEVER select `encrypted_payload` in list/page queries.
    service
      .from("creator_payout_destinations")
      .select("creator_id, method, masked_destination, masked_account_holder, bank_label, updated_at"),
    service
      .from("creator_profiles")
      .select("user_id, display_name, username, profiles!creator_profiles_user_id_fkey ( full_name, email )"),
    service
      .from("order_items")
      .select("order_id, creator_id, unit_price_paise, commission_paise, creator_share_paise, orders ( status )"),
    service
      .from("refunds")
      .select("order_id, amount_paise, status")
      .eq("status", "processed"),
    service
      .from("route_settlements")
      .select("creator_id, amount_paise, status")
      .eq("status", "processed"),
    service
      .from("payout_audit_events")
      .select("id, payout_request_id, creator_id, actor_id, action, metadata, created_at, profiles!payout_audit_events_actor_id_fkey ( email )")
      .order("created_at", { ascending: false })
      .limit(100),
    getAdminTransfers(),
  ]);

  const creatorMeta = new Map<
    string,
    { name: string; email: string; username: string | null }
  >();
  for (const row of (creatorRows ?? []) as Array<Record<string, unknown>>) {
    const id = String(row.user_id);
    const prof = (row.profiles ?? null) as { full_name?: string | null; email?: string | null } | null;
    creatorMeta.set(id, {
      name: String(row.display_name ?? prof?.full_name ?? "Creator"),
      email: String(prof?.email ?? ""),
      username: (row.username as string) ?? null,
    });
  }

  const destByCreator = new Map<
    string,
    {
      method: PayoutDestinationMethod;
      maskedDestination: string;
      maskedAccountHolder: string;
      bankLabel: string | null;
      updatedAt: string;
    }
  >();
  for (const row of (destRows ?? []) as Array<Record<string, unknown>>) {
    destByCreator.set(String(row.creator_id), {
      method: String(row.method) as PayoutDestinationMethod,
      maskedDestination: String(row.masked_destination ?? ""),
      maskedAccountHolder: String(row.masked_account_holder ?? ""),
      bankLabel: (row.bank_label as string) ?? null,
      updatedAt: String(row.updated_at),
    });
  }

  const capturedItemsByCreator = new Map<
    string,
    Array<{ orderId: string; unitPricePaise: number; commissionPaise: number; creatorSharePaise: number }>
  >();
  const itemByOrderId = new Map<
    string,
    { creatorId: string; unitPricePaise: number; creatorSharePaise: number }
  >();

  for (const row of (itemRows ?? []) as Array<Record<string, unknown>>) {
    const orderRel = row.orders as { status?: string } | Array<{ status?: string }> | null | undefined;
    const orderObj = Array.isArray(orderRel) ? orderRel[0] : orderRel;
    if (
      orderObj?.status &&
      orderObj.status !== "paid" &&
      orderObj.status !== "partially_refunded" &&
      orderObj.status !== "refunded"
    ) {
      continue;
    }
    const creatorId = String(row.creator_id);
    const orderId = String(row.order_id ?? "");
    const entry = {
      orderId,
      unitPricePaise: Number(row.unit_price_paise ?? 0),
      commissionPaise: Number(row.commission_paise ?? 0),
      creatorSharePaise: Number(row.creator_share_paise ?? 0),
    };
    const list = capturedItemsByCreator.get(creatorId) ?? [];
    list.push(entry);
    capturedItemsByCreator.set(creatorId, list);
    if (orderId) {
      itemByOrderId.set(orderId, {
        creatorId,
        unitPricePaise: entry.unitPricePaise,
        creatorSharePaise: entry.creatorSharePaise,
      });
    }
  }

  const refundsByCreator = new Map<
    string,
    Array<{ unitPricePaise: number; creatorSharePaise: number; refundAmountPaise: number }>
  >();
  for (const row of (refundRows ?? []) as Array<Record<string, unknown>>) {
    const item = itemByOrderId.get(String(row.order_id ?? ""));
    if (!item) continue;
    const list = refundsByCreator.get(item.creatorId) ?? [];
    list.push({
      unitPricePaise: item.unitPricePaise,
      creatorSharePaise: item.creatorSharePaise,
      refundAmountPaise: Number(row.amount_paise ?? 0),
    });
    refundsByCreator.set(item.creatorId, list);
  }

  const legacySettledByCreator = new Map<string, number>();
  for (const row of (settlementRows ?? []) as Array<Record<string, unknown>>) {
    const creatorId = String(row.creator_id ?? "");
    legacySettledByCreator.set(
      creatorId,
      (legacySettledByCreator.get(creatorId) ?? 0) + Number(row.amount_paise ?? 0)
    );
  }

  const requestsByCreator = new Map<string, Array<{ amountPaise: number; status: PayoutRequestStatus }>>();
  for (const row of (requestRows ?? []) as Array<Record<string, unknown>>) {
    const creatorId = String(row.creator_id);
    const list = requestsByCreator.get(creatorId) ?? [];
    list.push({
      amountPaise: Number(row.amount_paise ?? 0),
      status: String(row.status) as PayoutRequestStatus,
    });
    requestsByCreator.set(creatorId, list);
  }

  const allCreatorIds = new Set<string>([
    ...creatorMeta.keys(),
    ...destByCreator.keys(),
    ...capturedItemsByCreator.keys(),
    ...requestsByCreator.keys(),
  ]);

  const balanceByCreator = new Map<string, CreatorPayoutBalance>();
  for (const creatorId of allCreatorIds) {
    balanceByCreator.set(
      creatorId,
      computeCreatorPayoutBalance({
        capturedOrderItems: capturedItemsByCreator.get(creatorId) ?? [],
        processedRefunds: refundsByCreator.get(creatorId) ?? [],
        payoutRequests: requestsByCreator.get(creatorId) ?? [],
        legacySettledPaise: legacySettledByCreator.get(creatorId) ?? 0,
      })
    );
  }

  const emptyBalance: CreatorPayoutBalance = {
    grossPaise: 0,
    commissionPaise: 0,
    grossEarnedPaise: 0,
    refundPaise: 0,
    refundedCreatorSharePaise: 0,
    netEarnedPaise: 0,
    reservedPendingPaise: 0,
    paidOutPaise: 0,
    outstandingPayablePaise: 0,
    availablePaise: 0,
    negativeAdjustmentPaise: 0,
  };

  const requests: AdminPayoutRequestRow[] = ((requestRows ?? []) as Array<Record<string, unknown>>).map(
    (row) => {
      const creatorId = String(row.creator_id);
      const meta = creatorMeta.get(creatorId) ?? {
        name: "Creator",
        email: "",
        username: null,
      };
      return {
        id: String(row.id),
        publicId: String(row.public_id),
        creatorId,
        creatorName: meta.name,
        creatorEmail: meta.email,
        creatorUsername: meta.username,
        amountPaise: Number(row.amount_paise ?? 0),
        currency: "INR",
        status: String(row.status) as PayoutRequestStatus,
        destinationMethod: String(row.destination_method) as PayoutDestinationMethod,
        destinationMasked: String(row.destination_masked ?? ""),
        destinationHolderMasked: String(row.destination_holder_masked ?? ""),
        destinationBankLabel: (row.destination_bank_label as string) ?? null,
        creatorNote: (row.creator_note as string) ?? null,
        adminNote: (row.admin_note as string) ?? null,
        rejectionReason: (row.rejection_reason as string) ?? null,
        failureReason: (row.failure_reason as string) ?? null,
        paymentReference: (row.payment_reference as string) ?? null,
        paymentMethodUsed: (row.payment_method_used as string) ?? null,
        confirmedAmountMatches: Boolean(row.confirmed_amount_matches),
        confirmedTransferSent: Boolean(row.confirmed_transfer_sent),
        requestedAt: String(row.requested_at),
        approvedAt: (row.approved_at as string) ?? null,
        paidAt: (row.paid_at as string) ?? null,
        rejectedAt: (row.rejected_at as string) ?? null,
        failedAt: (row.failed_at as string) ?? null,
        cancelledAt: (row.cancelled_at as string) ?? null,
        creatorBalance: balanceByCreator.get(creatorId) ?? emptyBalance,
      };
    }
  );

  const creatorBalances: AdminCreatorBalanceRow[] = Array.from(allCreatorIds)
    .map((creatorId) => {
      const meta = creatorMeta.get(creatorId) ?? {
        name: "Creator",
        email: "",
        username: null,
      };
      const dest = destByCreator.get(creatorId) ?? null;
      const bal = balanceByCreator.get(creatorId) ?? emptyBalance;
      return {
        creatorId,
        creatorName: meta.name,
        creatorEmail: meta.email,
        creatorUsername: meta.username,
        destinationMethod: dest?.method ?? null,
        destinationMasked: dest?.maskedDestination ?? null,
        destinationHolderMasked: dest?.maskedAccountHolder ?? null,
        destinationBankLabel: dest?.bankLabel ?? null,
        destinationUpdatedAt: dest?.updatedAt ?? null,
        ...bal,
      };
    })
    .sort((a, b) => b.outstandingPayablePaise - a.outstandingPayablePaise || b.grossPaise - a.grossPaise);

  const auditEvents: AdminPayoutAuditRow[] = ((auditRows ?? []) as Array<Record<string, unknown>>).map((row) => {
    const creatorId = String(row.creator_id);
    const meta = creatorMeta.get(creatorId);
    const actor = (row.profiles ?? null) as { email?: string | null } | null;
    return {
      id: String(row.id),
      payoutRequestId: (row.payout_request_id as string) ?? null,
      creatorId,
      creatorName: meta?.name ?? "Creator",
      actorEmail: actor?.email ?? null,
      action: String(row.action),
      metadata: ((row.metadata ?? {}) as Record<string, unknown>),
      createdAt: String(row.created_at),
    };
  });

  return {
    encryptionReady: isPayoutEncryptionConfigured(),
    requests,
    creatorBalances,
    auditEvents,
    legacyTransfers,
  };
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
