import { getDictionary } from "./i18n";
import { formatInr, formatInrOrFree } from "./money";

/**
 * Formatting helpers shared across the app.
 *
 * Money is ALWAYS INR. `formatPrice` takes integer paise; there is no currency
 * argument anywhere in Zybble because there is no second currency.
 */

/** Formats integer paise as an Indian-format rupee amount (₹1,49,900). */
export function formatPrice(paise: number, locale = "en-IN"): string {
  return formatInr(paise, locale);
}

/** Same as {@link formatPrice} but renders "Free" for a zero-paise course. */
export function formatCoursePrice(paise: number, locale = "en-IN"): string {
  return formatInrOrFree(paise, locale, getDictionary("en").free ?? "Free");
}

/** 95 -> "1h 35m", 45 -> "45m", 480 -> "8h" */
export function formatDuration(minutes: number, language = "en"): string {
  const d = getDictionary(language);
  if (minutes < 60) return d.minutes(minutes);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? d.hours(h) : `${d.hours(h)} ${d.minutes(m)}`;
}

/** 480 -> "8 hours", 90 -> "1.5 hours" (compact card label) */
export function formatHours(minutes: number): string {
  const hours = Math.round((minutes / 60) * 2) / 2;
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

/** Indian digit grouping for plain counts (1,23,456). */
export function formatCount(n: number): string {
  return new Intl.NumberFormat("en-IN").format(n);
}

export function formatCompact(n: number): string {
  return new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

/** `2026-01-12` style strings carry no timezone — format them in UTC so the
 *  server-rendered and client-rendered markup always agree. */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function dateOptions(iso: string): Intl.DateTimeFormatOptions {
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
  };
  if (DATE_ONLY.test(iso.trim())) options.timeZone = "UTC";
  return options;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", dateOptions(iso));
}

export function formatMonthYear(iso: string): string {
  const options: Intl.DateTimeFormatOptions = { year: "numeric", month: "long" };
  if (DATE_ONLY.test(iso.trim())) options.timeZone = "UTC";
  return new Date(iso).toLocaleDateString("en-IN", options);
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${Math.max(minutes, 1)}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

export function initialsOf(name: string): string {
  return (
    name
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "Z"
  );
}
