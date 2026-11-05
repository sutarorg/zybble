import {
  Activity,
  ArrowRight,
  Building2,
  CalendarClock,
  Layers,
  Send,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";
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
import {
  formatMoney,
  formatNumber,
  formatRelative,
  humaniseAction,
} from "@/features/admin/format";
import { loadOverview } from "@/features/admin/overview";
import { safeLoad } from "@/features/admin/safe";
import type { IntegrationState } from "@/features/admin/types";

/**
 * Platform overview.
 *
 * Every figure is counted from real rows at request time. Nothing is cached
 * and nothing is estimated: the "Generated at" line is there so an operator
 * can tell how fresh the page is without guessing.
 *
 * Each stat carries an icon chip rather than a colour wash. Six tiles of plain
 * numbers are hard to scan; the icons give the eye something to anchor on
 * without introducing a second accent colour.
 */

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

/** Small "see all" affordance used at the foot of the summary panels. */
function PanelLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-md text-[12px] font-medium text-brand-600 transition-colors hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
    >
      {children}
      <ArrowRight className="size-3.5" aria-hidden />
    </Link>
  );
}

export default async function AdminOverviewPage() {
  const result = await safeLoad("admin.overview.failed", loadOverview);

  if (!result.ok) {
    return (
      <>
        <PageHeader title="Overview" description="Platform-wide counts and integration health." />
        <Panel className="mt-6" icon={Activity}>
          <p className="text-[13px] leading-6 text-slate-600">{result.message}</p>
        </Panel>
      </>
    );
  }

  const overview = result.data;

  return (
    <>
      <PageHeader
        title="Overview"
        description="Every figure below is counted from live database rows. Revenue is summed only from verified subscription records."
      >
        <p className="text-[11px] leading-4 text-slate-400">
          Generated {formatRelative(overview.generatedAt)}
        </p>
      </PageHeader>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile
          label="Registered users"
          value={formatNumber(overview.users.total)}
          hint={`${formatNumber(overview.users.newLast7Days)} joined in the last 7 days`}
          icon={Users}
        />
        <StatTile
          label="Active workspaces"
          value={formatNumber(overview.workspaces.total)}
          hint={`${formatNumber(overview.users.deleted)} deleted user accounts`}
          icon={Building2}
        />
        <StatTile
          label="Free workspaces"
          value={formatNumber(overview.workspaces.free)}
          hint="No active Pro subscription"
          icon={Layers}
        />
        <StatTile
          label="Pro subscriptions"
          value={formatNumber(overview.billing.activeProSubscriptions)}
          hint="Payable and in period"
          icon={Zap}
          accent
        />
        <StatTile
          label="Published posts"
          value={formatNumber(overview.posts.published)}
          hint={`${formatNumber(overview.posts.failed)} failed`}
          icon={Send}
        />
        <StatTile
          label="Scheduled posts"
          value={formatNumber(overview.posts.scheduled)}
          hint={`${formatNumber(overview.posts.drafts)} drafts`}
          icon={CalendarClock}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel
          title="Monthly recurring revenue"
          description="Summed from provider-verified amounts on active Pro subscriptions."
          icon={TrendingUp}
          className="lg:col-span-1"
        >
          <p className="text-[32px] font-semibold leading-none tracking-tight text-brand-600 tabular-nums">
            {formatMoney(overview.billing.mrrCents)}
          </p>
          <p className="mt-3 text-[12px] leading-5 text-slate-500">
            {overview.billing.mrrUnpriced > 0
              ? `${formatNumber(overview.billing.mrrUnpriced)} active subscription${
                  overview.billing.mrrUnpriced === 1 ? "" : "s"
                } excluded — no verified amount on record.`
              : "Every active Pro subscription contributed a verified amount."}
          </p>
          <div className="mt-4 border-t border-slate-100 pt-4">
            <PanelLink href="/admin/billing">Billing detail</PanelLink>
          </div>
        </Panel>

        <Panel
          title="Integration health"
          description="Configuration state only — no credentials are ever shown."
          icon={Activity}
          className="lg:col-span-2"
        >
          <ul className="divide-y divide-slate-100">
            {overview.integrations.map((integration) => (
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
      </div>

      <Panel
        title="Recent platform activity"
        description="Latest entries from the audit trail across every workspace."
        icon={Activity}
        className="mt-4"
        padded={false}
      >
        <DataTable>
          <thead>
            <tr>
              <Th>Action</Th>
              <Th>Actor</Th>
              <Th>Workspace</Th>
              <Th>When</Th>
            </tr>
          </thead>
          <tbody>
            {overview.recentActivity.length === 0 ? (
              <EmptyRow colSpan={4} icon={Activity}>
                No audit entries yet. Actions taken in the product will appear here.
              </EmptyRow>
            ) : (
              overview.recentActivity.map((entry) => (
                <tr key={entry.id}>
                  <Td className="font-medium text-slate-900">
                    {humaniseAction(entry.action)}
                  </Td>
                  <Td>{entry.actorEmail ?? <span className="text-slate-400">System</span>}</Td>
                  <Td>{entry.workspaceName ?? <span className="text-slate-400">—</span>}</Td>
                  <Td className="text-slate-500">{formatRelative(entry.createdAt)}</Td>
                </tr>
              ))
            )}
          </tbody>
        </DataTable>
        {overview.recentActivity.length > 0 ? (
          <div className="border-t border-slate-100 px-5 py-3">
            <PanelLink href="/admin/system">Full activity log</PanelLink>
          </div>
        ) : null}
      </Panel>
    </>
  );
}
