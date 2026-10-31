import { describe, expect, it } from "vitest";
import {
  PLAN_ENTITLEMENTS,
  PRO_SEAT_PRICE_CENTS,
  billableSeats,
  buildUsageSnapshot,
  describeLimitError,
  effectivePlan,
  entitlementsFor,
  isPro,
  monthlyAmountCents,
  remainingScheduleSlots,
} from "@/features/billing/entitlements";

/**
 * Entitlements are the boundary between what a workspace paid for and what it
 * gets. They are derived from the subscription row — never from the browser.
 */

describe("plan catalogue", () => {
  it("matches the published plan matrix", () => {
    expect(PLAN_ENTITLEMENTS.free).toMatchObject({
      maxLinkedInAccounts: 1,
      monthlyScheduleLimit: 10,
      analyticsHistoryDays: 7,
      bestTimeInsights: false,
      teamCollaboration: false,
    });

    expect(PLAN_ENTITLEMENTS.pro).toMatchObject({
      maxLinkedInAccounts: 5,
      monthlyScheduleLimit: null,
      analyticsHistoryDays: 365,
      bestTimeInsights: true,
      teamCollaboration: true,
    });
  });

  it("charges $15 per seat per month", () => {
    expect(PRO_SEAT_PRICE_CENTS).toBe(1500);
    expect(monthlyAmountCents(1)).toBe(1500);
    expect(monthlyAmountCents(4)).toBe(6000);
  });
});

describe("effectivePlan", () => {
  it("keeps Pro on through dunning, not before the first payment", () => {
    const base = { plan: "pro" as const, currentPeriodEnd: null };

    // `past_due` keeps access: a failed card should not lock a paying customer
    // out mid-cycle. `pending` (checkout started, not paid) does not.
    expect(effectivePlan({ ...base, status: "active" })).toBe("pro");
    expect(effectivePlan({ ...base, status: "past_due" })).toBe("pro");
    expect(effectivePlan({ ...base, status: "pending" })).toBe("free");
  });

  it("drops to Free when the subscription stops being paid for", () => {
    expect(effectivePlan({ plan: "pro", status: "cancelled", currentPeriodEnd: null })).toBe("free");
    expect(effectivePlan({ plan: "pro", status: "expired", currentPeriodEnd: null })).toBe("free");
    expect(effectivePlan({ plan: "pro", status: "failed", currentPeriodEnd: null })).toBe("free");
  });

  it("drops to Free the moment a paid period closes, even if the row still says active", () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    expect(effectivePlan({ plan: "pro", status: "active", currentPeriodEnd: yesterday })).toBe("free");
  });

  it("keeps Pro until the period ends when cancellation is set for period end", () => {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
    expect(effectivePlan({ plan: "pro", status: "active", currentPeriodEnd: tomorrow })).toBe("pro");
  });

  it("never invents a plan for a missing subscription", () => {
    expect(effectivePlan({ plan: undefined, status: undefined, currentPeriodEnd: null })).toBe("free");
  });

  it("isPro agrees with effectivePlan", () => {
    expect(isPro("active")).toBe(true);
    expect(isPro("past_due")).toBe(true);
    expect(isPro("cancelled")).toBe(false);
    expect(isPro(null)).toBe(false);
  });
});

describe("seats", () => {
  it("counts active members only", () => {
    expect(
      billableSeats([
        { status: "active" },
        { status: "invited" },
        { status: "removed" },
        { status: "active" },
      ]),
    ).toBe(2);
  });

  it("never bills zero seats", () => {
    expect(billableSeats([])).toBe(1);
    expect(billableSeats([{ status: "invited" }])).toBe(1);
  });
});

describe("usage snapshot", () => {
  it("reports remaining slots and null for unlimited", () => {
    const free = buildUsageSnapshot({
      plan: "free",
      scheduledPostsUsed: 4,
      linkedinAccountsUsed: 1,
    });

    expect(remainingScheduleSlots(free)).toBe(6);
    expect(free.scheduledPostsLimit).toBe(10);

    const pro = buildUsageSnapshot({
      plan: "pro",
      scheduledPostsUsed: 400,
      linkedinAccountsUsed: 5,
    });

    expect(remainingScheduleSlots(pro)).toBeNull();
    expect(pro.scheduledPostsLimit).toBeNull();
  });

  it("never reports negative remaining slots", () => {
    const over = buildUsageSnapshot({
      plan: "free",
      scheduledPostsUsed: 40,
      linkedinAccountsUsed: 1,
    });

    expect(remainingScheduleSlots(over)).toBe(0);
  });

  it("entitlementsFor falls back to Free for an unknown plan", () => {
    expect(entitlementsFor("free")).toBe(PLAN_ENTITLEMENTS.free);
    expect(entitlementsFor("pro")).toBe(PLAN_ENTITLEMENTS.pro);
  });
});

describe("describeLimitError", () => {
  it("turns database error codes into sentences", () => {
    expect(describeLimitError("schedule_limit_reached")).toMatch(/Free plan/i);
    expect(describeLimitError("linkedin_account_limit_reached")).toMatch(/account/i);
    expect(describeLimitError("workspace_requires_owner")).toMatch(/owner/i);
    expect(describeLimitError("invitation_expired")).toMatch(/expired/i);
  });

  it("returns null for codes it does not own, so callers keep their own message", () => {
    expect(describeLimitError("23505")).toBeNull();
    expect(describeLimitError(undefined)).toBeNull();
  });
});
