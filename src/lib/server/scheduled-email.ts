/**
 * Scheduled learner email.
 *
 * The learner settings page offers three recurring messages — a weekly learning
 * report, a daily study reminder and a catalog digest. This module turns those
 * preferences into queued mail.
 *
 * There is no scheduler in the application: Zybble runs on serverless functions,
 * so recurring work is triggered by the same external cron that drains the
 * outbox (see `DEPLOYMENT.md` §7). That makes this function's contract important:
 *
 *   - **Idempotent.** Every message carries a bucketed idempotency key
 *     (`weekly-report:<userId>:<2026-W42>`), and `email_outbox.idempotency_key`
 *     is unique, so running this ten times on Monday sends one report.
 *   - **Bounded.** At most {@link MAX_LEARNERS_PER_RUN} messages per job per run.
 *     Learners already queued in the current bucket are excluded first, so the
 *     cap rotates through the audience instead of always serving the same page.
 *   - **Consent-checked.** `enqueueEmail` re-reads `learner_preferences` before
 *     writing, so a learner who turned a message off between the query and the
 *     insert still does not receive it.
 *
 * Scaling past the row bounds below needs a real job queue; that is recorded in
 * `LAUNCH_BLOCKERS.md` rather than hidden behind a larger constant.
 */

import "server-only";
import { createServiceClient, type ServiceClient } from "@/lib/supabase/server";
import { enqueueEmail } from "@/lib/server/email";
import { formatInr } from "@/lib/money";

/** Messages queued per job per run. */
const MAX_LEARNERS_PER_RUN = 200;
/** Preference rows read in one pass — the audience bound for a single run. */
const MAX_LEARNER_ROWS = 10_000;
/** Outbox keys read to find who is already queued for this bucket. */
const MAX_KNOWN_KEYS = 5_000;
/** Learners per `in (...)` batch when reading progress. */
const CHUNK = 50;

export interface ScheduledEmailSummary {
  learnersConsidered: number;
  weeklyReports: number;
  studyReminders: number;
  catalogDigests: number;
  /** Counted for honesty: consent refusals and duplicate buckets are not sends. */
  notQueued: number;
}

const EMPTY: ScheduledEmailSummary = {
  learnersConsidered: 0,
  weeklyReports: 0,
  studyReminders: 0,
  catalogDigests: 0,
  notQueued: 0,
};

interface Candidate {
  userId: string;
  email: string;
  name: string;
  weeklyReport: boolean;
  studyReminders: boolean;
  emailPromos: boolean;
}

