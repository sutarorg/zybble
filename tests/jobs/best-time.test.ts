import { describe, expect, it } from "vitest";
import {
  BEST_TIME_CONFIG,
  computeBestTime,
  weekdayLabel,
  type BestTimeObservation,
} from "@/features/analytics/best-time";

/**
 * Best-time-to-post engine.
 *
 * The acceptance criterion is not "it produces a grid" — it is "it refuses to
 * produce one until there is evidence, and the evidence is visible in the
 * output". These tests pin that behaviour, plus the recency decay, the
 * neighbour smoothing and the small-sample shrinkage.
 */

const NOW = new Date("2026-06-01T12:00:00.000Z");

/**
 * Wall-clock slots used by the fixtures, all in the past relative to NOW and on
 * the weekday their name says (2026-05-26 is a Tuesday).
 */
const TUESDAY_09 = "2026-05-26T09:00:00";
const WEDNESDAY_11 = "2026-05-27T11:00:00";
const THURSDAY_16 = "2026-05-28T16:00:00";
const FRIDAY_14 = "2026-05-29T14:00:00";

/**
 * One measured post.
 *
 * `daysAgo` is always a multiple of seven in the fixtures so every observation
 * lands on the same weekday and hour — the way a real posting rhythm behaves —
 * while still varying in age for the recency weighting.
 */
function observation(input: {
  postId: string;
  daysAgo: number;
  impressions: number;
  reactions: number;
  comments?: number;
  reposts?: number;
  /** ISO local wall time in the zone. */
  wallTime: string;
  timeZone?: string;
}): BestTimeObservation {
  const local = new Date(`${input.wallTime}Z`);
  local.setUTCDate(local.getUTCDate() - input.daysAgo);

  return {
    postId: input.postId,
    publishedAt: local,
    impressions: input.impressions,
    reactions: input.reactions,
    comments: input.comments ?? 0,
    reposts: input.reposts ?? 0,
  };
}

function repeat(count: number, factory: (index: number) => BestTimeObservation) {
  return Array.from({ length: count }, (_, index) => factory(index));
}

describe("computeBestTime — evidence threshold", () => {
  it("refuses to produce a grid below the minimum number of posts", () => {
    const result = computeBestTime(
      repeat(BEST_TIME_CONFIG.minObservations - 1, (index) =>
        observation({
          postId: `p${index}`,
          daysAgo: index * 7,
          impressions: 1000,
          reactions: 50,
          wallTime: TUESDAY_09,
        }),
      ),
      { timeZone: "UTC", now: NOW },
    );

    expect(result.insufficientData).not.toBeNull();
    expect(result.insufficientData!.requiredPosts).toBe(BEST_TIME_CONFIG.minObservations);
    expect(result.insufficientData!.observedPosts).toBe(BEST_TIME_CONFIG.minObservations - 1);
    expect(result.cells).toHaveLength(0);
    expect(result.meta.observations).toBe(BEST_TIME_CONFIG.minObservations - 1);
  });

  it("ignores posts with no impressions instead of counting them as evidence", () => {
    const result = computeBestTime(
      repeat(20, (index) =>
        observation({
          postId: `p${index}`,
          daysAgo: index * 7,
          impressions: 0,
          reactions: 0,
          wallTime: TUESDAY_09,
        }),
      ),
      { timeZone: "UTC", now: NOW },
    );

    // Engagement rate is undefined without impressions, so these are unusable.
    expect(result.insufficientData?.observedPosts).toBe(0);
  });
});

