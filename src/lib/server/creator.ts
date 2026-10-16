/**
 * Creator studio data.
 *
 * Creator-facing financial figures are derived from captured orders, processed
 * the immutable ledger, and manual creator payout requests (`payout_requests`).
 * Nothing here is generated, sampled or seeded: an empty ledger produces an
 * empty dashboard.
 */

import "server-only";
import { cache } from "react";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { requireCreator, requireSession, AuthorizationError } from "@/lib/server/session";
import { formatCommissionPercent } from "@/lib/money";
import {
  computeCreatorPayoutBalance,
  type CreatorPayoutBalance,
  type CreatorPayoutDestinationView,
  type CreatorPayoutRequestView,
  type PayoutRequestStatus,
} from "@/lib/server/payouts";
import type { PayoutDestinationMethod } from "@/lib/server/payout-crypto";

/** Planned default only — see `getMarketplaceCommissionBps`. */
const DEFAULT_COMMISSION_BPS = 1000;

export interface CreatorCourseSummary {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  thumbnailKey: string | null;
  pricePaise: number;
  status: string;
  level: string;
  language: string;
  categorySlug: string | null;
  categoryName: string | null;
  lessonsCount: number;
  durationMinutes: number;
  resourcesCount: number;
  studentsCount: number;
  rating: number;
  ratingsCount: number;
  updatedAt: string;
  submittedAt: string | null;
  rejectionReason: string | null;
  description: string;
  whatYouLearn: string[];
  requirements: string[];
  audience: string[];
  tags: string[];
  compareAtPaise: number;
  reviewHistory: Array<{ id: string; at: string; toStatus: string; actorRole: string; note: string | null }>;
}

function toStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

const CREATOR_COURSE_FIELDS = `
  id, slug, title, subtitle, description, what_you_learn, requirements, audience, tags,
  thumbnail_key, price_paise, compare_at_paise, status, level, language,
  duration_minutes, lessons_count, downloadable_resources, students_count, rating,
  ratings_count, updated_at, submitted_at, rejection_reason,
  categories ( slug, name ),
  course_review_events ( id, created_at, to_status, actor_role, note )
`;

function mapCreatorCourse(row: Record<string, unknown>): CreatorCourseSummary {
  const category = (row.categories ?? null) as { slug: string; name: string } | null;
  const events = ((row.course_review_events ?? []) as Array<Record<string, unknown>>).map((event) => ({
    id: String(event.id),
    at: String(event.created_at),
    toStatus: String(event.to_status),
    actorRole: String(event.actor_role),
    note: (event.note as string) ?? null,
  }));
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    subtitle: String(row.subtitle ?? ""),
    thumbnailKey: (row.thumbnail_key as string) ?? null,
    pricePaise: Number(row.price_paise ?? 0),
    status: String(row.status),
    level: String(row.level ?? "beginner"),
    language: String(row.language ?? "English"),
    categorySlug: category?.slug ?? null,
    categoryName: category?.name ?? null,
    lessonsCount: Number(row.lessons_count ?? 0),
    durationMinutes: Number(row.duration_minutes ?? 0),
    resourcesCount: Number(row.downloadable_resources ?? 0),
    studentsCount: Number(row.students_count ?? 0),
    rating: Number(row.rating ?? 0),
    ratingsCount: Number(row.ratings_count ?? 0),
    updatedAt: String(row.updated_at),
    submittedAt: (row.submitted_at as string) ?? null,
    rejectionReason: (row.rejection_reason as string) ?? null,
    description: (row.description as string) ?? "",
    whatYouLearn: toStringList(row.what_you_learn),
    requirements: toStringList(row.requirements),
    audience: toStringList(row.audience),
    tags: toStringList(row.tags),
    compareAtPaise: Number(row.compare_at_paise ?? 0),
    reviewHistory: events.sort((a, b) => b.at.localeCompare(a.at)),
  };
}

export const getCreatorCourses = cache(async (): Promise<CreatorCourseSummary[]> => {
  const session = await requireCreator();
  if (!isSupabaseConfigured()) return [];
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("courses")
    .select(CREATOR_COURSE_FIELDS)
    .eq("creator_id", session.id)
    .order("updated_at", { ascending: false });
  return ((data ?? []) as Array<Record<string, unknown>>).map(mapCreatorCourse);
});

export const getCreatorCourse = cache(async (courseId: string): Promise<CreatorCourseSummary | null> => {
  const session = await requireCreator();
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("courses")
    .select(CREATOR_COURSE_FIELDS)
    .eq("id", courseId)
    .eq("creator_id", session.id)
    .maybeSingle();
  return data ? mapCreatorCourse(data as Record<string, unknown>) : null;
});

