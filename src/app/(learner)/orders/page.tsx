"use client";

import { LocalizedText, useTranslate } from "@/components/providers/localized-text";
import * as React from "react";
import { useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronRight, Compass, CreditCard, Receipt } from "lucide-react";
import { COURSES } from "@/data/mock-data";
import { useApp } from "@/components/providers/app-providers";
import { useCommunityCourses } from "@/components/providers/creator-provider";
import { formatDate, formatPrice } from "@/lib/format";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function OrdersPage() {
  const translateUi = useTranslate();
  const { orders, hydrated } = useApp();
  const community = useCommunityCourses();

  const rows = useMemo(() => {
    const pool = [...community, ...COURSES];
    return orders.map((order) => ({
      order,
      course: pool.find((c) => c.id === order.courseId),
    }));
  }, [orders, community]);

  const stats = useMemo(() => {
    const paid = orders.filter((o) => o.status === "paid");
    return {
      count: orders.length,
      paidTotal: paid.reduce((a, o) => a + o.total, 0),
    };
  }, [orders]);

  return (
    <div className="page-container py-7 sm:py-9">
      <header>
        <p className="text-[11px] font-bold tracking-[0.14em] text-primary uppercase"><LocalizedText text={"Purchases"} /></p>
        <h1 className="font-display mt-2 text-[26px] font-bold tracking-tight sm:text-[34px]"><LocalizedText text={"Order history"} /></h1>
        <p className="mt-2 text-[14.5px] text-muted-foreground">
          {<LocalizedText text={hydrated
            ? orders.length > 0
              ? `${orders.length} ${orders.length === 1 ? "order" : "orders"} · ${formatPrice(stats.paidTotal)} in simulated purchases.`
              : "Your simulated purchases will appear here. No real payments, ever."
            : "Loading orders…"} />}
        </p>
      </header>

      <div className="mt-8">
        {!hydrated ? (
          <Skeleton className="h-72 rounded-xl" />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={translateUi("No orders yet")}
            description={translateUi("When you enroll in a paid (or free) course through the preview checkout, the mock receipt lands here.")}
            action={
              <Button asChild>
                <Link href="/">
                  <Compass aria-hidden /><LocalizedText text={"Explore courses"} /></Link>
              </Button>
            }
          />
        ) : (
          <>
            <div className="overflow-hidden rounded-xl border border-border bg-white shadow-card">
              {/* Header row (desktop) */}
              <div className="hidden grid-cols-[minmax(0,2fr)_120px_110px_90px_40px] gap-4 border-b border-border bg-muted/50 px-5 py-3 text-[11px] font-semibold tracking-wider text-zinc-400 uppercase md:grid">
                <span><LocalizedText text={"Course"} /></span>
                <span><LocalizedText text={"Date"} /></span>
                <span><LocalizedText text={"Status"} /></span>
                <span className="text-right"><LocalizedText text={"Amount"} /></span>
                <span className="sr-only"><LocalizedText text={"Open"} /></span>
              </div>
              <ul>
                {rows.map(({ order, course }) => (
                  <li key={order.id}>
                    <Link
                      href={`/orders/${order.id}`}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-4 transition-colors last:border-0 hover:bg-muted/40 sm:px-5 md:grid-cols-[minmax(0,2fr)_120px_110px_90px_40px] md:gap-4"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        {course ? (
                          <span className="relative hidden aspect-video w-20 shrink-0 overflow-hidden rounded-md border border-border sm:block">
                            <Image src={course.thumbnail} alt={translateUi("")} fill sizes="80px" className="object-cover" />
                          </span>
                        ) : null}
                        <div className="min-w-0">
                          <p className="truncate text-[13.5px] font-semibold"><LocalizedText text={course?.title ?? "Course unavailable"} /></p>
                          <p className="mt-0.5 truncate font-mono text-[11px] text-zinc-400"><LocalizedText text={order.id} /></p>
                        </div>
                      </div>
                      <span className="hidden text-[12.5px] text-muted-foreground md:block">
                        <LocalizedText text={formatDate(order.createdAt)} />
                      </span>
                      <span className="hidden md:block">
                        {order.status === "paid" ? (
                          <Badge variant="emerald"><LocalizedText text={"Paid"} /></Badge>
                        ) : (
                          <Badge variant="secondary"><LocalizedText text={"Declined"} /></Badge>
                        )}
                      </span>
                      <span className="text-right text-[13.5px] font-semibold tabular-nums md:text-[13px]">
                        {order.total === 0 ? <span className="text-success"><LocalizedText text={"Free"} /></span> : formatPrice(order.total)}
                      </span>
                      <ChevronRight className="hidden size-4 text-zinc-300 md:block" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-[12px] text-zinc-400">
              <CreditCard className="size-3.5" aria-hidden /><LocalizedText text={"All transactions are simulated in this preview checkout — no real cards or providers are involved."} /></p>
          </>
        )}
      </div>
    </div>
  );
}
