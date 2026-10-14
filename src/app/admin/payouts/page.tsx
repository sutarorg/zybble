import { Landmark, Download } from "lucide-react";
import { getAdminTransfers } from "@/lib/server/admin";
import { money } from "@/lib/admin";
import { EmptyState } from "@/components/ui/empty-state";
import { ExportTransfersCsv } from "./export-transfers-csv";

export const metadata = { title: "Payouts" };
export const dynamic = "force-dynamic";

const TONE: Record<string, string> = {
  processed: "text-emerald-700",
  queued: "text-amber-700",
  pending: "text-amber-700",
  created: "text-amber-700",
  failed: "text-red-700",
  reversed: "text-red-700",
  partially_reversed: "text-orange-700",
};

export default async function AdminPayoutsPage() {
  const transfers = await getAdminTransfers();

  const totals = transfers.reduce(
    (acc, transfer) => {
      acc.transferred += transfer.status === "processed" ? transfer.amountPaise : 0;
      acc.settled += transfer.settlementStatus === "processed" ? transfer.amountPaise : 0;
      acc.reversed += transfer.reversedPaise;
      acc.failed += transfer.status === "failed" ? transfer.amountPaise : 0;
      return acc;
    },
    { transferred: 0, settled: 0, reversed: 0, failed: 0 }
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] leading-tight font-bold tracking-tight">Route payouts</h1>
          <p className="mt-1.5 text-[14px] text-muted-foreground">
            Every row is a transfer Razorpay actually created through Route. A transfer is only shown as settled
            once Razorpay reports the settlement.
          </p>
        </div>
        <ExportTransfersCsv transfers={transfers} />
      </header>

      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Transferred", value: totals.transferred },
          { label: "Settled by Razorpay", value: totals.settled },
          { label: "Reversed", value: totals.reversed },
          { label: "Failed transfers", value: totals.failed },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-border bg-white px-4 py-3 shadow-card">
            <p className="text-[12px] text-muted-foreground">{item.label}</p>
            <p className="mt-1 font-display text-[18px] font-bold tabular-nums">{money(item.value)}</p>
          </div>
        ))}
      </div>

      {transfers.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="No Route transfers yet"
          description="Transfers are created automatically when a paid order is verified through Razorpay. Nothing is simulated here."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-white shadow-card">
          <table className="w-full min-w-[900px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[12px] text-muted-foreground">
                <th className="px-4 py-3 font-medium">Transfer</th>
                <th className="px-4 py-3 font-medium">Creator</th>
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 text-right font-medium">Reversed</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Settlement</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {transfers.map((transfer) => (
                <tr key={transfer.transferId}>
                  <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                    {transfer.transferId}
                    <p className="mt-0.5 text-[10.5px]">{transfer.routeAccountId}</p>
                  </td>
                  <td className="px-4 py-3 font-medium">{transfer.creatorName}</td>
                  <td className="px-4 py-3 font-mono text-[11px]">{transfer.orderPublicId ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{money(transfer.amountPaise)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-red-600">
                    {transfer.reversedPaise > 0 ? money(transfer.reversedPaise) : "—"}
                  </td>
                  <td className={`px-4 py-3 ${TONE[transfer.status] ?? "text-muted-foreground"}`}>{transfer.status}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {transfer.settlementStatus ?? "not reported yet"}
                    {transfer.settledAt ? (
                      <span className="block text-[11px]">
                        {new Date(transfer.settledAt).toLocaleDateString("en-IN")}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(transfer.createdAt).toLocaleDateString("en-IN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="flex items-center gap-2 text-[12px] text-zinc-400">
        <Download className="size-3.5" aria-hidden /> Exports contain only figures already stored in Postgres, plus
        the Razorpay ids needed to reconcile against the provider.
      </p>
    </div>
  );
}