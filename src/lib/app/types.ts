/**
 * Zybble dashboard data contracts.
 *
 * These interfaces are the agreement between this frontend (Prompt 2) and the
 * backend that ships in Prompt 3 (Supabase + LinkedIn API + Dodo Payments via
 * Inngest jobs). Prompt 3 implementations must honour these shapes.
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
  name: string;
  email: string;
  avatarUrl: string | null;
  timezone: string; // IANA, e.g. "Europe/London"
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan: PlanId;
  seats: number; // Pro: billed seats; Free: 1
  createdAt: string; // ISO
}

/* -------------------------------- LinkedIn -------------------------------- */

export type LinkedInAccountStatus = "active" | "expired" | "revoked";

export interface LinkedInAccount {
  id: string;
  workspaceId: string;
  /** Personal profile or organisation page. */
  kind: "member" | "organization";
  displayName: string;
  avatarUrl: string | null;
  /** LinkedIn URN, e.g. urn:li:person:xxx — used as publish target. */
  profileUrn: string;
  status: LinkedInAccountStatus;
  connectedAt: string; // ISO
  scopes: string[]; // LinkedIn-approved scopes actually granted
}

/* ---------------------------------- posts --------------------------------- */

export type PostStatus = "draft" | "scheduled" | "published" | "failed";

export interface MediaAssetRef {
  id: string;
  kind: "image" | "video" | "document";
  name: string;
  mimeType: string;
  bytes: number;
  /** Signed URL from storage — present once uploaded in Prompt 3. */
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
  /** Set after successful publish — links back to the LinkedIn object. */
  linkedinPostUrn: string | null;
  failureReason: string | null;
  createdAt: string; // ISO
  updatedAt: string; // ISO
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
  /** (reactions + comments + reposts) / impressions */
  engagementRate: number;
}

export interface TopPostRow {
  post: Pick<DashboardPost, "id" | "text" | "publishedAt">;
  metrics: PostMetrics;
}

/** Score in [0,1]; null = insufficient data for that cell. */
export interface BestTimeCell {
  weekday: number; // 0 = Monday … 6 = Sunday
  hour: number; // 0–23, audience-local
  score: number | null;
}

export interface AnalyticsOverview {
  rangeDays: 7 | 28 | 365;
  totals: { impressions: number; reactions: number; comments: number; reposts: number };
  /** Percent change vs. the previous period of equal length; null when unknown. */
  deltas: { impressions: number | null; engagement: number | null };
  series: MetricPoint[];
  topPosts: TopPostRow[];
  bestTime: BestTimeCell[]; // Pro feature; [] on Free
}

/* ------------------------------ team & billing ---------------------------- */

export type TeamRole = "owner" | "editor";

export interface TeamMember {
  id: string;
  workspaceId: string;
  name: string;
  email: string;
  role: TeamRole;
  status: "active" | "invited";
}

export interface Subscription {
  plan: PlanId;
  status: "active" | "trialing" | "past_due" | "canceled";
  seats: number;
  /** ISO; null on Free. */
  currentPeriodEnd: string | null;
  /** null until billing exists — never fabricate. */
  paymentMethodBrand: string | null;
  paymentMethodLast4: string | null;
}

export interface InvoiceRef {
  id: string;
  issuedAt: string; // ISO
  amountUsd: number;
  status: "paid" | "open" | "void";
  pdfUrl: string | null;
}

export interface NotificationItem {
  id: string;
  kind: "post_published" | "post_failed" | "token_expiring" | "system";
  title: string;
  body: string;
  createdAt: string; // ISO
  readAt: string | null;
}
