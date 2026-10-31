/**
 * Zybble dashboard data contracts.
 *
 * These are the shapes the API returns and the UI renders. They are declared
 * here (and mirrored by the server read models in `src/features/**`) so a change
 * on either side is a compile error rather than a blank screen.
 *
 * Every field is something the backend can actually produce today: no
 * placeholder metrics, no assumed plan, no invented LinkedIn capability.
 */

/* ---------------------------------- plans --------------------------------- */

export type PlanId = "free" | "pro";

export interface PlanEntitlements {
  plan: PlanId;
  maxLinkedInAccounts: number; // free: 1 · pro: 5
  monthlyScheduleLimit: number | null; // free: 10 · pro: null (unlimited)
  analyticsHistoryDays: number; // free: 7 · pro: 365
  bestTimeInsights: boolean;
  teamCollaboration: boolean;
}

/* --------------------------------- account -------------------------------- */

export interface UserProfile {
  id: string;
  name: string | null;
  email: string;
  timezone: string; // IANA, e.g. "Europe/London"
  emailVerified: boolean;
  onboardingCompletedAt: string | null;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan: PlanId;
  seats: number; // Pro: billed seats; Free: 1
  timezone: string;
  createdAt: string; // ISO
}

export interface SessionState {
  user: { id: string; email: string; emailVerified: boolean };
  profile: UserProfile;
  workspaces: Workspace[];
  requiresOnboarding: boolean;
  capabilities: {
    supabaseConfigured: boolean;
    linkedinConfigured: boolean;
    analyticsScopeEnabled: boolean;
  };
}

/* -------------------------------- LinkedIn -------------------------------- */

export type LinkedInAccountStatus = "active" | "expired" | "revoked" | "reauth_required";

export interface LinkedInAccount {
  id: string;
  kind: "member" | "organization";
  displayName: string | null;
  avatarUrl: string | null;
  /** LinkedIn URN, e.g. urn:li:person:xxx — used as publish target. */
  profileUrn: string;
  status: LinkedInAccountStatus;
  scopes: string[]; // scopes LinkedIn actually granted
  canPublish: boolean;
  canReadAnalytics: boolean;
  tokenExpiresAt: string | null;
  lastVerifiedAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  connectedAt: string; // ISO
}

export interface LinkedInCapabilities {
  configured: boolean;
  publishing: boolean;
  /** False until Community Management API access is approved. */
  analytics: boolean;
  apiVersion: string;
  scopes: string[];
}

/* ---------------------------------- posts --------------------------------- */

/** Mirrors the database enum: `publishing` and `cancelled` are real states. */
export type PostStatus =
  | "draft"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed"
  | "cancelled";

export interface MediaAssetRef {
  id: string;
  kind: "image" | "video" | "document";
  name: string;
  mimeType: string;
  bytes: number;
  /** Short-lived signed URL from private storage; null if it expired. */
  url: string | null;
}

