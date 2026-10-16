import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { getOrderByPublicId } from "@/lib/server/learner";
import { formatInr } from "@/lib/money";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Order details" };
export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const order = await getOrderByPublicId(orderId);
  if (!order) notFound();

  return (
    <div className="space-y-6 px-4 py-7 sm:px-6 lg:px-9">
      <header>
        <Link href="/orders" className="text-[12.5px] text-muted-foreground underline">
          <ArrowLeft className="inline size-3.5" aria-hidden /> All orders
        </Link>
        <h1 className="font-display mt-1 text-[26px] leading-tight font-bold tracking-tight">Order {order.publicId}</h1>
        <p className="mt-1.5 text-[14px] text-muted-foreground">
          Placed {formatDate(order.createdAt)} · {order.method}
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-border bg-white p-5 shadow-card lg:col-span-2">
          <h2 className="font-display text-[15px] font-semibold tracking-tight">Items</h2>
          <ul className="mt-4 divide-y divide-border">
            {order.items.map((item) => (
              <li key={item.courseId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <Link href={`/courses/${item.courseSlug}`} className="text-[14px] font-medium hover:underline">
                    {item.courseTitle}
                  </Link>
                  <p className="mt-0.5 text-[12px] text-muted-foreground tabular-nums">
                    {item.unitPricePaise === 0 ? "Free" : formatInr(item.unitPricePaise)}
                  </p>
                </div>
                <Link
                  href={`/learn/${item.courseId}`}
                  className="rounded-lg border border-border px-3 py-1.5 text-[13px] font-medium transition-colors hover:bg-muted/50"
                >
                  Open course
                </Link>
              </li>
            ))}
          </ul>

          <dl className="mt-4 space-y-2.5 border-t border-border pt-4 text-[13.5px]">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-muted-foreground">Currency</dt>
              <dd className="font-medium">INR (₹)</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-muted-foreground">Status</dt>
              <dd className="font-medium">{order.status.replace(/_/g, " ")}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-muted-foreground">Paid at</dt>
              <dd className="font-medium">{order.paidAt ? formatDate(order.paidAt) : "—"}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-t border-border pt-3">
              <dt className="font-medium">Total</dt>
              <dd className="font-display text-[17px] font-bold tabular-nums">
                {order.totalPaise === 0 ? "Free" : formatInr(order.totalPaise)}
              </dd>
            </div>
          </dl>
        </section>

        <aside className="rounded-xl border border-border bg-white p-5 shadow-card">
          <h2 className="flex items-center gap-2 font-display text-[15px] font-semibold tracking-tight">
            <ShieldCheck className="size-4 text-primary" aria-hidden /> How your money was split
          </h2>
          <p className="mt-2 text-[12.5px] text-muted-foreground">
            Each item records the commission Zybble charged at the moment you paid. Those numbers are snapshotted,
            so they never change retroactively.
          </p>
          <ul className="mt-4 space-y-4">
            {order.items.map((item) => (
              <li key={item.courseId}>
                <p className="text-[13px] font-medium">{item.courseTitle}</p>
                <dl className="mt-1.5 space-y-1 text-[12.5px]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Zybble commission</dt>
                    <dd className="tabular-nums">
                      {(item.commissionBps / 100).toFixed(2)}%
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Creator net share</dt>
                    <dd className="tabular-nums">{formatInr(item.creatorSharePaise)}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11.5px] text-zinc-400">
            Every amount is in Indian Rupees. If a figure here looks wrong, open the Help Center and support will
            check it against the payment record.
          </p>
        </aside>
      </div>
    </div>
  );
}