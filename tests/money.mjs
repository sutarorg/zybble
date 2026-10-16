/**
 * Money contract tests.
 *
 * The financial source of truth is integer paise. These lock down the three
 * properties the rest of the marketplace depends on:
 *   1. rupee strings convert to paise without floating-point drift,
 *   2. a commission split always sums back to the gross exactly, and
 *   3. only INR is accepted anywhere.
 */

import assert from "node:assert/strict";
import { test, before } from "node:test";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

before(async () => {
  register(new URL("./helpers/loader.mjs", import.meta.url), pathToFileURL("./"));
});

const money = await import("../src/lib/money.ts");
const payouts = await import("../src/lib/server/payouts.ts");

test("INR is the only currency", () => {
  assert.equal(money.CURRENCY, "INR");
  money.assertInr("INR");
  for (const other of ["USD", "EUR", "GBP", "usd", "inr", "", null, undefined, 840]) {
    assert.throws(() => money.assertInr(other), /Unsupported currency/);
  }
});

test("rupee strings convert to paise without floating-point error", () => {
  assert.equal(money.rupeesToPaise("1499.50"), 149950);
  assert.equal(money.rupeesToPaise("1499.5"), 149950);
  assert.equal(money.rupeesToPaise("0.01"), 1);
  assert.equal(money.rupeesToPaise("0"), 0);
  assert.equal(money.rupeesToPaise("99999999.99"), 9999999999);

  // The classic float trap: 0.1 + 0.2 !== 0.3.
  assert.equal(money.rupeesToPaise("0.1") + money.rupeesToPaise("0.2"), money.rupeesToPaise("0.3"));
  assert.equal(money.rupeesToPaise(0.1) + money.rupeesToPaise(0.2), 30);

  // Every paise amount from 0..9999 round-trips exactly.
  for (let paise = 0; paise < 10_000; paise += 1) {
    assert.equal(money.rupeesToPaise(money.paiseToRupees(paise)), paise);
  }
});

test("invalid or over-precise amounts are rejected, not rounded", () => {
  for (const bad of ["", " ", "abc", "1,499", "1e3", "NaN", "12.", ".5", "1.2.3", "₹100"]) {
    assert.throws(() => money.rupeesToPaise(bad), /Invalid INR amount/, JSON.stringify(bad));
  }
  assert.throws(() => money.rupeesToPaise("10.005"), /at most 2 decimal places/);
});

test("non-integer paise never reach an accounting value", () => {
  assert.throws(() => money.assertIntegerPaise(10.5));
  assert.throws(() => money.assertIntegerPaise("100"));
  assert.throws(() => money.assertIntegerPaise(Number.NaN));
  assert.throws(() => money.assertIntegerPaise(Number.MAX_SAFE_INTEGER + 2));
  money.assertIntegerPaise(0);
  money.assertIntegerPaise(-250);
});

test("a commission split always sums back to the gross exactly", () => {
  const rates = [0, 1, 333, 1000, 1050, 2500, 5000];
  for (const bps of rates) {
    for (let gross = 0; gross < 50_000; gross += 7) {
      const split = money.splitCommission(gross, bps);
      assert.equal(split.commissionPaise + split.creatorPaise, gross, `${gross}@${bps}`);
      assert.ok(split.commissionPaise >= 0 && split.creatorPaise >= 0);
      assert.ok(split.commissionPaise <= gross);
    }
  }
});

test("the planned 10% default splits a realistic price as documented", () => {
  // 10% of ₹1,499.00 = ₹149.90; creator keeps ₹1,349.10.
  assert.deepEqual(money.splitCommission(149900, 1000), {
    grossPaise: 149900,
    commissionPaise: 14990,
    creatorPaise: 134910,
  });
});

test("commission rate bounds are enforced", () => {
  assert.throws(() => money.splitCommission(1000, -1), /out of range/);
  assert.throws(() => money.splitCommission(1000, 5001), /out of range/);
  assert.throws(() => money.splitCommission(-1, 1000), /cannot be negative/);
  assert.throws(() => money.splitCommission(10.5, 1000), /integer paise/);
});

test("basis points render as a plain percentage", () => {
  assert.equal(money.formatCommissionPercent(1000), "10");
  assert.equal(money.formatCommissionPercent(1050), "10.5");
  assert.equal(money.formatCommissionPercent(0), "0");
  assert.equal(money.formatCommissionPercent(2500), "25");
});

test("formatting is Indian grouping and never names another currency", () => {
  const label = money.formatInr(12345678);
  assert.match(label, /₹/);
  assert.match(label, /1,23,456/); // Indian digit grouping, not 1,234,567
  assert.doesNotMatch(label, /USD|EUR|GBP|\$/);

  assert.equal(money.formatInrOrFree(0), "Free");
  assert.match(money.formatInrOrFree(149900), /₹1,499/);
  assert.match(money.formatInrOrFree(0), /^Free$/);
});

