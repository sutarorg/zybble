/**
 * Admin portal presentation helpers.
 *
 * Pure formatting only. Marketplace figures are computed server-side in
 * `@/lib/server/admin` from real orders, ledger entries and Razorpay Route
 * state — nothing is generated for display.
 */

import { formatInr, formatInrExact, paiseToRupees } from "@/lib/money";

/** Formats integer paise as INR. */
export function money(paise: number): string {
  return formatInr(paise);
}

export function moneyExact(paise: number): string {
  return formatInrExact(paise);
}

/** Commission split for an order item, re-derived from the stored paise values. */
export function commissionOf(order: {
  totalPaise: number;
  commissionPaise: number;
}): { platformPaise: number; creatorPaise: number; effectiveRateBps: number } {
  const platformPaise = Number(order.commissionPaise ?? 0);
  return {
    platformPaise,
    creatorPaise: Number(order.totalPaise ?? 0) - platformPaise,
    effectiveRateBps:
      Number(order.totalPaise ?? 0) > 0
        ? Math.round((platformPaise * 10_000) / Number(order.totalPaise))
        : 0,
  };
}

export function creatorShareOf(order: { totalPaise: number; commissionPaise: number }): number {
  return commissionOf(order).creatorPaise;
}

/* -------------------------------------------------------------------------- */
/* CSV export                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Builds a CSV string from server-fetched rows and hands it to the browser.
 * Values are escaped, and a leading `=`/`+`/`-`/`@` is prefixed with `'` so a
 * spreadsheet never evaluates a cell as a formula.
 */
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>
): void {
  const escape = (value: string | number | null | undefined): string => {
    let text = value === null || value === undefined ? "" : String(value);
    if (/^[=+\-@]/.test(text)) text = `'${text}`;
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const csv = [headers, ...rows].map((row) => row.map(escape).join(",")).join("\r\n");
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Renders paise for a CSV cell, e.g. `₹1,299.00`. */
export function csvMoney(paise: number): string {
  return `INR ${paiseToRupees(paise)}`;
}

/* -------------------------------------------------------------------------- */
/* Marketplace-wide series                                                    */
/* -------------------------------------------------------------------------- */

export interface AdminSeriesPoint {
  label: string;
  revenuePaise: number;
  orders: number;
  enrollments: number;
}

/** Passes real, server-computed points straight to the chart components. */
export function adminSeries(points: AdminSeriesPoint[]): Array<{ label: string; value: number }> {
  return points.map((point) => ({ label: point.label, value: point.revenuePaise }));
}