export const getCreatorCurriculum = cache(async (courseId: string) => {
  await requireCreator();
  if (!isSupabaseConfigured()) return { sections: [], lessons: [] as Array<Record<string, unknown>> };
  const supabase = await createServerClient();
  const { data: sections } = await supabase
    .from("course_sections")
    .select(
      `id, title, sort_order,
       lessons ( id, title, description, kind, sort_order, duration_minutes, is_preview,
                 bunny_video_id, bunny_status, bunny_playback_ready, bunny_duration_seconds )`
    )
    .eq("course_id", courseId)
    .order("sort_order");
  const list = (sections ?? []) as Array<Record<string, unknown>>;
  const lessons = list.flatMap((section) => (section.lessons ?? []) as Array<Record<string, unknown>>);
  return { sections: list, lessons };
});

export const getCreatorResources = cache(async (courseId: string) => {
  await requireCreator();
  if (!isSupabaseConfigured()) return [];
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("course_resources")
    .select("id, title, file_name, content_type, size_bytes, created_at")
    .eq("course_id", courseId)
    .order("created_at");
  return (data ?? []) as Array<Record<string, unknown>>;
});

/* -------------------------------------------------------------------------- */
/* Money                                                                      */
/* -------------------------------------------------------------------------- */

interface TransferSummary {
  transferredPaise: number;
  settledPaise: number;
  reversedPaise: number;
  pendingPaise: number;
}

export interface CreatorCourseRevenueRow {
  courseId: string;
  courseTitle: string;
  salesCount: number;
  grossPaise: number;
  commissionPaise: number;
  creatorSharePaise: number;
}

export interface CreatorFinance extends TransferSummary, CreatorPayoutBalance {
  commissionBps: number;
  commissionPercentLabel: string;
  destination: CreatorPayoutDestinationView | null;
  payoutRequests: CreatorPayoutRequestView[];
  courseBreakdown: CreatorCourseRevenueRow[];
  /**
   * False when the captured-earnings aggregates could not be read, so the money
   * figures below are zeros of unknown meaning rather than a real ₹0 balance.
   * The studio says so out loud instead of rendering them as earnings.
   */
  earningsAvailable: boolean;
  /** Legacy Route transfer rows kept for historical records. */
  transfers: Array<{
    transferId: string;
    courseTitle: string;
    amountPaise: number;
    reversedPaise: number;
    status: string;
    createdAt: string;
    settlementStatus: string | null;
    settledAt: string | null;
  }>;
}


/**
 * The marketplace commission, in basis points.
 *
 * Server-configurable in `marketplace_settings`. 1000 bps = 10%. This is a
 * planned default only: it is snapshotted onto each order item at purchase time
 * so a later change never rewrites past earnings. Nothing in the browser may set
 * it — see `LAUNCH_BLOCKERS.md` for the unresolved commercial terms.
 */
export const getMarketplaceCommissionBps = cache(async (): Promise<number> => {
  if (!isSupabaseConfigured()) return DEFAULT_COMMISSION_BPS;
  const supabase = await createServerClient();
  const { data } = await supabase.from("marketplace_settings").select("commission_bps").eq("id", true).maybeSingle();
  const bps = Number(data?.commission_bps ?? DEFAULT_COMMISSION_BPS);
  return Number.isFinite(bps) && bps >= 0 && bps <= 10_000 ? bps : DEFAULT_COMMISSION_BPS;
});

