/**
 * Counters for the learner sidebar.
 *
 * These are read on the server from Postgres and passed down as plain props, so
 * the navigation cannot display a number the database does not support. The
 * streak panel is included here for the same reason: a streak is a claim about
 * what the learner actually did, so it is computed from `lesson_progress`
 * completions rather than illustrated with a fixed number of bars.
 */
export interface SidebarCounts {
  enrollmentCount: number;
  wishlistCount: number;
  certificateCount: number;
  /** Daily goal in minutes, from `learner_preferences`. */
  goalMinutesPerDay: number;
  /** Consecutive days with at least one completed lesson, ending today or yesterday. */
  streakDays: number;
  /** The last seven days, oldest first: did the learner complete a lesson that day? */
  activeDays: boolean[];
  /** Lessons completed inside those same seven days. */
  lessonsThisWeek: number;
}
