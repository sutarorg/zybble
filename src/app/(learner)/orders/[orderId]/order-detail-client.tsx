"use client";

import { LocalizedText, useTranslate } from "@/components/providers/localized-text";
import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  CircleX,
  CreditCard,
  Download,
  Eye,
  GraduationCap,
  CircleCheck,
} from "lucide-react";
import { useApp } from "@/components/providers/app-providers";
import { useCommunityCourses } from "@/components/providers/creator-provider";
import { resolveCourse } from "@/lib/learn";
import { formatDate, formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { PLATFORM_COMMISSION } from "@/lib/creator";

export function OrderDetailClient({ orderId }: { orderId: string }) {
  const translateUi = useTranslate();
  const { orders, hydrated, isEnrolled } = useApp();
  const community = useCommunityCourses();

  const order = orders.find((o) => o.id === orderId);
  const course = order ? resolveCourse(order.courseId, community) : undefined;

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8" aria-busy>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="mt-6 h-96 rounded-xl" />
      </div>
    );
  }
  if (!order) notFound();

  const paid = order.status === "paid";
  const enrolled = course ? isEnrolled(course.id) : false;

  const downloadReceipt = () => {
    const lines = [
      "ZYBBLE — preview RECEIPT",
      "=====================",
      "",
      `Order:        ${order.id}`,
      `Date:         ${formatDate(order.createdAt)}`,
      `Course:       ${course?.title ?? order.courseId}`,
      `Status:       ${order.status.toUpperCase()} (simulated)`,
      `Amount:       ${order.total === 0 ? "Free" : formatPrice(order.total)}`,
      `Payment:      ${order.cardLast4 === "FREE" ? "Free enrollment" : `Test card •••• ${order.cardLast4}`}`,
      `Billed to:    ${order.email}`,
      "",
      `Marketplace commission (10%, illustrative): ${order.total === 0 ? "$0.00" : formatPrice(order.total * PLATFORM_COMMISSION)}`,
      "",
      "This receipt documents a SIMULATED checkout in the Zybble preview.",
      "No real payment was processed and no card data was stored.",
    ].join("\n");
    const blob = new Blob([lines], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zybble-receipt-${order.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Receipt downloaded");
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/orders">
          <ArrowLeft aria-hidden /><LocalizedText text={"All orders"} /></Link>
      </Button>

      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-white shadow-card">
        {/* Status header */}
        <div
          className={
            paid
              ? "flex flex-wrap items-center gap-3 border-b border-emerald-100 bg-emerald-50 px-4 py-4 sm:px-6"
              : "flex flex-wrap items-center gap-3 border-b border-red-100 bg-red-50 px-4 py-4 sm:px-6"
          }
        >
          {paid ? (
            <CircleCheck className="size-5 text-emerald-600" aria-hidden />
          ) : (
            <CircleX className="size-5 text-red-500" aria-hidden />
          )}
          <div className="min-w-0">
            <p className="font-display text-[15px] font-semibold">
              {paid ? "Payment successful (simulated)" : "Payment declined (simulated)"}
            </p>
            <p className="text-[12px] break-anywhere text-muted-foreground"><LocalizedText text={"Order"} /><span className="font-mono"><LocalizedText text={order.id} /></span> · <LocalizedText text={formatDate(order.createdAt)} />
            </p>
          </div>
          <div className="ml-auto">
            {paid ? <Badge variant="emerald"><LocalizedText text={"Paid"} /></Badge> : <Badge variant="secondary"><LocalizedText text={"Declined"} /></Badge>}
          </div>
        </div>

        <div className="grid min-w-0 gap-6 p-4 sm:p-6 md:grid-cols-[minmax(0,1fr)_280px]">
          {/* Course block */}
          <div>
            {course ? (
              <div className="flex flex-col gap-4 sm:flex-row">
                <Link
                  href={`/courses/${course.slug}`}
                  className="relative block aspect-video w-full shrink-0 overflow-hidden rounded-lg border border-border bg-muted sm:w-52"
                >
                  <Image src={course.thumbnail} alt={translateUi(course.title)} fill sizes="208px" className="object-cover" />
                </Link>
                <div className="min-w-0">
                  <Link
                    href={`/courses/${course.slug}`}
                    className="font-display text-[16px] font-semibold tracking-tight hover:text-primary"
                  >
                    <LocalizedText text={course.title} />
                  </Link>
                  <p className="mt-1 line-clamp-2 text-[13px] text-muted-foreground"><LocalizedText text={course.subtitle} /></p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {paid &&
                      (enrolled ? (
                        <Button asChild size="sm">
                          <Link href={`/learn/${course.id}`}>
                            <GraduationCap aria-hidden /><LocalizedText text={"Start learning"} /></Link>
                        </Button>
                      ) : null)}
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/courses/${course.slug}`}>
                        <Eye aria-hidden /><LocalizedText text={"Course page"} /></Link>
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-[13px] text-muted-foreground"><LocalizedText text={"This course is no longer available in the catalog (id:"} /><LocalizedText text={order.courseId} />).
              </p>
            )}

            {/* Breakdown */}
            <dl className="mt-6 max-w-sm space-y-2 text-[13.5px]">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground"><LocalizedText text={"Amount"} /></dt>
                <dd className="tabular-nums"><LocalizedText text={order.total === 0 ? "Free" : formatPrice(order.total)} /></dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground"><LocalizedText text={"Platform commission (10%, illustrative)"} /></dt>
                <dd className="shrink-0 tabular-nums text-zinc-500">
                  −<LocalizedText text={order.total === 0 ? formatPrice(0) : formatPrice(order.total * PLATFORM_COMMISSION)} />
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground"><LocalizedText text={"Payment method"} /></dt>
                <dd className="tabular-nums">
                  <LocalizedText text={order.cardLast4 === "FREE" ? "Free enrollment" : `Test card •••• ${order.cardLast4}`} />
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground"><LocalizedText text={"Billed to"} /></dt>
                <dd className="min-w-0 truncate pl-4"><LocalizedText text={order.email} /></dd>
              </div>
              <Separator className="!my-3" />
              <div className="flex justify-between gap-4 font-semibold">
                <dt><LocalizedText text={"Total"} /></dt>
                <dd className="font-display tabular-nums">
                  <LocalizedText text={order.total === 0 ? "Free" : formatPrice(order.total)} />
                </dd>
              </div>
            </dl>
          </div>

          {/* Actions rail */}
          <aside className="h-fit space-y-2 rounded-xl border border-border bg-muted/40 p-4">
            <Button variant="outline" className="w-full" onClick={downloadReceipt}>
              <Download aria-hidden /><LocalizedText text={"Download receipt"} /></Button>
            <p className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-zinc-400">
              <CreditCard className="mt-0.5 size-3.5 shrink-0" aria-hidden /><LocalizedText text={"Sample order — no real payment or provider involved."} /></p>
          </aside>
        </div>
      </div>

    </div>
  );
}
