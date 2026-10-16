/**
 * Catalog engagement tracking (browser side).
 *
 * Feeds the creator studio's Analytics page with three honest signals:
 *
 *   - **impression** — a course card actually entered the viewport. Counted once
 *     per course per page load, so scrolling a grid up and down does not
 *     manufacture reach.
 *   - **view**         — a course page was opened. Counted once per page load.
 *   - **watch**        — whole seconds of lesson playback, sent as a heartbeat.
 *
 * Nothing here is trusted by the server: `/api/analytics/track` re-checks that
 * every course is published and that a `watch` event belongs to a signed-in
 * learner, and caps the seconds a single beacon can claim. Analytics are also
 * the one place where a dropped event is acceptable, so every failure is
 * swallowed — a blocked beacon must never surface as an error to a learner.
 */

export type CourseEventKind = "impression" | "view" | "watch";

export interface CourseEventInput {
  courseId: string;
  kind: CourseEventKind;
  /** `watch` only. */
  lessonId?: string;
  /** `watch` only: whole seconds since the last heartbeat. */
  seconds?: number;
  /** Where it happened, e.g. `explore`, `search`, `course-page`, `player`. */
  source?: string;
}

/** Matches the server's batch cap so a flush is never rejected for size. */
export const MAX_EVENTS_PER_REQUEST = 40;
const FLUSH_DELAY_MS = 4_000;

const queue: CourseEventInput[] = [];
/** Impression/view dedupe keys already reported in this page load. */
const reported = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let listenersBound = false;

function bindLifecycle() {
  if (listenersBound || typeof window === "undefined") return;
  listenersBound = true;
  // A beacon on the way out is the only reliable delivery for a page that is
  // being closed or backgrounded mid-scroll.
  window.addEventListener("pagehide", () => flushCourseEvents({ beacon: true }), { once: false });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushCourseEvents({ beacon: true });
  });
}

/**
 * Queues one event. Impressions and views are deduplicated per page load;
 * watch heartbeats never are, because each one carries new seconds.
 */
export function trackCourseEvent(event: CourseEventInput): void {
  if (typeof window === "undefined") return;
  bindLifecycle();

  if (event.kind !== "watch") {
    const key = `${event.kind}:${event.courseId}:${event.source ?? ""}`;
    if (reported.has(key)) return;
    reported.add(key);
  }

  queue.push(event);
  if (queue.length >= MAX_EVENTS_PER_REQUEST) {
    void flushCourseEvents();
    return;
  }
  if (flushTimer === null) {
    flushTimer = setTimeout(() => void flushCourseEvents(), FLUSH_DELAY_MS);
  }
}

/** Sends everything queued. Safe to call repeatedly and from event handlers. */
export async function flushCourseEvents(options: { beacon?: boolean } = {}): Promise<void> {
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (queue.length === 0) return;

  const batch = queue.splice(0, MAX_EVENTS_PER_REQUEST);
  const body = JSON.stringify({ events: batch });

  try {
    if (options.beacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
      const sent = navigator.sendBeacon("/api/analytics/track", new Blob([body], { type: "application/json" }));
      // A rejected beacon (usually a payload cap) puts the batch back for the
      // next fetch-based flush rather than dropping it.
      if (!sent) queue.unshift(...batch);
      return;
    }
    await fetch("/api/analytics/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    });
  } catch {
    // Telemetry is best-effort by design.
  }
}

/** Whole seconds of playback credited to one heartbeat. */
export const WATCH_HEARTBEAT_SECONDS = 15;

/**
 * Compact label for the surface a card was seen on, so a creator can tell
 * search reach from homepage reach. Unknown paths collapse to `catalog`.
 */
export function impressionSource(pathname: string | null | undefined): string {
  const path = (pathname ?? "").replace(/\/+$/, "");
  if (path === "" || path === "/") return "home";
  if (path.startsWith("/explore")) return "explore";
  if (path.startsWith("/search")) return "search";
  if (path.startsWith("/categories")) return "category";
  if (path.startsWith("/instructors")) return "instructor";
  if (path.startsWith("/courses")) return "related";
  if (path.startsWith("/dashboard")) return "dashboard";
  if (path.startsWith("/wishlist")) return "wishlist";
  return "catalog";
}
