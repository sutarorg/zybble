/**
 * Formatting for admin figures.
 *
 * Money is formatted from integer cents and never from a float, so a value
 * like 1500 can only ever render as $15.00. A null amount renders as an
 * em-dash rather than $0.00: "unknown" and "zero" are very different claims to
 * make about revenue, and this dashboard must not conflate them.
 */

import { format, formatDistanceToNowStrict } from "date-fns";

export function formatMoney(cents: number | null, currency = "USD"): string {
  if (cents === null) return "—";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    // No cents when the amount is a whole number of dollars — an MRR figure
    // reads better as $1,240 than $1,240.00.
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function formatNumber(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return format(new Date(iso), "d MMM yyyy");
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return format(new Date(iso), "d MMM yyyy, HH:mm");
}

export function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  return `${formatDistanceToNowStrict(new Date(iso))} ago`;
}

const TITLE_CASE = /\b[a-z]/g;

/** `post.published` → `Post published`, for action names in the audit trail. */
export function humaniseAction(action: string): string {
  const spaced = action.replace(/[._-]/g, " ").trim();
  if (!spaced) return action;

  return spaced.replace(TITLE_CASE, (character) => character.toUpperCase());
}