export const getCreatorFinance = cache(async (): Promise<CreatorFinance> => {
  const session = await requireCreator();
  const empty: CreatorFinance = {
    grossPaise: 0,
    commissionPaise: 0,
    grossEarnedPaise: 0,
    netEarnedPaise: 0,
    reservedPendingPaise: 0,
    paidOutPaise: 0,
    outstandingPayablePaise: 0,
    availablePaise: 0,
    negativeAdjustmentPaise: 0,
    transferredPaise: 0,
    settledPaise: 0,
    reversedPaise: 0,
    pendingPaise: 0,
    commissionBps: 1000,
    commissionPercentLabel: "10",
    destination: null,
    payoutRequests: [],
    courseBreakdown: [],
    transfers: [],
    earningsAvailable: false,
  };
  if (!isSupabaseConfigured()) return empty;

  const supabase = await createServerClient();

  const [
    { data: totalsRow, error: totalsError },
    { data: breakdownRows, error: breakdownError },
    { data: destinationRow },
    { data: payoutRequestRows },
    { data: transfers },
    { data: settlements },
    { data: settings },
  ] = await Promise.all([
    // Captured earnings are aggregated in SQL (`creator_earnings_totals`,
    // `creator_earnings_by_course`, migration 20260101001100). Two reasons this
    // is not a `.from("order_items")` read: `orders_own_read` hides the order
    // from its creator, so an embedded `orders ( status )` join is always null
    // and any "only paid" filter on it silently counts abandoned checkouts as
    // earnings; and `.select()` stops at 1000 rows, which would quietly drop a
    // busy creator's oldest sales.
    supabase.rpc("creator_earnings_totals"),
    supabase.rpc("creator_earnings_by_course"),
    supabase
      .from("creator_payout_destinations")
      .select("method, masked_destination, masked_account_holder, bank_label, updated_at")
      .eq("creator_id", session.id)
      .maybeSingle(),
    supabase
      .from("payout_requests")
      .select(
        "id, public_id, creator_id, amount_paise, currency, status, destination_method, destination_masked, destination_holder_masked, destination_bank_label, creator_note, admin_note, rejection_reason, failure_reason, payment_reference, payment_method_used, requested_at, approved_at, paid_at, rejected_at, failed_at, cancelled_at"
      )
      .eq("creator_id", session.id)
      .order("requested_at", { ascending: false }),
    supabase
      .from("route_transfers")
      .select("transfer_id, order_item_id, amount_paise, reversed_paise, status, created_at")
      .eq("creator_id", session.id),
    supabase
      .from("route_settlements")
      .select("transfer_id, amount_paise, status, settled_at")
      .eq("creator_id", session.id),
    supabase.from("marketplace_settings").select("commission_bps").eq("id", true).maybeSingle(),
  ]);

  const commissionBps = Number(settings?.commission_bps ?? 1000);

  // `creator_earnings_totals` is an aggregate without GROUP BY, so it returns
  // exactly one row — zeros for a creator with no captured sales. A missing row
  // or an error means the aggregates could not be read at all (migration not
  // applied, for instance), which is reported instead of being shown as ₹0.
  const totals = asRows(totalsRow)[0] ?? null;
  const earningsAvailable = !totalsError && !breakdownError && totals !== null;
  if (totalsError || breakdownError) {
    console.error("creator earnings aggregates failed", {
      totals: totalsError?.message ?? null,
      breakdown: breakdownError?.message ?? null,
    });
  }

  const grossPaise = Number(totals?.gross_paise ?? 0);
  const commissionPaise = Number(totals?.commission_paise ?? 0);
  const creatorSharePaise = Number(totals?.creator_share_paise ?? 0);

  const courseBreakdown: CreatorCourseRevenueRow[] = asRows(breakdownRows).map((row) => ({
    courseId: String(row.course_id ?? "course"),
    courseTitle: String(row.course_title ?? "Course"),
    salesCount: Number(row.sales ?? 0),
    grossPaise: Number(row.gross_paise ?? 0),
    commissionPaise: Number(row.commission_paise ?? 0),
    creatorSharePaise: Number(row.creator_share_paise ?? 0),
  }));

  const transferRows = (transfers ?? []) as Array<Record<string, unknown>>;
  const settlementByTransfer = new Map(
    ((settlements ?? []) as Array<Record<string, unknown>>).map((row) => [
      String(row.transfer_id),
      { status: String(row.status), at: (row.settled_at as string) ?? null, amount: Number(row.amount_paise ?? 0) },
    ])
  );

  let legacySettledPaise = 0;
  let legacyPendingPaise = 0;
  let legacyReversedPaise = 0;
  for (const row of transferRows) {
    const status = String(row.status);
    const amount = Number(row.amount_paise ?? 0);
    const reversed = Number(row.reversed_paise ?? 0);
    const settlement = settlementByTransfer.get(String(row.transfer_id));
    if (settlement?.status === "processed") {
      legacySettledPaise += settlement.amount;
    } else if (status === "created" || status === "pending" || status === "processed") {
      legacyPendingPaise += Math.max(0, amount - reversed);
    }
    if (status === "reversed" || status === "partially_reversed") {
      legacyReversedPaise += reversed || amount;
    }
  }

  const payoutRequests: CreatorPayoutRequestView[] = ((payoutRequestRows ?? []) as Array<Record<string, unknown>>).map(
    (row) => ({
      id: String(row.id),
      publicId: String(row.public_id),
      creatorId: String(row.creator_id),
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
      requestedAt: String(row.requested_at),
      approvedAt: (row.approved_at as string) ?? null,
      paidAt: (row.paid_at as string) ?? null,
      rejectedAt: (row.rejected_at as string) ?? null,
      failedAt: (row.failed_at as string) ?? null,
      cancelledAt: (row.cancelled_at as string) ?? null,
    })
  );

  const balance = computeCreatorPayoutBalance({
    // The lifetime sums arrive pre-aggregated from SQL. They are passed as one
    // row so `computeCreatorPayoutBalance` still runs its integer-paise
    // assertions over the exact figures the studio displays.
    capturedOrderItems: earningsAvailable
      ? [{ unitPricePaise: grossPaise, commissionPaise, creatorSharePaise }]
      : [],
    payoutRequests: payoutRequests.map((req) => ({
      amountPaise: req.amountPaise,
      status: req.status,
    })),
    legacySettledPaise,
    legacyPendingPaise,
    legacyReversedPaise,
  });

  const destination: CreatorPayoutDestinationView | null = destinationRow
    ? {
        method: String((destinationRow as Record<string, unknown>).method) as PayoutDestinationMethod,
        maskedDestination: String((destinationRow as Record<string, unknown>).masked_destination ?? ""),
        maskedAccountHolder: String((destinationRow as Record<string, unknown>).masked_account_holder ?? ""),
        bankLabel: ((destinationRow as Record<string, unknown>).bank_label as string) ?? null,
        statusLabel: "Details saved · Awaiting payout",
        updatedAt: String((destinationRow as Record<string, unknown>).updated_at ?? new Date().toISOString()),
      }
    : null;

  return {
    ...balance,
    transferredPaise: balance.paidOutPaise,
    settledPaise: balance.paidOutPaise,
    pendingPaise: balance.reservedPendingPaise,
    reversedPaise: legacyReversedPaise,
    commissionBps,
    commissionPercentLabel: formatCommissionPercent(commissionBps),
    destination,
    payoutRequests,
    courseBreakdown,
    earningsAvailable,
    transfers: transferRows.map((row) => {
      const settlement = settlementByTransfer.get(String(row.transfer_id));
      return {
        transferId: String(row.transfer_id ?? ""),
        courseTitle: String(row.course_title ?? "Course"),
        amountPaise: Number(row.amount_paise ?? 0),
        reversedPaise: Number(row.reversed_paise ?? 0),
        status: String(row.status),
        createdAt: String(row.created_at),
        settlementStatus: settlement?.status ?? null,
        settledAt: settlement?.at ?? null,
      };
    }),
  };
});