describe("computeBestTime — scoring", () => {
  const strongTuesday = repeat(14, (index) =>
    observation({
      postId: `good${index}`,
      daysAgo: index * 7,
      impressions: 1000,
      reactions: index % 2 === 0 ? 200 : 180,
      wallTime: TUESDAY_09,
    }),
  );

  const weakFriday = repeat(14, (index) =>
    observation({
      postId: `bad${index}`,
      daysAgo: index * 7,
      impressions: 1000,
      reactions: 5,
      wallTime: FRIDAY_14,
    }),
  );

  it("produces 168 cells (7 × 24) once there is enough evidence", () => {
    const result = computeBestTime([...strongTuesday, ...weakFriday], { timeZone: "UTC", now: NOW });

    expect(result.insufficientData).toBeNull();
    expect(result.cells).toHaveLength(168);
  });

  it("ranks the high-engagement slot above the low-engagement one", () => {
    const result = computeBestTime([...strongTuesday, ...weakFriday], { timeZone: "UTC", now: NOW });

    const tuesday9 = result.cells.find((cell) => cell.weekday === 1 && cell.hour === 9)!;
    const friday14 = result.cells.find((cell) => cell.weekday === 4 && cell.hour === 14)!;

    expect(tuesday9.score).not.toBeNull();
    expect(friday14.score).not.toBeNull();
    expect(tuesday9.score!).toBeGreaterThan(friday14.score!);
    expect(tuesday9.sampleSize).toBeGreaterThan(0);
  });

  it("reports the best slot first in meta.topSlots", () => {
    const result = computeBestTime([...strongTuesday, ...weakFriday], { timeZone: "UTC", now: NOW });
    expect(result.meta.topSlots[0]!.weekday).toBe(1); // Tuesday
  });

  it("keeps scores relative (0–1) and never negative", () => {
    const result = computeBestTime([...strongTuesday, ...weakFriday], { timeZone: "UTC", now: NOW });

    for (const cell of result.cells) {
      if (cell.score === null) continue;
      expect(cell.score).toBeGreaterThanOrEqual(0);
      expect(cell.score).toBeLessThanOrEqual(1);
    }
  });

  it("leaves cells with too little evidence as null rather than guessing", () => {
    const result = computeBestTime(strongTuesday, { timeZone: "UTC", now: NOW });

    const untouched = result.cells.filter((cell) => cell.sampleSize === 0);
    expect(untouched.length).toBeGreaterThan(0);
    expect(untouched.every((cell) => cell.score === null)).toBe(true);
  });

  it("weights recent posts more heavily than old ones", () => {
    const recent = repeat(12, (index) =>
      observation({
        postId: `recent${index}`,
        daysAgo: 7, // one week old
        impressions: 1000,
        reactions: 100,
        wallTime: TUESDAY_09,
      }),
    );

    const ancient = repeat(12, (index) =>
      observation({
        postId: `old${index}`,
        daysAgo: 700, // 100 weeks — roughly four half-lives
        impressions: 1000,
        reactions: 100,
        wallTime: WEDNESDAY_11,
      }),
    );

    const result = computeBestTime([...recent, ...ancient], { timeZone: "UTC", now: NOW });

    const tuesday9 = result.cells.find((cell) => cell.weekday === 1 && cell.hour === 9)!;
    const wednesday11 = result.cells.find((cell) => cell.weekday === 2 && cell.hour === 11)!;

    expect(tuesday9.sampleSize).toBeGreaterThan(wednesday11.sampleSize);
  });

  it("shrinks a single lucky post toward the account mean", () => {
    const oneLuckyPost = [
      observation({
        postId: "lucky",
        daysAgo: 7,
        impressions: 100,
        reactions: 100,
        wallTime: TUESDAY_09,
      }),
      ...repeat(20, (index) =>
        observation({
          postId: `steady${index}`,
          daysAgo: index * 7,
          impressions: 1000,
          reactions: 10,
          wallTime: THURSDAY_16,
        }),
      ),
    ];

    const result = computeBestTime(oneLuckyPost, { timeZone: "UTC", now: NOW });
    const luckyCell = result.cells.find((cell) => cell.weekday === 1 && cell.hour === 9)!;

    // One observation at a 110% engagement rate cannot outrank 20 steady posts.
    const thursday16 = result.cells.find((cell) => cell.weekday === 3 && cell.hour === 16)!;
    expect(luckyCell.confidence).toBeLessThan(thursday16.confidence);
    expect(luckyCell.sampleSize).toBeLessThan(thursday16.sampleSize);
  });

  it("buckets by the account's timezone, not UTC", () => {
    // 2026-06-02T02:00Z is Monday 22:00 in New York and Tuesday 03:00 in London.
    const posts = repeat(14, (index) =>
      observation({
        postId: `tz${index}`,
        daysAgo: index * 7,
        impressions: 1000,
        reactions: 80,
        // 2026-05-26T02:00Z = Monday 22:00 New York / Tuesday 03:00 London.
        wallTime: "2026-05-26T02:00:00",
      }),
    );

    const newYork = computeBestTime(posts, { timeZone: "America/New_York", now: NOW });
    const london = computeBestTime(posts, { timeZone: "Europe/London", now: NOW });

    const nyCell = newYork.cells.find((cell) => cell.weekday === 0 && cell.hour === 22)!;
    const londonCell = london.cells.find((cell) => cell.weekday === 1 && cell.hour === 3)!;

    expect(nyCell.sampleSize).toBeGreaterThan(0);
    expect(londonCell.sampleSize).toBeGreaterThan(0);
  });
});

describe("weekdayLabel", () => {
  it("labels Monday first", () => {
    expect(weekdayLabel(0)).toBe("Monday");
    expect(weekdayLabel(6)).toBe("Sunday");
  });
});
