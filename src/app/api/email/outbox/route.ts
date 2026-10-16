import { z } from "zod";
import { getSession, AuthorizationError } from "@/lib/server/session";
import { drainEmailOutbox } from "@/lib/server/email";
import { queueScheduledLearnerEmails } from "@/lib/server/scheduled-email";
import { clientKey, LIMITS, rateLimit, rateLimitHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({ limit: z.number().int().min(1).max(100).default(25) });

/**
 * Sends queued transactional email.
 *
 * Restricted to administrators: the outbox contains learner email addresses
 * and receipt contents, so a public trigger would be a personal-data leak.
 * Run it from a cron with an admin session, or from the admin portal.
 *
 * The same call also queues the recurring learner messages that are due —
 * weekly reports and catalog digests on Mondays, study reminders daily. Zybble
 * has no in-process scheduler, so this endpoint is the only place scheduled mail
 * can originate; both halves are idempotent, which is what makes it safe for a
 * cron to call this every few minutes. See `src/lib/server/scheduled-email.ts`.
 */
export async function POST(request: Request) {
  let session;
  try {
    session = await getSession();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return Response.json({ error: "Sign in to continue" }, { status: 401 });
    }
    throw error;
  }
  if (!session) return Response.json({ error: "Sign in to continue" }, { status: 401 });
  if (session.role !== "admin" && session.role !== "moderator") {
    return Response.json({ error: "Administrators only" }, { status: 403 });
  }

  const limit = rateLimit(clientKey(request, "email-drain", session.id), LIMITS.mutation.limit, LIMITS.mutation.windowMs);
  if (!limit.allowed) {
    return Response.json({ error: "Too many requests" }, { status: 429, headers: rateLimitHeaders(limit) });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const { limit: batch } = schema.parse(body ?? {});

  // Queue first, then send: a message that becomes due during this run leaves in
  // the same pass instead of waiting for the next cron tick.
  const scheduled = await queueScheduledLearnerEmails();
  const result = await drainEmailOutbox(batch);

  return Response.json({ ...result, scheduled }, { status: 200, headers: rateLimitHeaders(limit) });
}