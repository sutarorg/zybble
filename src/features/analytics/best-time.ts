import { weekdayAndHourInZone } from "@/lib/time";

/**
 * Best-time-to-post engine.
 *
 * Design principles, in priority order:
 *
 *  1. **Evidence only.** The grid is built exclusively from the connected
 *     account's own published posts and their LinkedIn-reported metrics. No
 *     industry benchmark, no global average, no "typically best time".
 *  2. **Refuse to guess.** Below MIN_OBSERVATIONS qualifying posts the engine
 *     returns an explicit insufficient-data result instead of a grid, and every
 *     score it does produce carries its sample size and confidence.
 *  3. **Honest uncertainty.** Scores are *relative* — 1.0 is the best slot this
 *     account has data for, not a promise. Small samples are shrunk toward the
 *     account's own mean (empirical-Bayes style) so a single lucky post cannot
 *     crown a time slot.
 *  4. **Recency matters.** Older observations decay with a configurable
 *     half-life; audiences drift and last year's rhythm is weak evidence.
 *
 * Method
 * ------
 *  engagementRate = (reactions + comments + reposts) / impressions
 *  weight         = 0.5 ** (ageDays / halfLifeDays)
 *  neighbour smoothing: a cell borrows half-weight from the hours either side
 *  shrunkScore    = (Σ w·er + k·globalMean) / (Σ w + k)      k = PRIOR_STRENGTH
 *  normalised     = shrunkScore / max(shrunkScore)
 *  confidence     = Σw / (Σw + k)   clamped to [0, 1]
 */

export type BestTimeObservation = {
  postId: string;
  publishedAt: Date;
  impressions: number | null;
  reactions: number | null;
  comments: number | null;
  reposts: number | null;
};

export type BestTimeCellResult = {
  /** 0 = Monday … 6 = Sunday, in the account timezone. */
  weekday: number;
  /** 0–23, account-local. */
  hour: number;
  /** Relative score in [0,1]; null when the cell has too little evidence. */
  score: number | null;
  /** Weighted sample size behind the score. */
  sampleSize: number;
  /** 0–1. Low confidence means "interesting, not actionable yet". */
  confidence: number;
  /** Raw (pre-normalisation) shrunk engagement rate. */
  engagementRate: number | null;
};

export type InsufficientData = {
  requiredPosts: number;
  observedPosts: number;
  requiredDays?: number;
};

export type BestTimeResult = {
  /** Always 7 × 24 = 168 cells, weekday-major. */
  cells: BestTimeCellResult[];
  /** Populated instead of `cells` when the evidence threshold is not met. */
  insufficientData: InsufficientData | null;
  meta: {
    timeZone: string;
    observations: number;
    halfLifeDays: number;
    priorStrength: number;
    minObservations: number;
    minCellSample: number;
    computedAt: string;
    /** Highest-scoring slots, best first. */
    topSlots: Array<{ weekday: number; hour: number; score: number }>;
  };
};

export const BEST_TIME_CONFIG = {
  /** Minimum number of measured posts before any recommendation is shown. */
  minObservations: 12,
  /** Minimum weighted samples for an individual cell to receive a score. */
  minCellSample: 2,
  /** Observations older than this contribute half as much per half-life. */
  halfLifeDays: 180,
  /** Pseudo-count pulling sparse cells toward the account mean. */
  priorStrength: 3,
  /** Weight applied to the neighbouring hour either side. */
  neighbourWeight: 0.5,
} as const;

const WEEKDAY_LABELS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export function weekdayLabel(weekday: number): string {
  return WEEKDAY_LABELS[weekday] ?? "Unknown";
}

function engagementRate(observation: BestTimeObservation): number | null {
  const { impressions, reactions, comments, reposts } = observation;

  if (!impressions || impressions <= 0) return null;

  const interactions = (reactions ?? 0) + (comments ?? 0) + (reposts ?? 0);
  return interactions / impressions;
}

