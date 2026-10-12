"use client";

import * as React from "react";
import { useState } from "react";
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
  Info,
  RotateCcw,
  ShieldCheck,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PLATFORM_COMMISSION } from "@/lib/creator";

export function OrderDetailClient({ orderId }: { orderId: string }) {
  const { orders, hydrated, isEnrolled } = useApp();
  const community = useCommunityCourses();
  const [refundOpen, setRefundOpen] = useState(false);

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
      "ZYBBLE — DEMO RECEIPT",
      "=====================",
      "",
      `Order:        ${order.id}`,
      `Date:         ${formatDate(order.createdAt)}`,
      `Course:       ${course?.title ?? order.courseId}`,
      `Status:       ${order.status.toUpperCase()} (simulated)`,
      `Amount:       ${order.total === 0 ? "Free" : formatPrice(order.total)}`,
      `Payment:      ${order.cardLast4 === "FREE" ? "Free enrollment" : `Demo card •••• ${order.cardLast4}`}`,
      `Billed to:    ${order.email}`,
      "",
      `Marketplace commission (10%, illustrative): ${order.total === 0 ? "$0.00" : formatPrice(order.total * PLATFORM_COMMISSION)}`,
      "",
      "This receipt documents a SIMULATED checkout in the Zybble demo.",
      "No real payment was processed and no card data was stored.",
    ].join("\n");
    const blob = new Blob([lines], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zybble-receipt-${order.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Demo receipt downloaded");
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/orders">
          <ArrowLeft aria-hidden />
          All orders
        </Link>
      </Button>

      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-white shadow-card">
        {/* Status header */}
        <div
          className={
            paid
              ? "flex items-center gap-3 border-b border-emerald-100 bg-emerald-50 px-6 py-4"
              : "flex items-center gap-3 border-b border-red-100 bg-red-50 px-6 py-4"
          }
        >
          {paid ? (
            <CircleCheck className="size-5 text-emerald-600" aria-hidden />
          ) : (
            <CircleX className="size-5 text-red-500" aria-hidden />
          )}
          <div>
            <p className="font-display text-[15px] font-semibold">
              {paid ? "Payment successful (simulated)" : "Payment declined (simulated)"}
            </p>
            <p className="text-[12px] text-muted-foreground">
              Order <span className="font-mono">{order.id}</span> · {formatDate(order.createdAt)}
            </p>
          </div>
          <div className="ml-auto">
            {paid ? <Badge variant="emerald">Paid</Badge> : <Badge variant="secondary">Declined</Badge>}
          </div>
        </div>

        <div className="grid gap-6 p-6 md:grid-cols-[minmax(0,1fr)_280px]">
          {/* Course block */}
          <div>
            {course ? (
              <div className="flex flex-col gap-4 sm:flex-row">
                <Link
                  href={`/courses/${course.slug}`}
                  className="relative block aspect-video w-full shrink-0 overflow-hidden rounded-lg border border-border bg-muted sm:w-52"
                >
                  <Image src={course.thumbnail} alt={course.title} fill sizes="208px" className="object-cover" />
                </Link>
                <div className="min-w-0">
                  <Link
                    href={`/courses/${course.slug}`}
                    className="font-display text-[16px] font-semibold tracking-tight hover:text-primary"
                  >
                    {course.title}
                  </Link>
                  <p className="mt-1 line-clamp-2 text-[13px] text-muted-foreground">{course.subtitle}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {paid &&
                      (enrolled ? (
                        <Button asChild size="sm">
                          <Link href={`/learn/${course.id}`}>
                            <GraduationCap aria-hidden />
                            Start learning
                          </Link>
                        </Button>
                      ) : null)}
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/courses/${course.slug}`}>
                        <Eye aria-hidden />
                        Course page
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-[13px] text-muted-foreground">
                This course is no longer available in the catalog (id: {order.courseId}).
              </p>
            )}

            {/* Breakdown */}
            <dl className="mt-6 max-w-sm space-y-2 text-[13.5px]">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Amount</dt>
                <dd className="tabular-nums">{order.total === 0 ? "Free" : formatPrice(order.total)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Platform commission (10%, illustrative)</dt>
                <dd className="tabular-nums text-zinc-500">
                  −{order.total === 0 ? formatPrice(0) : formatPrice(order.total * PLATFORM_COMMISSION)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Payment method</dt>
                <dd className="tabular-nums">
                  {order.cardLast4 === "FREE" ? "Free enrollment" : `Demo card •••• ${order.cardLast4}`}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Billed to</dt>
                <dd className="truncate pl-4">{order.email}</dd>
              </div>
              <Separator className="!my-3" />
              <div className="flex justify-between font-semibold">
                <dt>Total</dt>
                <dd className="font-display tabular-nums">
                  {order.total === 0 ? "Free" : formatPrice(order.total)}
                </dd>
              </div>
            </dl>
          </div>

          {/* Actions rail */}
          <aside className="h-fit space-y-2 rounded-xl border border-border bg-muted/40 p-4">
            <Button variant="outline" className="w-full" onClick={downloadReceipt}>
              <Download aria-hidden />
              Download receipt
            </Button>
            {paid && order.total > 0 && (
              <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setRefundOpen(true)}>
                <RotateCcw aria-hidden />
                Request refund
              </Button>
            )}
            <p className="flex items-start gap-1.5 pt-1 text-[11.5px] leading-relaxed text-zinc-400">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden />
              Covered by the 30-day money-back guarantee.
            </p>
            <p className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-zinc-400">
              <CreditCard className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Demo order — no real payment or provider involved.
            </p>
          </aside>
        </div>
      </div>

      {/* Refund dialog */}
      <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request a refund?</DialogTitle>
            <DialogDescription>
              This simulates a refund request for “{course?.title ?? "this course"}”
              {order.total > 0 ? ` (${formatPrice(order.total)})` : ""}. Nothing is really charged
              or refunded — the course remains in your library.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/50 p-3 text-[12.5px] leading-relaxed text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0 text-zinc-400" aria-hidden />
            Requests within 30 days are auto-approved per the{" "}
            <Link href="/refund-policy" className="font-medium text-primary hover:underline">
              Refund Policy
            </Link>
            . Ordered {formatDate(order.createdAt)}.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundOpen(false)}>
              Keep my course
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setRefundOpen(false);
                toast.success("Refund request submitted — simulated, no money moved");
              }}
            >
              Submit request (demo)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
