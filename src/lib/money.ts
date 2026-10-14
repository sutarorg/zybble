/**
 * INR-only money primitives.
 *
 * Zybble is an India-only marketplace. INR is the only currency that exists in
 * this codebase: there is no conversion, no rate table and no picker. The
 * canonical representation for every stored or transmitted amount is an
 * **integer number of paise** (1 rupee = 100 paise). Floating point is never
 * used as the source of truth for an accounting value.
 */

import { z } from "zod";

/** The one and only currency code accepted anywhere in Zybble. */
export const CURRENCY = "INR" as const;
export type Currency = typeof CURRENCY;

/** Razorpay's transfer API is documented as INR-only; we reject anything else. */
export function assertInr(currency: unknown): asserts currency is Currency {
  if (currency !== CURRENCY) {
    throw new Error(`Unsupported currency: only ${CURRENCY} is accepted`);
  }
}

/* -------------------------------------------------------------------------- */
/* Parsing and conversion (decimal safe)                                       */
/* -------------------------------------------------------------------------- */

/**
 * Converts a price expressed in rupees (as typed by a creator, e.g. `"1499.50"`)
 * into an exact integer paise amount without floating-point rounding error.
 *
 * The value is parsed from its decimal string representation rather than from a
 * JS `number`, because `Number("0.1") + Number("0.2") !== 0.3`.
 */
export function rupeesToPaise(input: string | number): number {
  const raw = typeof input === "number" ? input.toString() : input.trim();
  if (!/^-?\d+(\.\d+)?$/.test(raw)) {
    throw new Error(`Invalid INR amount: ${raw}`);
  }
  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;
  const [whole, fraction = ""] = unsigned.split(".");
  if (fraction.length > 2) {
    throw new Error(`INR amounts support at most 2 decimal places, received ${fraction.length}`);
  }
  const paiseFraction = (fraction + "00").slice(0, 2);
  const paise = Number(whole) * 100 + Number(paiseFraction);
  return negative ? -paise : paise;
}

/** Exact inverse of {@link rupeesToPaise}; returns a plain decimal string. */
export function paiseToRupees(paise: number): string {
  assertIntegerPaise(paise);
  const negative = paise < 0;
  const abs = Math.abs(paise);
  const whole = Math.floor(abs / 100);
  const fraction = String(abs % 100).padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

export function assertIntegerPaise(value: unknown): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new Error("Monetary amounts must be integer paise");
  }
}

/** Rounds a paise amount to the nearest whole paise using half-up rounding. */
export function roundPaise(value: number): number {
  return Math.floor(value + 0.5);
}

/* -------------------------------------------------------------------------- */
/* Commission                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Basis-point commission, snapshotted onto every order item so a later change to
 * the marketplace rate can never rewrite historical transactions.
 * `1000` = 10.00%. Integer arithmetic only.
 */
export type CommissionBps = number;

export const MIN_COMMISSION_BPS = 0;
export const MAX_COMMISSION_BPS = 5000; // 50% — sanity ceiling for the admin UI.

/**
 * Applies a platform commission to a gross INR amount and returns both halves.
 * The creator share is whatever is left after the platform commission, so the
 * two values always sum back to the gross exactly — no rounding drift.
 */
export function splitCommission(
  grossPaise: number,
  commissionBps: CommissionBps
): { grossPaise: number; commissionPaise: number; creatorPaise: number } {
  assertIntegerPaise(grossPaise);
  assertIntegerPaise(commissionBps);
  if (grossPaise < 0) throw new Error("Gross amount cannot be negative");
  if (commissionBps < MIN_COMMISSION_BPS || commissionBps > MAX_COMMISSION_BPS) {
    throw new Error(`Commission out of range: ${commissionBps} bps`);
  }
  const commissionPaise = Math.floor((grossPaise * commissionBps) / 10_000);
  return {
    grossPaise,
    commissionPaise,
    creatorPaise: grossPaise - commissionPaise,
  };
}

/** Basis points -> a human percentage, e.g. `1000` -> `"10"`, `1050` -> `"10.5"`. */
export function formatCommissionPercent(bps: CommissionBps): string {
  const whole = Math.trunc(bps / 100);
  const frac = bps % 100;
  return frac === 0 ? String(whole) : `${whole}.${String(frac).padStart(2, "0").replace(/0$/, "")}`;
}

/* -------------------------------------------------------------------------- */
/* Formatting                                                                  */
/* -------------------------------------------------------------------------- */

const inrFormatters = new Map<string, Intl.NumberFormat>();

function inrFormatter(locale: string, overrides?: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = overrides ? `${locale}:${JSON.stringify(overrides)}` : locale;
  let formatter = inrFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: CURRENCY,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
      ...overrides,
    });
    inrFormatters.set(key, formatter);
  }
  return formatter;
}

/**
 * Formats integer paise as an Indian-format rupee amount.
 * The default locale is `en-IN` (Indian digit grouping: 1,00,000).
 */
export function formatInr(paise: number, locale = "en-IN"): string {
  assertIntegerPaise(paise);
  return inrFormatter(locale).format(paise / 100);
}

/**
 * Formats paise with both decimal places always shown, e.g. `₹1,299.00`.
 *
 * Used wherever a figure has to be reconciled line by line against Razorpay,
 * where a rounded `₹1,299` would read as a different number.
 */
export function formatInrExact(paise: number, locale = "en-IN"): string {
  assertIntegerPaise(paise);
  return inrFormatter(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

/** Formats paise with an explicit "Free" label for zero-value courses. */
export function formatInrOrFree(paise: number, locale = "en-IN", freeLabel = "Free"): string {
  assertIntegerPaise(paise);
  return paise === 0 ? freeLabel : formatInr(paise, locale);
}

/** Compact Indian-format display used in analytics tables, e.g. "₹1.2L". */
export function formatInrCompact(paise: number, locale = "en-IN"): string {
  assertIntegerPaise(paise);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: CURRENCY,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(paise / 100);
}

/* -------------------------------------------------------------------------- */
/* Validation schemas                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Accepts the price a creator typed in rupees and yields integer paise.
 * Out-of-range values are rejected rather than silently clamped, so a typo can
 * never turn into an unintended charge.
 */
/** ₹1,00,00,000 — a sane ceiling for a single course. */
export const MAX_PRICE_PAISE = 100_000_000_00;

export const inrPriceInputSchema = z
  .union([z.string(), z.number()])
  .transform((value, ctx): number => {
    try {
      return rupeesToPaise(value);
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        message: error instanceof Error ? error.message : "Invalid price",
      });
      return z.NEVER;
    }
  })
  .refine((paise) => paise >= 0, { message: "Price cannot be negative" })
  .refine((paise) => paise <= MAX_PRICE_PAISE, { message: "Price exceeds the maximum allowed" });

/** Schema for the `currency` field on any client-supplied payload. */
export const inrCurrencySchema = z.literal(CURRENCY, {
  error: "Zybble only supports INR (₹)",
});
