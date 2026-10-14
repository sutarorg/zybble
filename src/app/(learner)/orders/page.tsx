import Link from "next/link";
import { CreditCard, Receipt, ShieldCheck } from "lucide-react";
import { getOrders } from "@/lib/server/learner";
import { formatInr } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700",
  created: "bg-zinc-100 text-zinc-600",
  failed: "bg-red-100 text-red-700",
  cancelled: "bg-zinc-100 text-zinc-600",
  refunded: "bg-orange-100 text-orange-700",
  partially_refunded: "bg-orange-100 text-orange-700",
};

export default async function LearnerOrdersPage() {
  const orders = await getOrders();
  const paid = orders.filter((order) => order.status === "paid");
  const totalSpent = paid.reduce((sum, order) => sum + order.totalPaise, 0);

  return (
    <div className="space-y-6 px-4 py-7 sm:px-6 lg:px-9">
      <header>
        <h1 className="font-display text-[26px] leading-tight font-bold tracking-tight">Orders</h1>
        <p className="mt-1.5 text-[14px] text-muted-foreground">
          {orders.length === 0
            ? "Your purchases will appear here."
            : `${orders.length} order${orders.length === 1 ? "" : "s"} · ${formatInr(totalSpent)} paid`}
        </p>
      </header>

      {orders.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No orders yet"
          description="Buying a course — or enrolling in a free one — creates an order you can always come back to."
          action={
            <Button asChild>
              <Link href="/explore">Browse the catalog</Link>
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => (
            <li key={order.id} className="rounded-xl border border-border bg-white p-4 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[12px] text-muted-foreground">{order.publicId}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${STATUS_TONE[order.status] ?? STATUS_TONE.created}`}
                    >
                      {order.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {order.items.map((item) => (
                      <li key={item.courseId} className="text-[13.5px]">
                        <Link href={`/courses/${item.courseSlug}`} className="font-medium hover:underline">
                          {item.courseTitle}
                        </Link>
                        <span className="ml-2 text-[12.5px] text-muted-foreground tabular-nums">
                          {item.unitPricePaise === 0 ? "Free" : formatInr(item.unitPricePaise)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[12px] text-zinc-400">
                    {formatDate(order.createdAt)} · {order.method}
                    {order.paidAt ? ` · paid ${formatDate(order.paidAt)}` : ""}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className="font-display text-[16px] font-bold tabular-nums">
                    {order.totalPaise === 0 ? "Free" : formatInr(order.totalPaise)}
                  </span>
                  <Link
                    href={`/orders/${order.publicId}`}
                    className="rounded-lg border border-border px-3 py-1.5 text-[13px] font-medium transition-colors hover:bg-muted/50"
                  >
                    View details
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="flex items-start gap-2 text-[12px] text-zinc-400">
        <ShieldCheck className="mt-px size-3.5 shrink-0" aria-hidden />
        Access to a course is granted by a verified Razorpay payment or webhook — never by a browser redirect.
      </p>
    </div>
  );
}