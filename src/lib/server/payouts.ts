/**
 * Manual creator payout domain model, accounting engine, and state-transition
 * guards.
 *
 * All money values are integer paise in INR (`currency = 'INR'`).
 *
 * Core accounting identities:
 *   1. For every captured order item:
 *        unit_price_paise = commission_paise + creator_share_paise
 *   2. For every processed refund on a captured order item:
 *        refund_amount_paise = commission_reversal_paise + creator_refund_debit_paise
 *   3. For every creator:
 *        netEarnedPaise          = grossEarnedPaise - refundedCreatorSharePaise
 *        unallocatedBalancePaise = netEarnedPaise - paidOutPaise - reservedPendingPaise
 *        availablePaise          = max(0, unallocatedBalancePaise)
 *        negativeAdjustmentPaise = max(0, -unallocatedBalancePaise)
 *        outstandingPayablePaise = max(0, netEarnedPaise - paidOutPaise)
 *
 * When a refund happens after a creator payout has already been marked `paid`,
 * `unallocatedBalancePaise` becomes negative and is surfaced as
 * `negativeAdjustmentPaise` (an explicit post-payout refund receivable that is
 * offset against future earnings or settled off-platform), never pretending
 * that funds were automatically clawed back from the creator's bank account.
 */

import "server-only";
import { assertIntegerPaise, formatInrExact } from "@/lib/money";
import type { PayoutDestinationMethod } from "@/lib/server/payout-crypto";

export type PayoutRequestStatus =
  | "requested"
  | "approved"
  | "paid"
  | "rejected"
  | "failed"
  | "cancelled";

export class PayoutWorkflowError extends Error {
  readonly code:
    | "destination_required"
    | "invalid_amount"
    | "insufficient_balance"
    | "invalid_transition"
    | "invalid_confirmation"
    | "not_found";

  constructor(code: PayoutWorkflowError["code"], message: string) {
    super(message);
    this.name = "PayoutWorkflowError";
    this.code = code;
  }
}

/* -------------------------------------------------------------------------- */
/* State transition machine                                                    */
/* -------------------------------------------------------------------------- */

export const ALLOWED_PAYOUT_TRANSITIONS: Record<
  PayoutRequestStatus,
  readonly PayoutRequestStatus[]
> = {
  requested: ["approved", "paid", "rejected", "failed", "cancelled"],
  approved: ["paid", "rejected", "failed"],
  paid: [],
  rejected: [],
  failed: [],
  cancelled: [],
};