/* -------------------------------------------------------------------------- */
/* Analytics                                                                  */
/* -------------------------------------------------------------------------- */

export interface CreatorAnalyticsPoint {
  /** `12 Oct` — the UTC day this bucket covers. */
  label: string;
  /** The creator's share of that day's captured sales, in integer paise. */
  revenuePaise: number;
  /** Captured sales that day. */
  sales: number;
}

/**
 * Revenue trend for the creator dashboard — money, and only money that was
 * actually captured.
 *
 * The daily buckets come from `creator_earnings_daily`
 * (migration `20260101001100_creator_earnings_aggregates.sql`), which joins
 * `orders` inside SQL. It has to: `orders_own_read` is `user_id = auth.uid()`,
 * so a creator reading their own `order_items` gets a null for the embedded
 * order and cannot tell a captured sale from an abandoned checkout.
 *
 * Reach — impressions, views, watch time and the enrollments they produced —
 * lives in {@link getCreatorEngagement}, which is what `/creator/analytics`
 * renders. The two are deliberately not mixed here.
 *
 * Every day of the window is returned, including empty ones: a flat zero line
 * is the truth, while a gap would be indistinguishable from missing data.
 */
export const getCreatorAnalytics = cache(async (range: AnalyticsRange = "30d") => {
  const session = await requireCreator();
  const days = RANGE_DAYS[range];
  const empty = {
    points: [] as CreatorAnalyticsPoint[],
    totals: { revenuePaise: 0, sales: 0, courses: 0, students: 0 },
  };
  if (!isSupabaseConfigured()) return empty;

  const until = new Date();
  const since = new Date(until.getTime() - days * 86_400_000);
  const supabase = await createServerClient();

  const [{ data: courseRows }, { data: dailyRows, error }] = await Promise.all([
    supabase.from("courses").select("id, students_count").eq("creator_id", session.id),
    supabase.rpc("creator_earnings_daily", {
      p_since: since.toISOString(),
      p_until: until.toISOString(),
    }),
  ]);

  if (error) {
    // Logged, not thrown: the rest of the dashboard still renders, and the
    // revenue panel falls back to its honest "no sales in this period" state.
    console.error("creator_earnings_daily failed", error.message);
  }

  const courses = (courseRows ?? []) as Array<{ id: string; students_count: number }>;
  const byDay = new Map(
    asRows(dailyRows).map((row) => [
      dayKey(String(row.day)),
      { revenuePaise: Number(row.creator_share_paise ?? 0), sales: Number(row.sales ?? 0) },
    ])
  );

  const points: CreatorAnalyticsPoint[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const key = dayKey(new Date(until.getTime() - i * 86_400_000));
    const row = byDay.get(key);
    points.push({
      label: dayLabel(key),
      revenuePaise: row?.revenuePaise ?? 0,
      sales: row?.sales ?? 0,
    });
  }

  return {
    points,
    totals: {
      revenuePaise: points.reduce((sum, point) => sum + point.revenuePaise, 0),
      sales: points.reduce((sum, point) => sum + point.sales, 0),
      courses: courses.length,
      students: courses.reduce((sum, course) => sum + Number(course.students_count ?? 0), 0),
    },
  };
});