/** `2026-10-16` in UTC — the whole platform buckets by UTC day. */
function dayBucket(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** ISO week, e.g. `2026-W42`. */
function weekBucket(now: Date): string {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayNumber = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Keys already in the outbox for this bucket, so a re-run queues nobody twice. */
async function queuedKeys(service: ServiceClient, prefix: string, bucket: string): Promise<Set<string>> {
  const { data } = await service
    .from("email_outbox")
    .select("idempotency_key")
    .like("idempotency_key", `${prefix}:%${bucket}`)
    .limit(MAX_KNOWN_KEYS);
  return new Set(((data ?? []) as Array<{ idempotency_key: string }>).map((row) => row.idempotency_key));
}

/**
 * Queues every recurring learner message that is due right now.
 *
 * Called from the outbox drain endpoint, which an external cron invokes. Safe to
 * call at any frequency.
 */
export async function queueScheduledLearnerEmails(now = new Date()): Promise<ScheduledEmailSummary> {
  const service = createServiceClient();
  if (!service) return EMPTY;

  const isMonday = now.getUTCDay() === 1;
  const day = dayBucket(now);
  const week = weekBucket(now);

  const { data: preferenceRows } = await service
    .from("learner_preferences")
    .select("user_id, weekly_report, study_reminders, email_promos, profiles ( id, email, full_name, status )")
    .or("weekly_report.eq.true,study_reminders.eq.true,email_promos.eq.true")
    .order("user_id")
    .limit(MAX_LEARNER_ROWS);

  const candidates: Candidate[] = ((preferenceRows ?? []) as Array<Record<string, unknown>>)
    .map((row) => {
      const profile = row.profiles as Record<string, unknown> | null;
      const email = String(profile?.email ?? "").trim().toLowerCase();
      if (!email || profile?.status !== "active") return null;
      return {
        userId: String(row.user_id),
        email,
        name: String(profile?.full_name ?? "there"),
        weeklyReport: Boolean(row.weekly_report),
        studyReminders: Boolean(row.study_reminders),
        emailPromos: Boolean(row.email_promos),
      } satisfies Candidate;
    })
    .filter((candidate): candidate is Candidate => candidate !== null);

  const summary: ScheduledEmailSummary = { ...EMPTY, learnersConsidered: candidates.length };
  if (candidates.length === 0) return summary;

  const weeklyCandidates = isMonday ? candidates.filter((c) => c.weeklyReport) : [];
  const reminderCandidates = candidates.filter((c) => c.studyReminders);
  const digestCandidates = isMonday ? candidates.filter((c) => c.emailPromos) : [];

  const [weeklyQueued, reminderQueued, digestQueued] = await Promise.all([
    isMonday ? queuedKeys(service, "weekly-report", week) : Promise.resolve(new Set<string>()),
    queuedKeys(service, "study-reminder", day),
    isMonday ? queuedKeys(service, "catalog-digest", week) : Promise.resolve(new Set<string>()),
  ]);

  const weekly = weeklyCandidates
    .filter((c) => !weeklyQueued.has(`weekly-report:${c.userId}:${week}`))
    .slice(0, MAX_LEARNERS_PER_RUN);
  const reminders = reminderCandidates
    .filter((c) => !reminderQueued.has(`study-reminder:${c.userId}:${day}`))
    .slice(0, MAX_LEARNERS_PER_RUN);
  const digests = digestCandidates
    .filter((c) => !digestQueued.has(`catalog-digest:${c.userId}:${week}`))
    .slice(0, MAX_LEARNERS_PER_RUN);

  if (weekly.length + reminders.length + digests.length === 0) return summary;

  // One pass of activity data serves both the report and the reminder.
  const activeIds = [...new Set([...weekly, ...reminders].map((c) => c.userId))];
  const activity = activeIds.length > 0 ? await readActivity(service, activeIds, now) : null;

  for (const learner of weekly) {
    const stats = activity?.byLearner.get(learner.userId);
    const result = await enqueueEmail({
      to: learner.email,
      template: "weekly_learning_report",
      payload: {
        learnerName: learner.name,
        lessonsCompleted: stats?.lessonsCompleted ?? 0,
        streakDays: stats?.streakDays ?? 0,
        coursesInProgress: stats?.coursesInProgress ?? 0,
      },
      idempotencyKey: `weekly-report:${learner.userId}:${week}`,
    });
    if (result.queued) summary.weeklyReports += 1;
    else summary.notQueued += 1;
  }

  for (const learner of reminders) {
    const stats = activity?.byLearner.get(learner.userId);
    // A learner who already studied today, or who has nothing enrolled, gets no
    // nudge: a reminder that ignores what actually happened is noise.
    if (!stats || stats.coursesInProgress === 0 || stats.completedToday) {
      summary.notQueued += 1;
      continue;
    }
    const result = await enqueueEmail({
      to: learner.email,
      template: "study_reminder",
      payload: {
        learnerName: learner.name,
        courseTitle: stats.resumeCourseTitle ?? "",
        courseUrl: stats.resumeCourseId ? `/learn/${stats.resumeCourseId}` : "",
      },
      idempotencyKey: `study-reminder:${learner.userId}:${day}`,
    });
    if (result.queued) summary.studyReminders += 1;
    else summary.notQueued += 1;
  }

  if (digests.length > 0) {
    const catalog = await readCatalogDigest(service, now);
    if (catalog.items.length === 0) {
      summary.notQueued += digests.length;
    } else {
      for (const learner of digests) {
        const result = await enqueueEmail({
          to: learner.email,
          template: "catalog_digest",
          payload: {
            learnerName: learner.name,
            itemCount: catalog.items.length,
            items: catalog.items.join("\n"),
          },
          idempotencyKey: `catalog-digest:${learner.userId}:${week}`,
        });
        if (result.queued) summary.catalogDigests += 1;
        else summary.notQueued += 1;
      }
    }
  }

  return summary;
}

interface LearnerActivity {
  lessonsCompleted: number;
  streakDays: number;
  coursesInProgress: number;
  completedToday: boolean;
  resumeCourseId: string | null;
  resumeCourseTitle: string | null;
}

/**
 * Reads a week of activity for a bounded set of learners.
 *
 * Batched by chunk so the `in (...)` filters stay small, and every read is
 * scoped to the learner ids that were just selected — nothing here trusts a
 * caller-supplied user id.
 */
async function readActivity(
  service: ServiceClient,
  learnerIds: string[],
  now: Date
): Promise<{ byLearner: Map<string, LearnerActivity> }> {
  const byLearner = new Map<string, LearnerActivity>();
  const ensure = (userId: string): LearnerActivity => {
    const existing = byLearner.get(userId);
    if (existing) return existing;
    const created: LearnerActivity = {
      lessonsCompleted: 0,
      streakDays: 0,
      coursesInProgress: 0,
      completedToday: false,
      resumeCourseId: null,
      resumeCourseTitle: null,
    };
    byLearner.set(userId, created);
    return created;
  };

  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const completions = new Map<string, Set<string>>();

  for (const batch of chunk(learnerIds, CHUNK)) {
    const [{ data: progress }, { data: entitlements }, { data: resumes }] = await Promise.all([
      service
        .from("lesson_progress")
        .select("user_id, completed_at")
        .in("user_id", batch)
        .eq("completed", true)
        .gte("completed_at", weekAgo.toISOString())
        .limit(MAX_KNOWN_KEYS),
      service
        .from("entitlements")
        .select("user_id, course_id")
        .in("user_id", batch)
        .is("revoked_at", null)
        .limit(MAX_KNOWN_KEYS),
      service
        .from("course_resume")
        .select("user_id, course_id, updated_at")
        .in("user_id", batch)
        .order("updated_at", { ascending: false })
        .limit(MAX_KNOWN_KEYS),
    ]);

    for (const row of (progress ?? []) as Array<{ user_id: string; completed_at: string | null }>) {
      if (!row.completed_at) continue;
      const at = new Date(row.completed_at);
      if (Number.isNaN(at.getTime())) continue;
      const stats = ensure(row.user_id);
      stats.lessonsCompleted += 1;
      if (at.getTime() >= todayStart.getTime()) stats.completedToday = true;

      const days = completions.get(row.user_id) ?? new Set<string>();
      days.add(at.toISOString().slice(0, 10));
      completions.set(row.user_id, days);
    }

    const enrolled = new Map<string, Set<string>>();
    for (const row of (entitlements ?? []) as Array<{ user_id: string; course_id: string }>) {
      const courses = enrolled.get(row.user_id) ?? new Set<string>();
      courses.add(row.course_id);
      enrolled.set(row.user_id, courses);
      ensure(row.user_id).coursesInProgress = courses.size;
    }

    // The most recently touched course is the one worth resuming.
    const resumeByLearner = new Map<string, string>();
    for (const row of (resumes ?? []) as Array<{ user_id: string; course_id: string }>) {
      if (resumeByLearner.has(row.user_id)) continue;
      resumeByLearner.set(row.user_id, row.course_id);
      ensure(row.user_id).resumeCourseId = row.course_id;
    }
  }

  for (const [userId, days] of completions) {
    const stats = ensure(userId);
    let streak = 0;
    // Walking back starts yesterday when today has nothing yet, so a morning
    // read does not report a streak the learner has not lost.
    for (let i = stats.completedToday ? 0 : 1; i < 8; i += 1) {
      const key = new Date(now.getTime() - i * 86_400_000).toISOString().slice(0, 10);
      if (!days.has(key)) break;
      streak += 1;
    }
    stats.streakDays = streak;
  }

  // Resolve the resume course titles in one pass.
  const courseIds = [...new Set([...byLearner.values()].map((s) => s.resumeCourseId).filter(Boolean))] as string[];
  if (courseIds.length > 0) {
    const titles = new Map<string, string>();
    for (const batch of chunk(courseIds, CHUNK)) {
      const { data } = await service.from("courses").select("id, title").in("id", batch);
      for (const row of (data ?? []) as Array<{ id: string; title: string }>) titles.set(row.id, row.title);
    }
    for (const stats of byLearner.values()) {
      if (stats.resumeCourseId) stats.resumeCourseTitle = titles.get(stats.resumeCourseId) ?? null;
    }
  }

  return { byLearner };
}

/**
 * What changed in the catalog this week: new published courses and live
 * discounts. Built once per run because the content is the same for everybody —
 * only the greeting differs.
 */
async function readCatalogDigest(
  service: ServiceClient,
  now: Date
): Promise<{ items: string[] }> {
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);

  // Two bounded reads rather than one clever filter: PostgREST cannot compare
  // two columns to each other, so "compare_at_paise > price_paise" is decided
  // here instead of being smuggled into a query that would silently match nothing.
  const [{ data: fresh }, { data: discounted }] = await Promise.all([
    service
      .from("courses")
      .select("id, title, price_paise, compare_at_paise, created_at")
      .eq("status", "published")
      .gte("created_at", weekAgo.toISOString())
      .order("created_at", { ascending: false })
      .limit(6),
    service
      .from("courses")
      .select("id, title, price_paise, compare_at_paise, created_at")
      .eq("status", "published")
      .gt("compare_at_paise", 0)
      .order("updated_at", { ascending: false })
      .limit(12),
  ]);

  const picked = new Map<string, Record<string, unknown>>();
  const candidates = [
    ...((fresh ?? []) as Array<Record<string, unknown>>),
    ...((discounted ?? []) as Array<Record<string, unknown>>),
  ];
  for (const row of candidates) {
    const price = Number(row.price_paise ?? 0);
    const compareAt = Number(row.compare_at_paise ?? 0);
    const isNew = new Date(String(row.created_at)).getTime() >= weekAgo.getTime();
    // Only a real discount or a genuinely new listing earns a line in the digest.
    if (!isNew && !(price > 0 && compareAt > price)) continue;
    picked.set(String(row.id), row);
    if (picked.size >= 6) break;
  }

  const items = [...picked.values()].map((row) => {
    const title = String(row.title ?? "A course");
    const price = Number(row.price_paise ?? 0);
    const compareAt = Number(row.compare_at_paise ?? 0);
    const isNew = new Date(String(row.created_at)).getTime() >= weekAgo.getTime();

    if (price === 0) return `${title} — free`;
    if (compareAt > price) return `${title} — ${formatInr(price)} (was ${formatInr(compareAt)})`;
    return isNew ? `${title} — new this week, ${formatInr(price)}` : `${title} — ${formatInr(price)}`;
  });

  return { items };
}