export interface DashboardPost {
  id: string;
  workspaceId: string;
  authorAccountId: string; // LinkedInAccount.id
  text: string;
  media: MediaAssetRef[];
  status: PostStatus;
  /** Required when status === "scheduled". ISO instant. */
  scheduledAt: string | null;
  /** IANA timezone the author scheduled in (display aid). */
  timezone: string | null;
  publishedAt: string | null; // ISO
  linkedinPostUrn: string | null;
  /** Human-readable failure explanation; null unless status === "failed". */
  failureReason: string | null;
  failureCode: string | null;
  attempts: number;
  permalink: string | null;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export interface CalendarPost extends DashboardPost {
  /** Local calendar day (yyyy-MM-dd) in the requested timezone. */
  day: string;
  /** Local wall-clock time (HH:mm) in the requested timezone. */
  localTime: string | null;
}

/* -------------------------------- analytics ------------------------------- */

/** One day of account-level metrics as reported by the LinkedIn API. */
export interface MetricPoint {
  date: string; // ISO date (yyyy-MM-dd)
  impressions: number;
  reactions: number;
  comments: number;
  reposts: number;
}

export interface PostMetrics {
  postId: string;
  impressions: number;
  reactions: number;
  comments: number;
  reposts: number;
  /** (reactions + comments + reposts) / impressions; null without impressions. */
  engagementRate: number | null;
}

export interface TopPostRow {
  postId: string;
  text: string;
  publishedAt: string | null;
  metrics: PostMetrics;
}

/**
 * A best-time cell. `score` is relative to this account's own best slot
 * (1 = best observed), never an absolute promise, and `null` when the cell has
 * too little evidence — the UI must render that as "no data", not as zero.
 */
export interface BestTimeCell {
  weekday: number; // 0 = Monday … 6 = Sunday
  hour: number; // 0–23, audience-local
  score: number | null;
  sampleSize: number;
  confidence: number;
}

export interface AnalyticsOverview {
  rangeDays: 7 | 28 | 365;
  totals: { impressions: number; reactions: number; comments: number; reposts: number };
  /** Percent change vs. the previous period of equal length; null when unknown. */
  deltas: { impressions: number | null; engagement: number | null };
  series: MetricPoint[];
  topPosts: TopPostRow[];
  bestTime: {
    cells: BestTimeCell[];
    insufficientData: { requiredPosts: number; observedPosts: number } | null;
    meta: {
      timeZone: string;
      observations: number;
      halfLifeDays: number;
      priorStrength: number;
      minObservations: number;
      minCellSample: number;
      computedAt: string;
      topSlots: Array<{ weekday: number; hour: number; score: number }>;
    } | null;
  };
  capabilities: {
    analyticsPermission: boolean;
    connectedAccounts: number;
    bestTimeUnlocked: boolean;
    historyDays: number;
    /** Non-null when analytics are unavailable — shown verbatim in the UI. */
    note: string | null;
  };
}

/* ------------------------------ team & billing ---------------------------- */

export type TeamRole = "owner" | "admin" | "editor" | "viewer";

export interface TeamMember {
  id: string;
  userId: string | null;
  name: string | null;
  email: string;
  role: TeamRole;
  status: "active" | "invited" | "removed";
  joinedAt: string | null;
  invitedAt: string | null;
  inviteExpiresAt: string | null;
}

export type SubscriptionStatus =
  | "free"
  | "pending"
  | "active"
  | "on_hold"
  | "paused"
  | "past_due"
  | "failed"
  | "cancelled"
  | "expired";

export interface Subscription {
  plan: PlanId;
  status: SubscriptionStatus;
  seats: number;
  monthlyAmountCents: number;
  /** ISO; null on Free. */
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  /** null until a payment exists — never fabricated. */
  paymentMethodBrand: string | null;
  paymentMethodLast4: string | null;
  /** False when Dodo Payments is not configured on this deployment. */
  dodoConfigured: boolean;
  invoices: InvoiceRef[];
}

/**
 * `/api/billing` payload: the subscription row plus the entitlements derived
 * from it and the caller's role in the workspace (needed to decide whether the
 * management buttons are enabled at all).
 */
export interface BillingState extends Subscription {
  entitlements: PlanEntitlements;
  role: TeamRole;
}

export interface InvoiceRef {
  id: string;
  issuedAt: string; // ISO
  amountUsd: number;
  status: string;
  pdfUrl: string | null;
}

export interface UsageSummary {
  plan: PlanId;
  scheduledThisMonth: number;
  monthlyLimit: number | null;
  remaining: number | null;
  connectedAccounts: number;
  accountLimit: number;
  period: string;
}

export type NotificationKind =
  | "post_published"
  | "post_failed"
  | "post_reminder"
  | "token_expiring"
  | "token_revoked"
  | "subscription_confirmed"
  | "payment_failed"
  | "subscription_cancelled"
  | "member_invited"
  | "system";

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  severity: "info" | "warning" | "error" | "success";
  actionUrl: string | null;
  createdAt: string; // ISO
  readAt: string | null;
}

export interface NotificationPreferences {
  email_post_published: boolean;
  email_post_failed: boolean;
  email_post_reminder: boolean;
  email_token_expiring: boolean;
  email_billing: boolean;
  email_product_updates: boolean;
  quiet_hours_start: number | null;
  quiet_hours_end: number | null;
}