test("a course price is validated and stored as integer paise", () => {
  const parse = money.inrPriceInputSchema.safeParse("1499");
  assert.equal(parse.success, true);
  assert.equal(parse.success && parse.data, 149900);
  assert.ok(Number.isSafeInteger(parse.success ? parse.data : -1));

  assert.equal(money.inrPriceInputSchema.safeParse("-1").success, false);
  assert.equal(money.inrPriceInputSchema.safeParse("1,499").success, false);
  assert.equal(money.inrPriceInputSchema.safeParse("abc").success, false);
  // Free courses are allowed; they never touch a payment provider.
  assert.equal(money.inrPriceInputSchema.safeParse("0").success, true);
  // Above the documented ₹1,00,00,000 ceiling the value is rejected, not clamped.
  assert.equal(money.inrPriceInputSchema.safeParse("100000001").success, false);
});

test("the currency field only accepts INR", () => {
  assert.equal(money.inrCurrencySchema.safeParse("INR").success, true);
  for (const bad of ["USD", "usd", "EUR", "₹", ""]) {
    assert.equal(money.inrCurrencySchema.safeParse(bad).success, false, bad);
  }
});

test("exact formatting always shows both decimal places for reconciliation", () => {
  assert.match(money.formatInrExact(129900), /₹1,299\.00/);
  assert.match(money.formatInrExact(1), /₹0\.01/);
  assert.doesNotMatch(money.formatInrExact(129900), /USD|EUR|GBP/);
});

test("refund split proportionally debits creator share and commission in integer paise", () => {
  // ₹1,499.00 course at 10% commission -> ₹149.90 commission, ₹1,349.10 creator share
  const full = payouts.computeCreatorRefundAdjustmentPaise({
    unitPricePaise: 149900,
    creatorSharePaise: 134910,
    refundAmountPaise: 149900,
  });
  assert.equal(full.refundAmountPaise, 149900);
  assert.equal(full.creatorRefundDebitPaise, 134910);
  assert.equal(full.commissionReversalPaise, 14990);
  assert.equal(full.creatorRefundDebitPaise + full.commissionReversalPaise, full.refundAmountPaise);

  // Partial 50% refund -> exact paise sum
  const half = payouts.computeCreatorRefundAdjustmentPaise({
    unitPricePaise: 149900,
    creatorSharePaise: 134910,
    refundAmountPaise: 74950,
  });
  assert.equal(half.refundAmountPaise, 74950);
  assert.equal(half.creatorRefundDebitPaise + half.commissionReversalPaise, 74950);
  assert.equal(half.creatorRefundDebitPaise, 67455);
});

test("creator manual payout balance reconciles sales, refunds, reserved requests, and paid payouts", () => {
  // Two captured sales of ₹1,000.00 each (10% commission => ₹900.00 creator share each)
  const balance = payouts.computeCreatorPayoutBalance({
    capturedOrderItems: [
      { unitPricePaise: 100000, commissionPaise: 10000, creatorSharePaise: 90000 },
      { unitPricePaise: 100000, commissionPaise: 10000, creatorSharePaise: 90000 },
    ],
    processedRefunds: [],
    payoutRequests: [
      { amountPaise: 50000, status: "paid" },
      { amountPaise: 40000, status: "requested" },
      { amountPaise: 25000, status: "rejected" }, // released back to available
      { amountPaise: 15000, status: "failed" }, // released back to available
      { amountPaise: 10000, status: "cancelled" }, // released back to available
    ],
  });

  assert.equal(balance.grossPaise, 200000);
  assert.equal(balance.commissionPaise, 20000);
  assert.equal(balance.grossEarnedPaise, 180000);
  assert.equal(balance.netEarnedPaise, 180000);
  assert.equal(balance.paidOutPaise, 50000);
  assert.equal(balance.reservedPendingPaise, 40000);
  assert.equal(balance.outstandingPayablePaise, 130000); // 180000 - 50000
  assert.equal(balance.availablePaise, 90000); // 180000 - 50000 - 40000
  assert.equal(balance.negativeAdjustmentPaise, 0);
});

test("post-payout refund surfaces negativeAdjustmentPaise without faking a bank clawback", () => {
  // Creator sold ₹1,000.00 (earned ₹900.00), was paid ₹900.00 manually, then learner was refunded ₹1,000.00
  const postRefund = payouts.computeCreatorPayoutBalance({
    capturedOrderItems: [
      { unitPricePaise: 100000, commissionPaise: 10000, creatorSharePaise: 90000 },
    ],
    processedRefunds: [
      { unitPricePaise: 100000, creatorSharePaise: 90000, refundAmountPaise: 100000 },
    ],
    payoutRequests: [{ amountPaise: 90000, status: "paid" }],
  });

  assert.equal(postRefund.grossEarnedPaise, 90000);
  assert.equal(postRefund.refundedCreatorSharePaise, 90000);
  assert.equal(postRefund.netEarnedPaise, 0);
  assert.equal(postRefund.paidOutPaise, 90000);
  assert.equal(postRefund.availablePaise, 0);
  assert.equal(postRefund.outstandingPayablePaise, 0);
  assert.equal(postRefund.negativeAdjustmentPaise, 90000);
});