/** Supabase `.in()` needs an array of ids, so this never joins them into a CSV. */
function courseIdsOf(courses: unknown): string[] {
  return ((courses ?? []) as Array<{ id?: string | null }>)
    .map((row) => row.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

/**
 * A `returns table` RPC arrives as an array of rows. PostgREST can also hand
 * back a single object for a one-row composite, so both are normalised here
 * rather than at every call site.
 */
function asRows(data: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(data)) return data as Array<Record<string, unknown>>;
  if (data && typeof data === "object") return [data as Record<string, unknown>];
  return [];
}

/* -------------------------------------------------------------------------- */
/* Studio preferences                                                          */
/* -------------------------------------------------------------------------- */

export interface CreatorStudioPreferences {
  emailNewEnrollment: boolean;
  emailNewReview: boolean;
  emailModeration: boolean;
  emailPayoutUpdates: boolean;
  notifyInApp: boolean;
  defaultCourseLanguage: string;
  defaultCourseLevel: "beginner" | "intermediate" | "advanced";
  defaultPricePaise: number;
  updatedAt: string | null;
}

/** The schema's column defaults, used until a creator saves their own. */
export const STUDIO_PREFERENCE_DEFAULTS: CreatorStudioPreferences = {
  emailNewEnrollment: true,
  emailNewReview: true,
  emailModeration: true,
  emailPayoutUpdates: true,
  notifyInApp: true,
  defaultCourseLanguage: "English",
  defaultCourseLevel: "beginner",
  defaultPricePaise: 0,
  updatedAt: null,
};

const LEVELS = ["beginner", "intermediate", "advanced"] as const;

/**
 * Studio settings for the signed-in creator.
 *
 * Readable under RLS because the row belongs to the caller; a creator with no
 * row yet gets the schema defaults rather than an empty form, so the settings
 * page shows the behaviour the platform actually applies.
 */
export const getCreatorStudioPreferences = cache(async (): Promise<CreatorStudioPreferences> => {
  const session = await requireCreator();
  if (!isSupabaseConfigured()) return STUDIO_PREFERENCE_DEFAULTS;

  const supabase = await createServerClient();
  const { data } = await supabase
    .from("creator_studio_preferences")
    .select("*")
    .eq("user_id", session.id)
    .maybeSingle();
  if (!data) return STUDIO_PREFERENCE_DEFAULTS;

  const row = data as Record<string, unknown>;
  const level = String(row.default_course_level ?? "beginner");
  const price = Number(row.default_price_paise ?? 0);

  return {
    emailNewEnrollment: Boolean(row.email_new_enrollment ?? true),
    emailNewReview: Boolean(row.email_new_review ?? true),
    emailModeration: Boolean(row.email_moderation ?? true),
    emailPayoutUpdates: Boolean(row.email_payout_updates ?? true),
    notifyInApp: Boolean(row.notify_in_app ?? true),
    defaultCourseLanguage: String(row.default_course_language ?? "English"),
    defaultCourseLevel: (LEVELS as readonly string[]).includes(level)
      ? (level as CreatorStudioPreferences["defaultCourseLevel"])
      : "beginner",
    defaultPricePaise: Number.isFinite(price) && price >= 0 ? Math.round(price) : 0,
    updatedAt: (row.updated_at as string) ?? null,
  };
});

/* -------------------------------------------------------------------------- */
/* Catalog engagement (creator analytics)                                      */
/* -------------------------------------------------------------------------- */

export type AnalyticsRange = "7d" | "30d" | "90d" | "1y";

const RANGE_DAYS: Record<AnalyticsRange, number> = { "7d": 7, "30d": 30, "90d": 90, "1y": 365 };

/** Anything unrecognised falls back to 30 days — never to a wider window. */
export function parseAnalyticsRange(value: unknown): AnalyticsRange {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "7d" || raw === "90d" || raw === "1y" ? raw : "30d";
}

export interface CreatorEngagementPoint {
  /** `2026-10-12` (UTC day, so server and client markup agree). */
  label: string;
  impressions: number;
  views: number;
  watchSeconds: number;
  enrollments: number;
}

export interface CreatorCourseEngagement {
  courseId: string;
  title: string;
  slug: string;
  status: string;
  impressions: number;
  views: number;
  /** Distinct signed-in learners who opened the course page. */
  viewers: number;
  watchSeconds: number;
  watchSessions: number;
  avgWatchSeconds: number;
  enrollments: number;
  /** All-time enrolled learners, from the denormalised course counter. */
  students: number;
}

export interface CreatorEngagementTotals {
  impressions: number;
  views: number;
  viewers: number;
  watchSeconds: number;
  watchSessions: number;
  /** Whole minutes watched, for display. */
  watchMinutes: number;
  /** watchSeconds ÷ watchSessions — how long one sitting lasts. */
  avgWatchSeconds: number;
  enrollments: number;
  courses: number;
  students: number;
}

export interface CreatorEngagement {
  range: AnalyticsRange;
  days: number;
  /** False when the platform service key is missing, so the page says so instead of showing zeros. */
  available: boolean;
  totals: CreatorEngagementTotals;
  /** Same totals for the immediately preceding window, for the delta chips. */
  previous: CreatorEngagementTotals;
  points: CreatorEngagementPoint[];
  byCourse: CreatorCourseEngagement[];
}

function emptyEngagementTotals(courses = 0, students = 0): CreatorEngagementTotals {
  return {
    impressions: 0,
    views: 0,
    viewers: 0,
    watchSeconds: 0,
    watchSessions: 0,
    watchMinutes: 0,
    avgWatchSeconds: 0,
    enrollments: 0,
    courses,
    students,
  };
}

function dayKey(iso: string | Date): string {
  return (typeof iso === "string" ? iso : iso.toISOString()).slice(0, 10);
}

/** `2026-10-12` → `12 Oct`, rendered in UTC because the key carries no zone. */
function dayLabel(key: string): string {
  const date = new Date(`${key}T00:00:00.000Z`);
  return Number.isNaN(date.getTime())
    ? key
    : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" });
}

interface DailyRow {
  day: string;
  impressions: number;
  views: number;
  watch_seconds: number;
  enrollments: number;
}

interface CourseRow {
  course_id: string;
  impressions: number;
  views: number;
  viewers: number;
  watch_seconds: number;
  watch_sessions: number;
  enrollments: number;
}

/**
 * Reach and watch time for the signed-in creator's catalog.
 *
 * The course ids come from an RLS-scoped read, so the creator can only ever
 * aggregate their own courses; the aggregation itself runs through two
 * `service_role`-only SQL functions because `course_events` is deliberately
 * granted to no browser role and `entitlements` are readable only by their
 * owner. No actor id ever leaves the database.
 *
 * A window with no events still returns a point per day with zeros: a flat line
 * is the truth, and an empty array would make "no reach" indistinguishable from
 * "no data".
 */
export const getCreatorEngagement = cache(async (
  range: AnalyticsRange = "30d"
): Promise<CreatorEngagement> => {
  const session = await requireCreator();
  const days = RANGE_DAYS[range];
  const unavailable: CreatorEngagement = {
    range,
    days,
    available: false,
    totals: emptyEngagementTotals(),
    previous: emptyEngagementTotals(),
    points: [],
    byCourse: [],
  };

  if (!isSupabaseConfigured()) return unavailable;

  const supabase = await createServerClient();
  const { data: courseRows } = await supabase
    .from("courses")
    .select("id, title, slug, status, students_count")
    .eq("creator_id", session.id);

  const courses = (courseRows ?? []) as Array<{
    id: string;
    title: string;
    slug: string;
    status: string;
    students_count: number;
  }>;
  const students = courses.reduce((total, course) => total + Number(course.students_count ?? 0), 0);

  if (courses.length === 0) {
    return { ...unavailable, available: true, totals: emptyEngagementTotals(0, 0) };
  }

  const service = createServiceClient();
  if (!service) return { ...unavailable, totals: emptyEngagementTotals(courses.length, students) };

  const courseIds = courses.map((course) => course.id);
  const until = new Date();
  const since = new Date(until.getTime() - days * 86_400_000);
  const previousSince = new Date(since.getTime() - days * 86_400_000);

  const [{ data: daily }, { data: perCourse }, { data: previousDaily }] = await Promise.all([
    service.rpc("creator_engagement_daily", {
      p_course_ids: courseIds,
      p_since: since.toISOString(),
      p_until: until.toISOString(),
    }),
    service.rpc("creator_engagement_by_course", {
      p_course_ids: courseIds,
      p_since: since.toISOString(),
      p_until: until.toISOString(),
    }),
    service.rpc("creator_engagement_daily", {
      p_course_ids: courseIds,
      p_since: previousSince.toISOString(),
      p_until: since.toISOString(),
    }),
  ]);

  const dailyRows = ((daily ?? []) as DailyRow[]).map((row) => ({
    day: dayKey(String(row.day)),
    impressions: Number(row.impressions ?? 0),
    views: Number(row.views ?? 0),
    watchSeconds: Number(row.watch_seconds ?? 0),
    enrollments: Number(row.enrollments ?? 0),
  }));
  const byDay = new Map(dailyRows.map((row) => [row.day, row]));

  const points: CreatorEngagementPoint[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const key = dayKey(new Date(until.getTime() - i * 86_400_000));
    const row = byDay.get(key);
    points.push({
      label: dayLabel(key),
      impressions: row?.impressions ?? 0,
      views: row?.views ?? 0,
      watchSeconds: row?.watchSeconds ?? 0,
      enrollments: row?.enrollments ?? 0,
    });
  }

  const totalsFrom = (rows: Array<{ impressions: number; views: number; watchSeconds: number; enrollments: number }>) => {
    const summed = rows.reduce(
      (acc, row) => ({
        impressions: acc.impressions + row.impressions,
        views: acc.views + row.views,
        watchSeconds: acc.watchSeconds + row.watchSeconds,
        enrollments: acc.enrollments + row.enrollments,
      }),
      { impressions: 0, views: 0, watchSeconds: 0, enrollments: 0 }
    );
    return summed;
  };

  const courseRowsTyped = ((perCourse ?? []) as CourseRow[]).map((row) => ({
    courseId: String(row.course_id),
    impressions: Number(row.impressions ?? 0),
    views: Number(row.views ?? 0),
    viewers: Number(row.viewers ?? 0),
    watchSeconds: Number(row.watch_seconds ?? 0),
    watchSessions: Number(row.watch_sessions ?? 0),
    enrollments: Number(row.enrollments ?? 0),
  }));

  const windowTotals = totalsFrom(dailyRows.map((row) => ({
    impressions: row.impressions,
    views: row.views,
    watchSeconds: row.watchSeconds,
    enrollments: row.enrollments,
  })));
  const previousTotals = totalsFrom(((previousDaily ?? []) as DailyRow[]).map((row) => ({
    impressions: Number(row.impressions ?? 0),
    views: Number(row.views ?? 0),
    watchSeconds: Number(row.watch_seconds ?? 0),
    enrollments: Number(row.enrollments ?? 0),
  })));

  const watchSessions = courseRowsTyped.reduce((total, row) => total + row.watchSessions, 0);
  const viewers = courseRowsTyped.reduce((total, row) => total + row.viewers, 0);

  const toTotals = (
    summed: { impressions: number; views: number; watchSeconds: number; enrollments: number },
    sessions: number,
    distinctViewers: number
  ): CreatorEngagementTotals => ({
    impressions: summed.impressions,
    views: summed.views,
    viewers: distinctViewers,
    watchSeconds: summed.watchSeconds,
    watchSessions: sessions,
    watchMinutes: Math.round(summed.watchSeconds / 60),
    avgWatchSeconds: sessions > 0 ? Math.round(summed.watchSeconds / sessions) : 0,
    enrollments: summed.enrollments,
    courses: courses.length,
    students,
  });

  const byCourse: CreatorCourseEngagement[] = courses
    .map((course) => {
      const stats = courseRowsTyped.find((row) => row.courseId === course.id);
      const sessions = stats?.watchSessions ?? 0;
      const watchSeconds = stats?.watchSeconds ?? 0;
      return {
        courseId: course.id,
        title: course.title,
        slug: course.slug,
        status: course.status,
        impressions: stats?.impressions ?? 0,
        views: stats?.views ?? 0,
        viewers: stats?.viewers ?? 0,
        watchSeconds,
        watchSessions: sessions,
        avgWatchSeconds: sessions > 0 ? Math.round(watchSeconds / sessions) : 0,
        enrollments: stats?.enrollments ?? 0,
        students: Number(course.students_count ?? 0),
      };
    })
    .sort((a, b) => b.views - a.views || b.impressions - a.impressions);

  return {
    range,
    days,
    available: true,
    totals: toTotals(windowTotals, watchSessions, viewers),
    previous: toTotals(previousTotals, 0, 0),
    points,
    byCourse,
  };
});

/* -------------------------------------------------------------------------- */
/* Earnings history                                                            */
/* -------------------------------------------------------------------------- */

export interface CreatorEarningsPoint {
  /** `2026-10` — the month this bucket covers. */
  key: string;
  label: string;
  grossPaise: number;
  commissionPaise: number;
  creatorSharePaise: number;
  sales: number;
}

/** `2026-10` → `Oct 2026`. */
function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return key;
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Month-by-month creator earnings for the last `months` calendar months
 * (including the current, still-open one).
 *
 * Built from the same captured `order_items` the finance figures come from, so
 * the chart and the totals can never disagree. Commission is the per-order
 * snapshot, not today's rate.
 */
export const getCreatorEarningsSeries = cache(async (months = 6): Promise<CreatorEarningsPoint[]> => {
  // The gate, and the identity: `creator_earnings_monthly` scopes itself to
  // `auth.uid()`, so this session is what makes the numbers this creator's.
  await requireCreator();
  const buckets: CreatorEarningsPoint[] = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i -= 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = date.toISOString().slice(0, 7);
    buckets.push({
      key,
      label: monthLabel(key),
      grossPaise: 0,
      commissionPaise: 0,
      creatorSharePaise: 0,
      sales: 0,
    });
  }

  if (!isSupabaseConfigured()) return buckets;

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("creator_earnings_monthly", { p_months: months });
  if (error) {
    // Logged, not thrown: every bucket stays at zero and the earnings page says
    // the figures could not be read rather than showing a chart that looks real.
    console.error("creator_earnings_monthly failed", error.message);
    return buckets;
  }

  const index = new Map(buckets.map((bucket, i) => [bucket.key, i]));
  for (const row of asRows(data)) {
    const i = index.get(String(row.month_key ?? ""));
    if (i === undefined) continue;
    buckets[i].grossPaise = Number(row.gross_paise ?? 0);
    buckets[i].commissionPaise = Number(row.commission_paise ?? 0);
    buckets[i].creatorSharePaise = Number(row.creator_share_paise ?? 0);
    buckets[i].sales = Number(row.sales ?? 0);
  }

  return buckets;
});

