import { getAdminPayouts } from "@/lib/server/admin";
import { formatInr } from "@/lib/money";
import { AdminPayoutsClient } from "./admin-payouts-client";
import { ExportPayoutsCsv } from "./export-transfers-csv";

export const metadata = { title: "Creator payouts" };
export const dynamic = "force-dynamic";

export default async function AdminPayoutsPage() {
  const { requests, creatorBalances, auditEvents, encryptionReady } =
    await getAdminPayouts();

  const pendingRequests = requests.filter(
    (r) => r.status === "requested" || r.status === "approved"
  );
  const pendingPaise = pendingRequests.reduce((s, r) => s + r.amountPaise, 0);
  const paidPaise = requests
    .filter((r) => r.status === "paid")
    .reduce((s, r) => s + r.amountPaise, 0);
  const outstandingPaise = creatorBalances.reduce(
    (s, c) => s + c.outstandingPayablePaise,
    0
  );
  const failedCount = requests.filter((r) => r.status === "failed").length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Creator payouts</h1>
          <p className="mt-1 text-xs text-muted-foreground max-w-2xl">
            Learners pay into Zybble&apos;s merchant account in INR. Creators accrue their net share
            on every captured sale and submit payout requests here. Review requests, reveal the
            encrypted UPI/bank destination snapshot (logged in the audit trail), execute the
            transfer off-platform, and confirm with the bank UTR / UPI reference.
          </p>
        </div>
        <ExportPayoutsCsv requests={requests} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric
          label="Pending requests"
          value={`${pendingRequests.length} (${formatInr(pendingPaise)})`}
          sub="Requested or approved"
        />
        <Metric
          label="Total paid out"
          value={formatInr(paidPaise)}
          sub="Confirmed manual payouts"
        />
        <Metric
          label="Outstanding creator payable"
          value={formatInr(outstandingPaise)}
          sub="Unpaid net creator earnings"
        />
        <Metric
          label="Failed / action needed"
          value={String(failedCount)}
          sub="Released back to creator balance"
        />
      </div>

      <AdminPayoutsClient
        requests={requests}
        creatorBalances={creatorBalances}
        auditEvents={auditEvents}
        encryptionReady={encryptionReady}
      />
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-lg font-bold tabular-nums">{value}</p>
      {sub ? <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p> : null}
    </div>
  );
}
