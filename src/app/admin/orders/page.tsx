import Link from "next/link";
import { Download, Receipt, Undo2 } from "lucide-react";
import { getAdminOrders } from "@/lib/server/admin";
import { money } from "@/lib/admin";
import { EmptyState } from "@/components/ui/empty-state";
import { ExportOrdersCsv } from "./export-orders-csv";
import { RefundOrderDialog } from "./refund-order-dialog";

export const metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const all = await getAdminOrders();
  const active = status && ["paid", "created", "failed", "refunded", "partially_refunded"].includes(status) ? status : "all";
  const orders = active === "all" ? all : all.filter((order) => order.status === active);

  const totalsSource =
    active === "all"
      ? orders.filter((order) =>
          ["paid", "partially_refunded", "refunded"].includes(order.status)
        )
      : orders;
  const totals = totalsSource.reduce(
    (acc, order) => {
      acc.gross += order.grossPaise;
      acc.commission += order.commissionPaise;
      acc.creator += order.creatorSharePaise;
      return acc;
    },
    { gross: 0, commission: 0, creator: 0 }
  );

  const FILTERS = ["all", "paid", "created", "failed", "refunded", "partially_refunded"];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] leading-tight font-bold tracking-tight">Orders</h1>
          <p className="mt-1.5 text-[14px] text-muted-foreground">
            One row per order item, with the commission rate snapshotted at checkout. Entitlement is granted by a
            verified payment or webhook, never by a browser redirect.
          </p>
        </div>
        <ExportOrdersCsv orders={all} />
      </header>

      <nav className="flex flex-wrap gap-2" aria-label="Filter orders by status">
        {FILTERS.map((filter) => (
          <Link
            key={filter}
            href={filter === "all" ? "/admin/orders" : `/admin/orders?status=${filter}`}
            className={`rounded-lg border px-3 py-1.5 text-[13px] transition-colors ${
              active === filter
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-white text-muted-foreground hover:bg-muted/60"
            }`}
          >
            {filter.replace(/_/g, " ")}{" "}
            <span className="tabular-nums opacity-70">
              {filter === "all" ? all.length : all.filter((order) => order.status === filter).length}
            </span>
          </Link>
        ))}
      </nav>

      <div className="grid gap-3.5 sm:grid-cols-3">
        {[
          { label: "Gross in view", value: totals.gross },
          { label: "Zybble commission", value: totals.commission },
          { label: "Creator share", value: totals.creator },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-border bg-white px-4 py-3 shadow-card">
            <p className="text-[12px] text-muted-foreground">{item.label}</p>
            <p className="mt-1 font-display text-[18px] font-bold tabular-nums">{money(item.value)}</p>
          </div>
        ))}
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No orders"
          description="Orders appear only when a learner actually pays through Razorpay. Zybble never fabricates a transaction."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-white shadow-card">
          <table className="w-full min-w-[900px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[12px] text-muted-foreground">
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Learner</th>
                <th className="px-4 py-3 font-medium">Course</th>
                <th className="px-4 py-3 text-right font-medium">Gross</th>
                <th className="px-4 py-3 text-right font-medium">Commission</th>
                <th className="px-4 py-3 text-right font-medium">Creator</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Razorpay ids</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.map((order) => (
                <tr key={`${order.id}-${order.courseTitle}`}>
                  <td className="px-4 py-3 font-mono text-[11.5px]">{order.publicId}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{order.learnerName}</p>
                    <p className="text-[11.5px] text-muted-foreground">{order.learnerEmail}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{order.courseTitle}</p>
                    <p className="text-[11.5px] text-muted-foreground">{order.creatorName}</p>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{money(order.grossPaise)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {money(order.commissionPaise)}
                    <span className="block text-[11px] text-zinc-400">{(order.commissionBps / 100).toFixed(2)}%</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{money(order.creatorSharePaise)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                        order.status === "paid"
                          ? "bg-emerald-100 text-emerald-700"
                          : order.status === "refunded"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      {order.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[10.5px] text-muted-foreground">
                    {order.razorpayOrderId ? <p>order: {order.razorpayOrderId}</p> : null}
                    {order.razorpayPaymentId ? <p>pay: {order.razorpayPaymentId}</p> : null}
                    {!order.razorpayOrderId ? "—" : null}
                  </td>
                  <td className="px-4 py-3">
                    {order.status === "paid" && order.razorpayPaymentId ? (
                      <RefundOrderDialog
                        publicOrderId={order.publicId}
                        grossPaise={order.grossPaise}
                      />
                    ) : (
                      <span className="text-[12px] text-zinc-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[12px] text-zinc-400">
        Zybble publishes no refund policy. The dialog above is an administrative correction that calls Razorpay&apos;s
        refund API and records whatever the provider actually returns.
      </p>
    </div>
  );
}