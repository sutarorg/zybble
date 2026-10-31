/**
 * Timezone and date arithmetic.
 *
 * Rules this module exists to enforce:
 *  * every instant the database stores is UTC (`timestamptz`);
 *  * a user's wall-clock intent ("Tuesday 09:30") is captured together with the
 *    IANA zone they were looking at, and converted exactly once, here;
 *  * daylight-saving transitions are handled explicitly — a nonexistent local
 *    time is pushed forward, an ambiguous one resolves to the first occurrence,
 *    and both behaviours are covered by tests.
 *
 * Implemented on `Intl` only, so it works identically in the Node runtime, the
 * Edge runtime and Inngest workers.
 */

export type WallTime = {
  /** `YYYY-MM-DD` */
  date: string;
  /** `HH:mm` (24-hour) */
  time: string;
  timeZone: string;
  /**
   * What to do when the requested wall time falls in a spring-forward gap
   * (02:30 on the day the clock jumps 02:00→03:00).
   *
   *  * `"roll-forward"` (default) — return the first instant that does exist.
   *    Right for background jobs reconciling an existing schedule.
   *  * `"error"` — throw `InvalidWallTimeError`. Right for an interactive
   *    schedule picker: silently publishing an hour later than the author
   *    asked for is worse than asking them to pick another slot.
   */
  onNonexistent?: "roll-forward" | "error";
};

export class InvalidTimeZoneError extends Error {
  constructor(timeZone: string) {
    super(`Unknown IANA time zone: ${timeZone}`);
    this.name = "InvalidTimeZoneError";
  }
}

export class InvalidWallTimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidWallTimeError";
  }
}

const zoneFormatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = zoneFormatters.get(timeZone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  zoneFormatters.set(timeZone, formatter);
  return formatter;
}

export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function assertTimeZone(timeZone: string): string {
  if (!isValidTimeZone(timeZone)) throw new InvalidTimeZoneError(timeZone);
  return timeZone;
}

type Parts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function partsInZone(instant: Date, timeZone: string): Parts {
  const parts = formatterFor(timeZone).formatToParts(instant);
  const lookup: Record<string, number> = {};

  for (const part of parts) {
    if (part.type !== "literal") lookup[part.type] = Number(part.value);
  }

  // Intl renders midnight as hour 24 under hourCycle h24 in some engines.
  const hour = lookup.hour === 24 ? 0 : lookup.hour;

  return {
    year: lookup.year,
    month: lookup.month,
    day: lookup.day,
    hour,
    minute: lookup.minute,
    second: lookup.second,
  };
}

/** Offset in minutes that `timeZone` is ahead of UTC at `instant`. */
export function zoneOffsetMinutes(instant: Date, timeZone: string): number {
  assertTimeZone(timeZone);
  const parts = partsInZone(instant, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60000);
}

/**
 * Convert a wall-clock time in `timeZone` to the UTC instant it represents.
 *
 * DST behaviour:
 *  * spring-forward gap (e.g. 02:30 does not exist) → rolls forward to the
 *    first existing instant after the gap, or throws when the caller asks with
 *    `onNonexistent: "error"`;
 *  * fall-back overlap (e.g. 01:30 happens twice) → resolves to the earlier
 *    occurrence.
 */
export function zonedWallTimeToUtc({
  date,
  time,
  timeZone,
  onNonexistent = "roll-forward",
}: WallTime): Date {
  assertTimeZone(timeZone);

  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);

  if (!dateMatch || !timeMatch) {
    throw new InvalidWallTimeError(`Expected date "YYYY-MM-DD" and time "HH:mm", received "${date} ${time}"`);
  }

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);

  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) {
    throw new InvalidWallTimeError(`Out-of-range wall time: ${date} ${time}`);
  }

  // Date.UTC rolls 2026-02-30 forward to 2026-03-02; a calendar day that does
  // not exist must be rejected instead of silently scheduling the wrong date.
  const daysInMonth = new Date(Date.UTC(year, month, 0, 12)).getUTCDate();

  if (day > daysInMonth) {
    throw new InvalidWallTimeError(`${date} is not a date (${month} has ${daysInMonth} days)`);
  }

  const naive = Date.UTC(year, month - 1, day, hour, minute, 0);

  // First estimate using the offset at the naive instant, then refine: the
  // offset at the adjusted instant can differ across a DST boundary.
  let candidate = naive - zoneOffsetMinutes(new Date(naive), timeZone) * 60_000;
  candidate = naive - zoneOffsetMinutes(new Date(candidate), timeZone) * 60_000;

  // Spring-forward gap: the local clock jumps past the requested time, so the
  // candidate renders later than asked. Pull it back to the wall time that
  // actually exists by applying the offset shift once more.
  const rendered = partsInZone(new Date(candidate), timeZone);
  const renderedMs = Date.UTC(rendered.year, rendered.month - 1, rendered.day, rendered.hour, rendered.minute, 0);

  if (renderedMs !== naive) {
    if (onNonexistent === "error") {
      throw new InvalidWallTimeError(
        `${time} does not exist on ${date} in ${timeZone}: daylight saving moves the clock ` +
          `${pad(hour)}:${pad(minute)} past that time. Choose a different slot.`,
      );
    }

    const driftMinutes = Math.round((renderedMs - naive) / 60_000);
    candidate -= driftMinutes * 60_000;
  }

  return new Date(candidate);
}

/** The inverse: which wall-clock time does this instant show in `timeZone`? */
export function formatInZone(
  instant: Date,
  timeZone: string,
): { date: string; time: string; weekday: number; hour: number } {
  assertTimeZone(timeZone);

  const parts = partsInZone(instant, timeZone);
  const weekday = weekdayFromParts(parts);

  return {
    date: `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`,
    time: `${pad(parts.hour)}:${pad(parts.minute)}`,
    weekday,
    hour: parts.hour,
  };
}

/** 0 = Monday … 6 = Sunday, matching the best-time grid. */
export function weekdayFromParts(parts: {
  year: number;
  month: number;
  day: number;
}): number {
  const jsDay = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  return (jsDay + 6) % 7;
}

export function weekdayAndHourInZone(
  instant: Date,
  timeZone: string,
): { weekday: number; hour: number } {
  const parts = partsInZone(instant, timeZone);
  return { weekday: weekdayFromParts(parts), hour: parts.hour };
}

/** Calendar-month key used by the Free-plan scheduled-post quota. */
export function usagePeriod(instant: Date = new Date()): string {
  return `${instant.getUTCFullYear()}-${pad(instant.getUTCMonth() + 1)}`;
}

export function addDays(instant: Date, days: number): Date {
  return new Date(instant.getTime() + days * 86_400_000);
}

export function startOfUtcDay(instant: Date): Date {
  return new Date(
    Date.UTC(instant.getUTCFullYear(), instant.getUTCMonth(), instant.getUTCDate()),
  );
}

export function toIsoDate(instant: Date): string {
  return instant.toISOString().slice(0, 10);
}

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}
