import type { PlanEntitlements, PlanId } from "@/lib/app/types";

/**
 * Entitlements — the single source of truth for what each plan may do.
 *
 * The numbers here are the marketing numbers; they are enforced server-side in
 * three places:
 *   1. SQL triggers (`0010_triggers.sql`) for account and quota limits,
 *   2. RLS policies (`0008_rls.sql`) for analytics history windows,
 *   3. the checks below, which turn a violation into a helpful API error.
 *
 * The plan a workspace is on always comes from `public.subscriptions`, which is
 * only writable by a signature-verified Dodo webhook. A client that claims to
 * have paid cannot change any of this.
 */

export const PLAN_ENTITLEMENTS: Record<PlanId, PlanEntitlements> = {
  free: {
    plan: "free",
    maxLinkedInAccounts: 1,
    monthlyScheduleLimit: 10,
    analyticsHistoryDays: 7,
    bestTimeInsights: false,
    teamCollaboration: false,
  },
  pro: {
    plan: "pro",
    maxLinkedInAccounts: 5,
    monthlyScheduleLimit: null,
    analyticsHistoryDays: 365,
    bestTimeInsights: true,
    teamCollaboration: true,
  },
};

/** $15 per paid seat per month. */
export const PRO_SEAT_PRICE_CENTS = 1500;
export const PRO_CURRENCY = "USD";

export function entitlementsFor(plan: PlanId): PlanEntitlements {
  return PLAN_ENTITLEMENTS[plan];
}

export function isPro(status: string | null | undefined): boolean {
  // `active` and `past_due` keep Pro features on; dunning should not lock a
  // paying customer out mid-cycle. Everything else falls back to Free.
  return status === "active" || status === "past_due" || status === "trialing";
}

/**
 * Map a subscription row onto the plan actually in force.
 * Unknown or lapsed states degrade to Free — never the other way round.
 */
export function effectivePlan(input: {
  plan?: PlanId | null;
  status?: string | null;
  currentPeriodEnd?: string | null;
}): PlanId {
  if (input.plan !== "pro") return "free";
  if (!isPro(input.status)) return "free";
  if (input.currentPeriodEnd && new Date(input.currentPeriodEnd).getTime() < Date.now()) {
    return "free";
  }
  return "pro";
}

/**
 * Seat accounting.
 *
 * Definition (documented on the billing screen): one seat is one *active*
 * member of the workspace — owner, admins, editors and viewers alike. Pending
 * invitations are not billed, removed members are not billed, and the owner
 * always occupies at least one seat so a workspace cannot bill zero.
 */
export type MemberLike = { status: string };

export function billableSeats(members: MemberLike[]): number {
  const active = members.filter((member) => member.status === "active").length;
  return Math.max(active, 1);
}

export function monthlyAmountCents(seats: number): number {
  return PRO_SEAT_PRICE_CENTS * Math.max(seats, 1);
}

export type UsageSnapshot = {
  plan: PlanId;
  scheduledPostsUsed: number;
  scheduledPostsLimit: number | null;
  linkedinAccountsUsed: number;
  linkedinAccountsLimit: number;
  analyticsHistoryDays: number;
};

export function buildUsageSnapshot(input: {
  plan: PlanId;
  scheduledPostsUsed: number;
  linkedinAccountsUsed: number;
}): UsageSnapshot {
  const entitlements = entitlementsFor(input.plan);

  return {
    plan: input.plan,
    scheduledPostsUsed: input.scheduledPostsUsed,
    scheduledPostsLimit: entitlements.monthlyScheduleLimit,
    linkedinAccountsUsed: input.linkedinAccountsUsed,
    linkedinAccountsLimit: entitlements.maxLinkedInAccounts,
    analyticsHistoryDays: entitlements.analyticsHistoryDays,
  };
}

export function remainingScheduleSlots(snapshot: UsageSnapshot): number | null {
  if (snapshot.scheduledPostsLimit === null) return null;
  return Math.max(snapshot.scheduledPostsLimit - snapshot.scheduledPostsUsed, 0);
}

/** Convert a raw SQL constraint violation into a friendly, actionable message. */
export function describeLimitError(code: string | undefined): string | null {
  switch (code) {
    case "schedule_limit_reached":
      return "You have used all 10 scheduled posts included in the Free plan this month. Upgrade to Pro for unlimited scheduling, or move a scheduled post back to drafts.";
    case "linkedin_account_limit_reached":
      return "The Free plan allows one connected LinkedIn account. Upgrade to Pro for up to five.";
    case "workspace_requires_owner":
      return "A workspace must keep at least one owner.";
    case "invitation_expired":
      return "That invitation has expired. Ask a workspace admin to send a new one.";
    case "invitation_email_mismatch":
      return "That invitation was sent to a different email address.";
    default:
      return null;
  }
}
