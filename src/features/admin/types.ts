/**
 * Shapes returned by the admin services and the `/api/admin/*` routes.
 *
 * Two rules govern every field here:
 *
 *  1. **Nothing secret is included.** No `linkedin_account_secrets`, no
 *     `raw` webhook payloads, no `invite_token_hash`, no service-role or
 *     provider keys. A field only exists in these types if an operator is
 *     meant to read it.
 *  2. **Absent data is `null`, never a placeholder.** Where a number cannot
 *     be computed from real rows it is `null` and the UI renders an em-dash,
 *     so an empty billing table reads as "no verified subscriptions" rather
 *     than as "$0 MRR".
 */

export type IntegrationState = "ready" | "not_configured" | "partial";

export type IntegrationHealth = {
  label: string;
  state: IntegrationState;
  /** One-line, actionable detail. Never contains a credential. */
  detail: string;
};

export type AdminOverview = {
  users: {
    total: number;
    /** `profiles.deleted_at is null`. */
    active: number;
    deleted: number;
    /** Signed up in the last 7 days. */
    newLast7Days: number;
  };
  workspaces: {
    total: number;
    free: number;
    pro: number;
  };
  posts: {
    published: number;
    scheduled: number;
    failed: number;
    drafts: number;
  };
  billing: {
    /** Monthly recurring revenue in cents, from verified subscription rows. */
    mrrCents: number;
    /** Active Pro subscriptions that had no amount we could verify. */
    mrrUnpriced: number;
    activeProSubscriptions: number;
  };
  /** Most recent audit rows across every workspace. */
  recentActivity: AdminActivityRow[];
  integrations: IntegrationHealth[];
  generatedAt: string;
};

/** A user as the platform sees them. */
export type AdminUserRow = {
  id: string;
  name: string | null;
  email: string;
  createdAt: string;
  /**
   * Derived from real columns only: soft-deleted, otherwise whether
   * onboarding finished. Never a guess at "engagement".
   */
  status: "active" | "pending_onboarding" | "deleted";
  onboardedAt: string | null;
  deletedAt: string | null;
  workspaces: Array<{
    id: string;
    name: string;
    role: string;
    status: string;
  }>;
  workspaceCount: number;
};

export type AdminWorkspaceRow = {
  id: string;
  name: string;
  slug: string;
  plan: "free" | "pro";
  /** Pro only when the subscription row says so — mirrors workspace_plan(). */
  subscriptionStatus: string | null;
  owner: { id: string; name: string | null; email: string } | null;
  memberCount: number;
  linkedinAccountCount: number;
  seats: number;
  createdAt: string;
  deletedAt: string | null;
};

export type AdminBillingSummary = {
  plans: { free: number; pro: number; total: number };
  subscriptions: {
    active: number;
    /** Every status with a count, so nothing is hidden. */
    byStatus: Array<{ status: string; count: number }>;
    cancellingAtPeriodEnd: number;
    /** Subscriptions whose period has closed but are still marked payable. */
    lapsed: number;
  };
  revenue: {
    mrrCents: number;
    currency: string;
    /** Active Pro rows counted toward MRR. */
    counted: number;
    /** Active Pro rows with no verifiable amount, excluded from MRR. */
    unpriced: number;
    /** Active Pro rows in a currency other than the majority one. */
    otherCurrency: number;
  };
  seats: {
    /** Sum of seats on active Pro subscriptions. */
    billable: number;
  };
  payments: {
    paid: number;
    failed: number;
    refunded: number;
    pending: number;
    /** Sum of successful payments, for context — not a revenue forecast. */
    collectedCents: number;
  };
  subscriptionsList: Array<{
    id: string;
    workspaceId: string;
    workspaceName: string;
    ownerEmail: string | null;
    plan: "free" | "pro";
    status: string;
    seats: number;
    unitAmountCents: number | null;
    currency: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    lastEventType: string | null;
    lastEventAt: string | null;
  }>;
  generatedAt: string;
};

export type AdminActivityRow = {
  id: string;
  actorType: "user" | "system" | "webhook";
  actorEmail: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  workspaceName: string | null;
  createdAt: string;
  /**
   * Audit metadata with any sensitive-looking key stripped server-side.
   * Keys matching the logger's redaction rules are removed entirely rather
   * than masked, because a masked value still reveals that the key existed.
   */
  metadata: Record<string, unknown> | null;
};

export type AdminSystemReport = {
  access: {
    /** False means /admin denies everyone, including the founder. */
    allowlistConfigured: boolean;
    adminCount: number;
    /** Entries that were present but not valid UUIDs. */
    invalidEntries: string[];
    reason: "ok" | "missing" | "empty" | "no_valid_entries";
    /** The signed-in operator's own id, so they can copy it into the config. */
    currentUserId: string;
  };
  integrations: IntegrationHealth[];
  webhooks: {
    byStatus: Array<{ status: string; count: number }>;
    failedLast24h: number;
    unverifiedSignature: number;
    recent: Array<{
      eventId: string;
      provider: string;
      eventType: string;
      status: string;
      receivedAt: string;
      attempts: number;
      /** Truncated, redacted error text. Never the payload. */
      error: string | null;
    }>;
  };
  jobs: {
    publishAttemptsFailedLast24h: number;
    postsFailed: number;
    postsPublishing: number;
  };
  generatedAt: string;
};

export type Paginated<T> = {
  rows: T[];
  page: number;
  perPage: number;
  total: number;
  pageCount: number;
};