export function computeBestTime(
  observations: BestTimeObservation[],
  options: {
    timeZone: string;
    now?: Date;
    config?: Partial<typeof BEST_TIME_CONFIG>;
  },
): BestTimeResult {
  const config = { ...BEST_TIME_CONFIG, ...(options.config ?? {}) };
  const now = options.now ?? new Date();

  const usable = observations
    .map((observation) => ({ observation, rate: engagementRate(observation) }))
    .filter((entry): entry is { observation: BestTimeObservation; rate: number } =>
      entry.rate !== null,
    );

  if (usable.length < config.minObservations) {
    return {
      cells: [],
      insufficientData: {
        requiredPosts: config.minObservations,
        observedPosts: usable.length,
      },
      meta: {
        timeZone: options.timeZone,
        observations: usable.length,
        halfLifeDays: config.halfLifeDays,
        priorStrength: config.priorStrength,
        minObservations: config.minObservations,
        minCellSample: config.minCellSample,
        computedAt: now.toISOString(),
        topSlots: [],
      },
    };
  }

  // Global (weighted) mean engagement rate — the prior every cell is shrunk to.
  let weightedRateSum = 0;
  let weightTotal = 0;

  const prepared = usable.map(({ observation, rate }) => {
    const ageDays = Math.max(
      0,
      (now.getTime() - observation.publishedAt.getTime()) / 86_400_000,
    );
    const weight = Math.pow(0.5, ageDays / config.halfLifeDays);
    const slot = weekdayAndHourInZone(observation.publishedAt, options.timeZone);

    weightedRateSum += weight * rate;
    weightTotal += weight;

    return { rate, weight, weekday: slot.weekday, hour: slot.hour };
  });

  const globalMean = weightTotal > 0 ? weightedRateSum / weightTotal : 0;

  // Accumulate per cell, with neighbour-hour smoothing.
  const accumulators = new Map<
    string,
    { weightedRate: number; weight: number; exactWeight: number }
  >();

  const add = (
    weekday: number,
    hour: number,
    rate: number,
    weight: number,
    isExact: boolean,
  ) => {
    const key = `${weekday}:${hour}`;
    const entry = accumulators.get(key) ?? { weightedRate: 0, weight: 0, exactWeight: 0 };
    entry.weightedRate += weight * rate;
    entry.weight += weight;
    if (isExact) entry.exactWeight += weight;
    accumulators.set(key, entry);
  };

  for (const item of prepared) {
    add(item.weekday, item.hour, item.rate, item.weight, true);

    for (const offset of [-1, 1]) {
      const neighbourHour = (item.hour + offset + 24) % 24;
      // Crossing midnight moves the observation to the adjacent weekday.
      const neighbourWeekday =
        item.hour + offset < 0
          ? (item.weekday + 6) % 7
          : item.hour + offset > 23
            ? (item.weekday + 1) % 7
            : item.weekday;

      add(
        neighbourWeekday,
        neighbourHour,
        item.rate,
        item.weight * config.neighbourWeight,
        false,
      );
    }
  }

  const raw: Array<{
    weekday: number;
    hour: number;
    score: number;
    sampleSize: number;
    confidence: number;
    engagementRate: number;
  }> = [];

  for (let weekday = 0; weekday < 7; weekday += 1) {
    for (let hour = 0; hour < 24; hour += 1) {
      const entry = accumulators.get(`${weekday}:${hour}`);

      if (!entry || entry.exactWeight < config.minCellSample) {
        raw.push({
          weekday,
          hour,
          score: Number.NaN,
          sampleSize: entry ? Number(entry.exactWeight.toFixed(2)) : 0,
          confidence: 0,
          engagementRate: Number.NaN,
        });
        continue;
      }

      const shrunk =
        (entry.weightedRate + config.priorStrength * globalMean) /
        (entry.weight + config.priorStrength);

      raw.push({
        weekday,
        hour,
        score: shrunk,
        sampleSize: Number(entry.exactWeight.toFixed(2)),
        confidence: Number((entry.weight / (entry.weight + config.priorStrength)).toFixed(3)),
        engagementRate: shrunk,
      });
    }
  }

  const maxScore = raw.reduce((max, cell) => (Number.isNaN(cell.score) ? max : Math.max(max, cell.score)), 0);

  const cells: BestTimeCellResult[] = raw.map((cell) => ({
    weekday: cell.weekday,
    hour: cell.hour,
    score: Number.isNaN(cell.score) || maxScore <= 0 ? null : Number((cell.score / maxScore).toFixed(4)),
    sampleSize: cell.sampleSize,
    confidence: cell.confidence,
    engagementRate: Number.isNaN(cell.engagementRate)
      ? null
      : Number(cell.engagementRate.toFixed(4)),
  }));

  const topSlots = cells
    .filter((cell): cell is BestTimeCellResult & { score: number } => cell.score !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((cell) => ({ weekday: cell.weekday, hour: cell.hour, score: cell.score }));

  return {
    cells,
    insufficientData: null,
    meta: {
      timeZone: options.timeZone,
      observations: usable.length,
      halfLifeDays: config.halfLifeDays,
      priorStrength: config.priorStrength,
      minObservations: config.minObservations,
      minCellSample: config.minCellSample,
      computedAt: now.toISOString(),
      topSlots,
    },
  };
}
