/**
 * Counters for the learner sidebar.
 *
 * These are read on the server from Postgres and passed down as plain props, so
 * the navigation cannot display a number the database does not support.
 */
export interface SidebarCounts {
  enrollmentCount: number;
  wishlistCount: number;
  certificateCount: number;
}