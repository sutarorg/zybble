import type { Metadata } from "next";
import {
  Activity,
  Clock,
  FileWarning,
  ShieldCheck,
  Webhook,
  XCircle,
} from "lucide-react";
import { ActivityTable } from "@/components/admin/activity-table";
import {
  DataTable,
  EmptyRow,
  PageHeader,
  Panel,
  StatTile,
  StatusPill,
  Td,
  Th,
} from "@/components/admin/primitives";
import { formatDateTime, formatNumber } from "@/features/admin/format";
import { loadSystem } from "@/features/admin/system";
import { requirePlatformAdmin } from "@/features/admin/guard";
import { safeLoad } from "@/features/admin/safe";
import type { IntegrationState } from "@/features/admin/types";

/**
 * System and activity.
 *
 * Configuration *state* only. Not one value on this page is a credential: the
 * integration panel reports which variables are missing, and the access panel
 * reports a count and a validity reason rather than echoing the configured
 * input back into the page.
 *
 * The audit trail below is a client component paging `/api/admin/activity`,
 * which authorises independently of this page.
 */

export const metadata: Metadata = { title: "System" };
export const dynamic = "force-dynamic";

const TONE_BY_STATE: Record<IntegrationState, "success" | "warning" | "neutral"> = {
  ready: "success",
  partial: "warning",
  not_configured: "neutral",
};

const LABEL_BY_STATE: Record<IntegrationState, string> = {
  ready: "Ready",
  partial: "Partial",
  not_configured: "Not configured",
};

const ACCESS_REASON: Record<string, string> = {
  ok: "The allowlist is set and contains at least one valid UUID.",
  missing: "ZYBBLE_ADMIN_USER_IDS is not set, so /admin denies everyone.",
  empty: "ZYBBLE_ADMIN_USER_IDS is set but empty, so /admin denies everyone.",
  no_valid_entries:
    "ZYBBLE_ADMIN_USER_IDS contains no valid UUIDs, so /admin denies everyone.",
};

