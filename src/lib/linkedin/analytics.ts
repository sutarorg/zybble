import { linkedinRequest } from "./client";
import {
  analyticsDateRange,
  analyticsEntityParam,
  CORE_METRICS,
  DAILY_UNSUPPORTED_METRICS,
  LINKEDIN_ENDPOINTS,
} from "./config";

/**
 * Member post analytics (`memberCreatorPostAnalytics`).
 *
 * Requires the `r_member_postAnalytics` scope, which LinkedIn grants only with
 * Community Management API approval. When the scope is absent the caller must
 * surface a capability-gated state — it must never substitute invented numbers.
 *
 * Documented constraints honoured here:
 *  * DAILY aggregation is unavailable for MEMBERS_REACHED, LINK_CLICKS,
 *    FOLLOWER_GAINED_FROM_CONTENT and PROFILE_VIEW_FROM_CONTENT;
 *  * daily *impression* breakdown is not offered for a single post, so per-post
 *    impressions are fetched as a TOTAL and account-level daily series come from
 *    the `me` finder instead;
 *  * `entity` must be wrapped by type: (share:…) or (ugc:…).
 */

export type MetricType = (typeof CORE_METRICS)[number];

export type AnalyticsElement = {
  count: number;
  metricType: MetricType;
  /** Inclusive start of the bucket, as reported by LinkedIn. */
  startDate?: string;
  endDate?: string;
};

type RawElement = {
  count: number;
  metricType: string | { [key: string]: string };
  dateRange?: {
    start?: { year: number; month: number; day: number };
    end?: { year: number; month: number; day: number };
  };
  targetEntity?: Record<string, string>;
};

function normaliseMetricType(value: RawElement["metricType"]): MetricType {
  if (typeof value === "string") return value as MetricType;
  const values = Object.values(value);
  return (values[0] as MetricType) ?? "IMPRESSION";
}

function isoDate(parts?: { year: number; month: number; day: number }): string | undefined {
  if (!parts) return undefined;
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function normaliseResponse(payload: { elements?: RawElement[] }): AnalyticsElement[] {
  return (payload.elements ?? []).map((element) => ({
    count: element.count,
    metricType: normaliseMetricType(element.metricType),
    startDate: isoDate(element.dateRange?.start),
    endDate: isoDate(element.dateRange?.end),
  }));
}

/** Per-post totals for one metric. */
export async function fetchPostMetricTotal(
  accessToken: string,
  postUrn: string,
  metric: MetricType,
  range?: { start: Date; end: Date },
): Promise<number | null> {
  const params = new URLSearchParams({
    q: "entity",
    entity: analyticsEntityParam(postUrn),
    queryType: metric,
    aggregation: "TOTAL",
  });

  if (range) {
    params.set("dateRange", analyticsDateRange(range.start, range.end));
  }

  const payload = await linkedinRequest<{ elements?: RawElement[] }>(
    LINKEDIN_ENDPOINTS.memberPostAnalytics,
    { accessToken, query: params.toString() },
  );

  const elements = normaliseResponse(payload);
  if (elements.length === 0) return null;

  return elements.reduce((total, element) => total + element.count, 0) || elements[0]!.count;
}

/** Per-post daily breakdown for one metric (unsupported metrics return []). */
export async function fetchPostMetricDaily(
  accessToken: string,
  postUrn: string,
  metric: MetricType,
  range: { start: Date; end: Date },
): Promise<AnalyticsElement[]> {
  if ((DAILY_UNSUPPORTED_METRICS as readonly string[]).includes(metric)) {
    return [];
  }

  const params = new URLSearchParams({
    q: "entity",
    entity: analyticsEntityParam(postUrn),
    queryType: metric,
    aggregation: "DAILY",
    dateRange: analyticsDateRange(range.start, range.end),
  });

  const payload = await linkedinRequest<{ elements?: RawElement[] }>(
    LINKEDIN_ENDPOINTS.memberPostAnalytics,
    { accessToken, query: params.toString() },
  );

  return normaliseResponse(payload);
}

export type PostMetricsSnapshot = {
  impressions: number | null;
  membersReached: number | null;
  reactions: number | null;
  comments: number | null;
  reposts: number | null;
};

/**
 * Fetch every core metric for one post. A single metric failing does not void
 * the rest; unavailable metrics stay null so the UI can render "—".
 */
export async function fetchPostMetrics(
  accessToken: string,
  postUrn: string,
  range?: { start: Date; end: Date },
): Promise<PostMetricsSnapshot> {
  const [impressions, membersReached, reactions, comments, reposts] = await Promise.all([
    fetchPostMetricTotal(accessToken, postUrn, "IMPRESSION", range),
    fetchPostMetricTotal(accessToken, postUrn, "MEMBERS_REACHED", range).catch(() => null),
    fetchPostMetricTotal(accessToken, postUrn, "REACTION", range),
    fetchPostMetricTotal(accessToken, postUrn, "COMMENT", range),
    fetchPostMetricTotal(accessToken, postUrn, "RESHARE", range),
  ]);

  return { impressions, membersReached, reactions, comments, reposts };
}

/** Account-wide daily series for one metric (the `me` finder). */
export async function fetchAccountMetricDaily(
  accessToken: string,
  metric: MetricType,
  range: { start: Date; end: Date },
): Promise<AnalyticsElement[]> {
  if ((DAILY_UNSUPPORTED_METRICS as readonly string[]).includes(metric)) {
    return [];
  }

  const params = new URLSearchParams({
    q: "me",
    queryType: metric,
    aggregation: "DAILY",
    dateRange: analyticsDateRange(range.start, range.end),
  });

  const payload = await linkedinRequest<{ elements?: RawElement[] }>(
    LINKEDIN_ENDPOINTS.memberPostAnalytics,
    { accessToken, query: params.toString() },
  );

  return normaliseResponse(payload);
}

export function engagementRate(metrics: {
  impressions: number | null;
  reactions: number | null;
  comments: number | null;
  reposts: number | null;
}): number | null {
  const { impressions, reactions, comments, reposts } = metrics;

  if (impressions === null || impressions <= 0) return null;

  const interactions = (reactions ?? 0) + (comments ?? 0) + (reposts ?? 0);
  return Number((interactions / impressions).toFixed(4));
}