export function canTransitionPayoutStatus(
  from: PayoutRequestStatus,
  to: PayoutRequestStatus
): boolean {
  const allowed = ALLOWED_PAYOUT_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

export function assertValidPayoutTransition(
  from: PayoutRequestStatus,
  to: PayoutRequestStatus
): void {
  if (!canTransitionPayoutStatus(from, to)) {
    throw new PayoutWorkflowError(
      "invalid_transition",
      `Cannot transition payout request from "${from}" to "${to}".`
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Refund & balance calculations                                               */
/* -------------------------------------------------------------------------- */

export interface RefundSplitResult {
  refundAmountPaise: number;
  creatorRefundDebitPaise: number;
  commissionReversalPaise: number;
}

/**
 * Splits a learner refund proportionally between the creator's share and
 * Zybble's commission so the two parts always sum back to `refundAmountPaise`
 * in integer paise.
 */
export function computeCreatorRefundAdjustmentPaise(input: {
  unitPricePaise: number;
  creatorSharePaise: number;
  refundAmountPaise: number;
}): RefundSplitResult {
  assertIntegerPaise(input.unitPricePaise);
  assertIntegerPaise(input.creatorSharePaise);
  assertIntegerPaise(input.refundAmountPaise);

  if (input.unitPricePaise <= 0 || input.refundAmountPaise <= 0) {
    return {
      refundAmountPaise: 0,
      creatorRefundDebitPaise: 0,
      commissionReversalPaise: 0,
    };
  }

  const clampedRefund = Math.min(input.unitPricePaise, input.refundAmountPaise);
  if (clampedRefund === input.unitPricePaise) {
    const creatorDebit = Math.max(0, Math.min(input.unitPricePaise, input.creatorSharePaise));
    return {
      refundAmountPaise: clampedRefund,
      creatorRefundDebitPaise: creatorDebit,
      commissionReversalPaise: clampedRefund - creatorDebit,
    };
  }

  const creatorDebit = Math.max(
    0,
    Math.min(
      input.creatorSharePaise,
      Math.round((clampedRefund * input.creatorSharePaise) / input.unitPricePaise)
    )
  );
  return {
    refundAmountPaise: clampedRefund,
    creatorRefundDebitPaise: creatorDebit,
    commissionReversalPaise: clampedRefund - creatorDebit,
  };
}

export interface CapturedSaleItemInput {
  unitPricePaise: number;
  commissionPaise: number;
  creatorSharePaise: number;
}

export interface ProcessedRefundInput {
  unitPricePaise: number;
  creatorSharePaise: number;
  refundAmountPaise: number;
}

export interface PayoutRequestBalanceInput {
  amountPaise: number;
  status: PayoutRequestStatus;
}

export interface CreatorPayoutBalance {
  /** Sum of captured course prices in paise. */
  grossPaise: number;
  /** Sum of snapshotted platform commissions on captured sales. */
  commissionPaise: number;
  /** Sum of snapshotted creator shares on captured sales (before refunds). */
  grossEarnedPaise: number;
  /** Gross amount refunded to learners across processed refunds. */
  refundPaise: number;
  /** Creator share debited due to processed refunds/reversals. */
  refundedCreatorSharePaise: number;
  /** Eligible net creator earnings (`grossEarnedPaise - refundedCreatorSharePaise`). */
  netEarnedPaise: number;
  /** Amount locked in open (`requested` or `approved`) payout requests. */
  reservedPendingPaise: number;
  /** Total amount already paid out (`paid` manual requests + historical Route settlements). */
  paidOutPaise: number;
  /** Total unpaid creator balance held by Zybble (`max(0, netEarnedPaise - paidOutPaise)`). */
  outstandingPayablePaise: number;
  /** Balance currently available for a new payout request (`max(0, netEarnedPaise - paidOutPaise - reservedPendingPaise)`). */
  availablePaise: number;
  /**
   * Post-payout negative adjustment / receivable when refunds after a completed
   * payout reduce `netEarnedPaise` below `paidOutPaise + reservedPendingPaise`.
   */
  negativeAdjustmentPaise: number;
}

/**
 * Pure, deterministic creator balance reconciliation in integer paise.
 */
export function computeCreatorPayoutBalance(input: {
  capturedOrderItems: CapturedSaleItemInput[];
  processedRefunds?: ProcessedRefundInput[];
  payoutRequests: PayoutRequestBalanceInput[];
  legacySettledPaise?: number;
  legacyPendingPaise?: number;
  legacyReversedPaise?: number;
}): CreatorPayoutBalance {
  let grossPaise = 0;
  let commissionPaise = 0;
  let grossEarnedPaise = 0;

  for (const item of input.capturedOrderItems) {
    const unit = Number(item.unitPricePaise ?? 0);
    const comm = Number(item.commissionPaise ?? 0);
    const creator = Number(item.creatorSharePaise ?? 0);
    assertIntegerPaise(unit);
    assertIntegerPaise(comm);
    assertIntegerPaise(creator);
    grossPaise += unit;
    commissionPaise += comm;
    grossEarnedPaise += creator;
  }

  let refundPaise = 0;
  let refundedCreatorSharePaise = Number(input.legacyReversedPaise ?? 0);
  assertIntegerPaise(refundedCreatorSharePaise);

  for (const refund of input.processedRefunds ?? []) {
    const split = computeCreatorRefundAdjustmentPaise(refund);
    refundPaise += split.refundAmountPaise;
    refundedCreatorSharePaise += split.creatorRefundDebitPaise;
  }

  const legacySettled = Number(input.legacySettledPaise ?? 0);
  const legacyPending = Number(input.legacyPendingPaise ?? 0);
  assertIntegerPaise(legacySettled);
  assertIntegerPaise(legacyPending);

  let manualPaidPaise = 0;
  let manualReservedPaise = 0;

  for (const req of input.payoutRequests) {
    const amount = Number(req.amountPaise ?? 0);
    assertIntegerPaise(amount);
    if (req.status === "paid") {
      manualPaidPaise += amount;
    } else if (req.status === "requested" || req.status === "approved") {
      manualReservedPaise += amount;
    }
    // `rejected`, `failed`, and `cancelled` release their reservation.
  }

  const netEarnedPaise = grossEarnedPaise - refundedCreatorSharePaise;
  const paidOutPaise = manualPaidPaise + legacySettled;
  const reservedPendingPaise = manualReservedPaise + legacyPending;
  const unallocatedBalancePaise = netEarnedPaise - paidOutPaise - reservedPendingPaise;

  const availablePaise = Math.max(0, unallocatedBalancePaise);
  const negativeAdjustmentPaise = Math.max(0, -unallocatedBalancePaise);
  const outstandingPayablePaise = Math.max(0, netEarnedPaise - paidOutPaise);

  return {
    grossPaise,
    commissionPaise,
    grossEarnedPaise,
    refundPaise,
    refundedCreatorSharePaise,
    netEarnedPaise,
    reservedPendingPaise,
    paidOutPaise,
    outstandingPayablePaise,
    availablePaise,
    negativeAdjustmentPaise,
  };
}

/* -------------------------------------------------------------------------- */
/* Request & Admin Confirmation Guards                                         */
/* -------------------------------------------------------------------------- */

export function validatePayoutRequestCreation(input: {
  requestedAmountPaise: number;
  availablePaise: number;
  hasDestination: boolean;
}): void {
  if (!input.hasDestination) {
    throw new PayoutWorkflowError(
      "destination_required",
      "Save your UPI ID or bank account details before requesting a payout."
    );
  }

  assertIntegerPaise(input.requestedAmountPaise);
  assertIntegerPaise(input.availablePaise);

  if (input.requestedAmountPaise <= 0) {
    throw new PayoutWorkflowError(
      "invalid_amount",
      "Payout request amount must be greater than ₹0.00."
    );
  }

  if (input.availablePaise <= 0) {
    throw new PayoutWorkflowError(
      "insufficient_balance",
      "You have no available balance to request right now."
    );
  }

  if (input.requestedAmountPaise > input.availablePaise) {
    throw new PayoutWorkflowError(
      "insufficient_balance",
      `Requested amount (${formatInrExact(input.requestedAmountPaise)}) exceeds your available balance (${formatInrExact(input.availablePaise)}).`
    );
  }
}

export const PAYMENT_REFERENCE_REGEX = /^[A-Za-z0-9._/:@-]{4,120}$/;

/**
 * Enforces the manual payout confirmation rules before a payout request can be
 * marked `paid`:
 *   1. Valid transition from `requested` or `approved` to `paid`.
 *   2. Explicit confirmation that the transfer was sent off-platform.
 *   3. Explicit confirmation that the exact INR amount in paise matches.
 *   4. A valid UTR / bank / UPI transaction reference.
 */
export function validateManualPayoutConfirmation(input: {
  currentStatus: PayoutRequestStatus;
  expectedAmountPaise: number;
  confirmAmountPaise: number;
  paymentReference: string;
  paymentMethodUsed?: string | null;
  confirmAmountMatch: boolean;
  confirmTransferSent: boolean;
}): { paymentReference: string; paymentMethodUsed: string } {
  assertValidPayoutTransition(input.currentStatus, "paid");
  assertIntegerPaise(input.expectedAmountPaise);
  assertIntegerPaise(input.confirmAmountPaise);

  if (!input.confirmTransferSent) {
    throw new PayoutWorkflowError(
      "invalid_confirmation",
      "Confirm that the off-platform bank or UPI transfer has actually been sent before marking this payout as paid."
    );
  }

  if (!input.confirmAmountMatch || input.confirmAmountPaise !== input.expectedAmountPaise) {
    throw new PayoutWorkflowError(
      "invalid_confirmation",
      `Confirmed amount must match the exact payout request amount (${formatInrExact(input.expectedAmountPaise)}).`
    );
  }

  const ref = String(input.paymentReference ?? "").trim();
  if (ref.length < 4 || ref.length > 120 || !PAYMENT_REFERENCE_REGEX.test(ref)) {
    throw new PayoutWorkflowError(
      "invalid_confirmation",
      "Enter the 4–120 character UTR, IMPS/NEFT, or UPI transaction reference from your bank."
    );
  }

  const methodUsed = String(input.paymentMethodUsed ?? "UPI / Bank Transfer").trim() || "UPI / Bank Transfer";
  if (methodUsed.length > 60) {
    throw new PayoutWorkflowError("invalid_confirmation", "Payment method label is too long.");
  }

  return { paymentReference: ref, paymentMethodUsed: methodUsed };
}

/**
 * Generates an unambiguous public identifier for a creator payout request,
 * e.g. `PAY-20261016-8F3K9M`.
 */
export function generatePublicPayoutId(now: Date = new Date()): string {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let suffix = "";
  for (const b of bytes) suffix += alphabet[b % alphabet.length];
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  return `PAY-${datePart}-${suffix}`;
}

export interface CreatorPayoutDestinationView {
  method: PayoutDestinationMethod;
  maskedDestination: string;
  maskedAccountHolder: string;
  bankLabel: string | null;
  statusLabel: "Details saved · Awaiting payout";
  updatedAt: string;
}

export interface CreatorPayoutRequestView {
  id: string;
  publicId: string;
  creatorId: string;
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
  requestedAt: string;
  approvedAt: string | null;
  paidAt: string | null;
  rejectedAt: string | null;
  failedAt: string | null;
  cancelledAt: string | null;
}