export default async function AdminSystemPage() {
  // The layout has already authorised this render. The id is re-fetched here
  // because the report shows the operator their own user id, and that must come
  // from a verified session rather than from anything the client supplied.
  const operator = await requirePlatformAdmin();

  const result = await safeLoad("admin.system.failed", () => loadSystem(operator.id));

  if (!result.ok) {
    return (
      <>
        <PageHeader
          title="System & activity"
          description="Configuration status, operational health and the audit trail."
        />
        <Panel className="mt-6" icon={Activity}>
          <p className="text-[13px] leading-6 text-slate-600">{result.message}</p>
        </Panel>
      </>
    );
  }

  const system = result.data;

  return (
    <>
      <PageHeader
        title="System & activity"
        description="Configuration state only — no credentials, keys or raw provider payloads are ever loaded."
      >
        <p className="text-[11px] leading-4 text-slate-400">
          Generated {formatDateTime(system.generatedAt)}
        </p>
      </PageHeader>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Failed webhooks (24h)"
          value={formatNumber(system.webhooks.failedLast24h)}
          hint={`${formatNumber(system.webhooks.unverifiedSignature)} with unverified signature`}
          icon={Webhook}
        />
        <StatTile
          label="Failed publish attempts (24h)"
          value={formatNumber(system.jobs.publishAttemptsFailedLast24h)}
          hint="From post_publish_attempts"
          icon={XCircle}
        />
        <StatTile
          label="Posts in failed state"
          value={formatNumber(system.jobs.postsFailed)}
          hint="Awaiting retry or edit"
          icon={FileWarning}
        />
        <StatTile
          label="Posts stuck publishing"
          value={formatNumber(system.jobs.postsPublishing)}
          hint="A job died without recording an outcome"
          icon={Clock}
        />
      </div>

      <Panel
        className="mt-4"
        title="Admin access"
        description="Who may open this dashboard. The allowlist is environment configuration, not a database value."
        icon={ShieldCheck}
      >
        <dl className="space-y-2.5">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-[13px] text-slate-600">Allowlist</dt>
            <dd>
              <StatusPill tone={system.access.allowlistConfigured ? "success" : "danger"}>
                {system.access.allowlistConfigured ? "Configured" : "Not configured"}
              </StatusPill>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-[13px] text-slate-600">Accounts with access</dt>
            <dd className="text-[13px] font-medium text-slate-900 tabular-nums">
              {system.access.adminCount}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-[13px] text-slate-600">Your user ID</dt>
            <dd className="font-mono text-[12px] text-slate-700">
              {system.access.currentUserId}
            </dd>
          </div>
        </dl>

        <p className="mt-4 border-t border-slate-100 pt-3 text-[12px] leading-5 text-slate-500">
          {ACCESS_REASON[system.access.reason] ?? ACCESS_REASON.missing}
          {system.access.invalidEntries.length > 0
            ? ` ${system.access.invalidEntries.length} configured ${
                system.access.invalidEntries.length === 1 ? "entry is" : "entries are"
              } not a valid UUID and ${
                system.access.invalidEntries.length === 1 ? "was" : "were"
              } ignored.`
            : ""}
        </p>
      </Panel>

      <Panel
        className="mt-4"
        title="Integration status"
        description="Configuration state, using the same predicates the app gates features on."
        icon={Activity}
      >
        <ul className="divide-y divide-slate-100">
          {system.integrations.map((integration) => (
            <li
              key={integration.label}
              className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-slate-900">{integration.label}</p>
                <p className="mt-0.5 text-[12px] leading-5 text-slate-500">
                  {integration.detail}
                </p>
              </div>
              <StatusPill tone={TONE_BY_STATE[integration.state]}>
                {LABEL_BY_STATE[integration.state]}
              </StatusPill>
            </li>
          ))}
        </ul>
      </Panel>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel
          title="Webhooks"
          description="Counts by processing status. Payload bodies are never loaded."
          icon={Webhook}
        >
          {system.webhooks.byStatus.length === 0 ? (
            <p className="text-[13px] leading-6 text-slate-500">
              No webhook events recorded yet.
            </p>
          ) : (
            <dl className="space-y-2.5">
              {system.webhooks.byStatus.map((row) => (
                <div key={row.status} className="flex items-center justify-between">
                  <dt>
                    <StatusPill
                      tone={
                        row.status === "processed"
                          ? "success"
                          : row.status === "failed"
                            ? "danger"
                            : "neutral"
                      }
                    >
                      {row.status}
                    </StatusPill>
                  </dt>
                  <dd className="text-[13px] font-medium text-slate-900 tabular-nums">
                    {formatNumber(row.count)}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </Panel>

        <Panel
          title="Recent webhook events"
          description="Error text is truncated and redacted server-side."
          icon={Webhook}
          padded={false}
        >
          <DataTable>
            <thead>
              <tr>
                <Th>Event</Th>
                <Th>Status</Th>
                <Th>Received</Th>
              </tr>
            </thead>
            <tbody>
              {system.webhooks.recent.length === 0 ? (
                <EmptyRow colSpan={3} icon={Webhook}>
                  No webhook events yet.
                </EmptyRow>
              ) : (
                system.webhooks.recent.map((event) => (
                  <tr key={event.eventId}>
                    <Td>
                      <span className="font-medium text-slate-900">{event.eventType}</span>
                      <span className="block text-[11px] text-slate-400">
                        {event.provider}
                        {event.attempts > 1 ? ` · ${event.attempts} attempts` : ""}
                      </span>
                      {event.error ? (
                        <span className="mt-0.5 block text-[11px] text-red-600">
                          {event.error}
                        </span>
                      ) : null}
                    </Td>
                    <Td>
                      <StatusPill
                        tone={
                          event.status === "processed"
                            ? "success"
                            : event.status === "failed"
                              ? "danger"
                              : "neutral"
                        }
                      >
                        {event.status}
                      </StatusPill>
                    </Td>
                    <Td className="text-slate-500">{formatDateTime(event.receivedAt)}</Td>
                  </tr>
                ))
              )}
            </tbody>
          </DataTable>
        </Panel>
      </div>

      <Panel
        className="mt-4"
        title="Audit activity"
        description="Every privileged action recorded by the product, newest first."
        icon={Activity}
        padded={false}
      >
        <ActivityTable />
      </Panel>
    </>
  );
}