/* -------------------------------------------------------------------------- */
/* Reviews and notifications                                                   */
/* -------------------------------------------------------------------------- */

export const getCreatorReviews = cache(async () => {
  const session = await requireCreator();
  if (!isSupabaseConfigured()) return [];
  const supabase = await createServerClient();
  const courseIds = courseIdsOf(await getCreatorCourses());
  if (courseIds.length === 0) return [];
  const { data } = await supabase
    .from("reviews")
    .select("id, rating, title, body, created_at, published, course_id, courses ( title ), profiles ( full_name )")
    .in("course_id", courseIds)
    .order("created_at", { ascending: false })
    .limit(100);
  void session;
  return (data ?? []) as Array<Record<string, unknown>>;
});

export const getCreatorNotifications = cache(async () => {
  const session = await requireSession();
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

/* -------------------------------------------------------------------------- */
/* Payout destination onboarding state                                         */
/* -------------------------------------------------------------------------- */

export interface RouteOnboardingState {
  hasAccount: boolean;
  accountId: string | null;
  status: string | null;
  settlementVerified: boolean;
  /** Always `null` for course creation/publication: payout details are only required to request a payout. */
  blockedReason: string | null;
  checkedAt: string | null;
  destination: CreatorPayoutDestinationView | null;
}

/**
 * Reads the creator's saved manual payout destination state (masked only).
 *
 * Course creation, pricing, review submission, and publication are never
 * blocked by payout destination setup. Payout details are required only when
 * the creator requests a payout.
 */
export async function getRouteOnboardingState(): Promise<RouteOnboardingState> {
  const session = await requireCreator();
  if (!isSupabaseConfigured()) {
    return {
      hasAccount: false,
      accountId: null,
      status: null,
      settlementVerified: false,
      blockedReason: null,
      checkedAt: null,
      destination: null,
    };
  }
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("creator_payout_destinations")
    .select("method, masked_destination, masked_account_holder, bank_label, updated_at")
    .eq("creator_id", session.id)
    .maybeSingle();

  if (!data) {
    return {
      hasAccount: false,
      accountId: null,
      status: "not_saved",
      settlementVerified: false,
      blockedReason: null,
      checkedAt: null,
      destination: null,
    };
  }

  const row = data as Record<string, unknown>;
  const destination: CreatorPayoutDestinationView = {
    method: String(row.method) as PayoutDestinationMethod,
    maskedDestination: String(row.masked_destination ?? ""),
    maskedAccountHolder: String(row.masked_account_holder ?? ""),
    bankLabel: (row.bank_label as string) ?? null,
    statusLabel: "Details saved · Awaiting payout",
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };

  return {
    hasAccount: true,
    accountId: destination.maskedDestination,
    status: "details_saved",
    settlementVerified: true,
    blockedReason: null,
    checkedAt: destination.updatedAt,
    destination,
  };
}

export const getPayoutOnboardingState = getRouteOnboardingState;

export function assertCreatorOwnsCourse(courseId: string, creatorId: string, courseOwnerId: unknown): void {
  if (courseOwnerId !== creatorId) {
    throw new AuthorizationError("You do not own this course", 403);
  }
  void courseId;
}
