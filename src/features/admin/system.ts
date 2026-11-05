/**
 * System and activity report.
 *
 * Configuration state only — never values. The integrations panel reuses the
 * same predicates the app gates features on, so `/admin` cannot claim
 * something works while the product silently degrades.
 *
 * The webhook section reports *counts and redacted error lines*. The
 * `payload` column is never selected: it holds the full provider body, which
 * for a payment event means customer identifiers and amounts.
 */

import { adminAllowlist } from "@/lib/admin/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { integrationHealth, linkedinCapabilityHealth } from "./integrations";
import { countRows } from "./query";
import { redactError } from "./redact";
import type { AdminSystemReport } from "./types";

export async function loadSystem(currentUserId: string): Promise<AdminSystemReport> {
  const admin = createSupabaseAdminClient();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const allowlist = adminAllowlist();

  const [failedWebhooks, unverified, publishFailures, postsFailed, postsStuck] =
    await Promise.all([
      countRows(admin, "webhook_events", (q) =>
        q.eq("status", "failed").gte("received_at", dayAgo),
      ),
      countRows(admin, "webhook_events", (q) => q.eq("signature_verified", false)),
      countRows(admin, "post_publish_attempts", (q) =>
        q.eq("outcome", "failed").gte("started_at", dayAgo),
      ),
      countRows(admin, "posts", (q) => q.eq("status", "failed")),
      // `publishing` is a transient state; a row sitting in it for a long time
      // means a job died without recording an outcome.
      countRows(admin, "posts", (q) => q.eq("status", "publishing")),
    ]);

  const [{ data: statusRows, error: statusError }, { data: recentRows, error: recentError }] =
    await Promise.all([
      admin.from("webhook_events").select("status"),
      admin
        .from("webhook_events")
        .select("event_id, provider, event_type, status, received_at, attempts, error")
        .order("received_at", { ascending: false })
        .limit(10),
    ]);

  if (statusError) throw statusError;
  if (recentError) throw recentError;

  const statusCounts = new Map<string, number>();
  for (const row of statusRows ?? []) {
    statusCounts.set(row.status, (statusCounts.get(row.status) ?? 0) + 1);
  }

  return {
    access: {
      allowlistConfigured: allowlist.configured,
      adminCount: allowlist.ids.length,
      // A count, not the values: this page is for confirming the variable is
      // well-formed, and echoing malformed input back into an HTML page is how
      // reflected-content bugs happen.
      invalidEntries: allowlist.invalid.map(() => "[invalid uuid]"),
      reason: allowlist.reason,
      currentUserId,
    },
    integrations: [...integrationHealth(), ...linkedinCapabilityHealth()],
    webhooks: {
      byStatus: [...statusCounts.entries()]
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count),
      failedLast24h: failedWebhooks,
      unverifiedSignature: unverified,
      recent: (recentRows ?? []).map((row) => ({
        eventId: row.event_id,
        provider: row.provider,
        eventType: row.event_type,
        status: row.status,
        receivedAt: row.received_at,
        attempts: row.attempts,
        error: redactError(row.error),
      })),
    },
    jobs: {
      publishAttemptsFailedLast24h: publishFailures,
      postsFailed,
      postsPublishing: postsStuck,
    },
    generatedAt: new Date().toISOString(),
  };
}
