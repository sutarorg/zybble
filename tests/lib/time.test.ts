import { describe, expect, it } from "vitest";
import {
  InvalidTimeZoneError,
  InvalidWallTimeError,
  addDays,
  formatInZone,
  isValidTimeZone,
  startOfUtcDay,
  toIsoDate,
  usagePeriod,
  weekdayAndHourInZone,
  zoneOffsetMinutes,
  zonedWallTimeToUtc,
} from "@/lib/time";

/**
 * Scheduling is the one place in the product where a date bug silently costs the
 * user a post, so the timezone layer is tested against real DST transitions
 * rather than fixed offsets.
 */

describe("isValidTimeZone", () => {
  it("accepts IANA zones", () => {
    expect(isValidTimeZone("Europe/London")).toBe(true);
    expect(isValidTimeZone("America/New_York")).toBe(true);
    expect(isValidTimeZone("Asia/Kolkata")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isValidTimeZone("GMT+5")).toBe(false);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });

  it("throws a typed error from assertTimeZone", () => {
    expect(() => formatInZone(new Date(), "Not/AZone")).toThrow(InvalidTimeZoneError);
  });
});

describe("zonedWallTimeToUtc", () => {
  it("converts a wall time in a fixed-offset zone", () => {
    // Asia/Kolkata is UTC+05:30 year round.
    const utc = zonedWallTimeToUtc({ date: "2026-03-10", time: "09:30", timeZone: "Asia/Kolkata" });
    expect(utc.toISOString()).toBe("2026-03-10T04:00:00.000Z");
  });

  it("handles the European spring-forward transition (BST, UTC+1)", () => {
    // 2026-03-29: clocks jump 01:00 → 02:00 in London.
    const utc = zonedWallTimeToUtc({ date: "2026-03-29", time: "12:00", timeZone: "Europe/London" });
    expect(utc.toISOString()).toBe("2026-03-29T11:00:00.000Z");
  });

  it("handles the European autumn transition (GMT, UTC+0)", () => {
    // 2026-10-25: clocks fall back 02:00 → 01:00.
    const utc = zonedWallTimeToUtc({ date: "2026-10-25", time: "12:00", timeZone: "Europe/London" });
    expect(utc.toISOString()).toBe("2026-10-25T12:00:00.000Z");
  });

  it("keeps the chosen wall time across a DST boundary (the scheduling promise)", () => {
    // A weekly slot at 09:00 America/New_York must show 09:00 local in both
    // January (EST) and July (EDT).
    const winter = zonedWallTimeToUtc({ date: "2026-01-15", time: "09:00", timeZone: "America/New_York" });
    const summer = zonedWallTimeToUtc({ date: "2026-07-15", time: "09:00", timeZone: "America/New_York" });

    expect(formatInZone(winter, "America/New_York").time).toBe("09:00");
    expect(formatInZone(summer, "America/New_York").time).toBe("09:00");
    // ...while the UTC instants differ by an hour, which is exactly the point.
    expect(winter.toISOString()).not.toBe(summer.toISOString());
  });

  it("produces an unambiguous instant for a non-existent local time", () => {
    // 02:30 on spring-forward day does not exist in New York; the conversion
    // still returns a concrete instant rather than throwing.
    const utc = zonedWallTimeToUtc({ date: "2026-03-08", time: "02:30", timeZone: "America/New_York" });
    expect(Number.isNaN(utc.getTime())).toBe(false);
    // Rolled forward onto the first instant that does exist (03:30 EDT).
    expect(formatInZone(utc, "America/New_York").time).toBe("03:30");
  });

  it("can refuse a non-existent local time instead of rolling it forward", () => {
    // Scheduling is the one place where silence is dangerous: publishing an
    // hour later than the author asked for is worse than rejecting the slot.
    expect(() =>
      zonedWallTimeToUtc({
        date: "2026-03-08",
        time: "02:30",
        timeZone: "America/New_York",
        onNonexistent: "error",
      }),
    ).toThrow(InvalidWallTimeError);

    // A neighbouring slot that does exist is unaffected.
    expect(
      zonedWallTimeToUtc({
        date: "2026-03-08",
        time: "09:30",
        timeZone: "America/New_York",
        onNonexistent: "error",
      }).toISOString(),
    ).toBe("2026-03-08T13:30:00.000Z");
  });

  it("resolves an ambiguous fall-back time to the first occurrence", () => {
    // 2026-11-01 01:30 happens twice in New York; the earlier (EDT) one wins.
    const utc = zonedWallTimeToUtc({
      date: "2026-11-01",
      time: "01:30",
      timeZone: "America/New_York",
      onNonexistent: "error",
    });
    expect(utc.toISOString()).toBe("2026-11-01T05:30:00.000Z");
  });

  it("rejects impossible calendar dates", () => {
    expect(() =>
      zonedWallTimeToUtc({ date: "2026-02-30", time: "10:00", timeZone: "UTC" }),
    ).toThrow();
  });
});

describe("formatInZone", () => {
  it("reports the local wall time and weekday", () => {
    // 2026-05-06 22:30 UTC is 2026-05-07 04:00 in Kolkata (a Thursday).
    const result = formatInZone(new Date("2026-05-06T22:30:00.000Z"), "Asia/Kolkata");
    expect(result.date).toBe("2026-05-07");
    expect(result.time).toBe("04:00");
    expect(result.hour).toBe(4);
    expect(result.weekday).toBe(3); // Thursday, 0 = Monday
  });

  it("round-trips through zonedWallTimeToUtc", () => {
    const instant = zonedWallTimeToUtc({
      date: "2026-12-31",
      time: "23:45",
      timeZone: "Pacific/Auckland",
    });
    const back = formatInZone(instant, "Pacific/Auckland");
    expect(`${back.date} ${back.time}`).toBe("2026-12-31 23:45");
  });
});

describe("weekdayAndHourInZone", () => {
  it("maps Sunday to 6 with Monday = 0", () => {
    const result = weekdayAndHourInZone(new Date("2026-05-10T15:00:00.000Z"), "UTC");
    expect(result.weekday).toBe(6);
    expect(result.hour).toBe(15);
  });
});

describe("zoneOffsetMinutes", () => {
  it("returns 330 for Kolkata and -300 for New York in winter", () => {
    expect(zoneOffsetMinutes(new Date("2026-01-15T12:00:00Z"), "Asia/Kolkata")).toBe(330);
    expect(zoneOffsetMinutes(new Date("2026-01-15T12:00:00Z"), "America/New_York")).toBe(-300);
    expect(zoneOffsetMinutes(new Date("2026-07-15T12:00:00Z"), "America/New_York")).toBe(-240);
  });
});

describe("calendar helpers", () => {
  it("usagePeriod is yyyy-MM in UTC", () => {
    expect(usagePeriod(new Date("2026-05-31T23:59:59.000Z"))).toBe("2026-05");
  });

  it("startOfUtcDay truncates to midnight UTC", () => {
    expect(startOfUtcDay(new Date("2026-05-06T18:24:00.000Z")).toISOString()).toBe(
      "2026-05-06T00:00:00.000Z",
    );
  });

  it("toIsoDate and addDays agree across a month boundary", () => {
    const day = new Date("2026-01-31T00:00:00.000Z");
    expect(toIsoDate(addDays(day, 1))).toBe("2026-02-01");
  });
});
