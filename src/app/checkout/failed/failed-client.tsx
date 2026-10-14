"use client";

import Link from "next/link";
import { CircleX, CreditCard, HelpCircle, RotateCcw } from "lucide-react";
import type { Course } from "@/types";
import { formatInr } from "@/lib/money";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const REASONS: Record<string, { heading: string; body: string }> = {
  dismissed: {
    heading: "You closed the payment window",
    body: "Razorpay Checkout was dismissed before a payment was made. No money left your account and no order was created.",
  },
  verification: {
    heading: "We could not verify the payment yet",
    body: "Razorpay did not return a captured payment for this attempt, so access has not been granted. If your bank shows a debit, the Razorpay webhook will settle it within a few minutes and the course will appear in My Learning automatically.",
  },
  declined: {
    heading: "Your bank or Razorpay declined the payment",
    body: "The payment was not captured, so no money was taken and no access was granted. Try another method — UPI, a different card, or netbanking.",
  },
};

export function CheckoutFailedClient({
  course,
  reason,
}: {
  /** Read on the server; `null` when the slug is unknown to the catalog. */
  course: Pick<Course, "id" | "title" | "pricePaise"> | null;
  reason: string;
}) {
  const detail = REASONS[reason] ?? {
    heading: "The payment did not complete",
    body: "No payment was captured, so no access was granted. You can try again, or contact support with the time of the attempt.",
  };

  return (
    <div className="flex min-h-dvh flex-col bg-muted/40">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
          <Logo />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-white shadow-card">
          <div className="flex flex-col items-center px-6 pt-10 pb-6 text-center sm:px-10">
            <span className="flex size-16 items-center justify-center rounded-full bg-red-100">
              <CircleX className="size-8 text-red-600" aria-hidden />
            </span>
            <p className="mt-5 text-[11px] font-bold tracking-[0.16em] text-red-600 uppercase">Payment not completed</p>
            <h1 className="font-display mt-2 text-[24px] leading-tight font-bold tracking-tight">{detail.heading}</h1>
            <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-muted-foreground">{detail.body}</p>
          </div>

          <Separator />

          <div className="space-y-3 px-6 py-5 sm:px-10">
            <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/60 p-3.5">
              <CreditCard className="mt-0.5 size-4 shrink-0 text-zinc-400" aria-hidden />
              <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                Zybble never sees your card, UPI or bank credentials — those stay inside Razorpay Checkout. If money did
                leave your account but the course never unlocked, email support with the time of the attempt and we
                will reconcile it against the Razorpay record.
              </p>
            </div>
            {course ? (
              <>
                <div className="flex justify-between text-[13.5px]">
                  <span className="text-muted-foreground">Course</span>
                  <span className="font-medium">{course.title}</span>
                </div>
                <div className="flex justify-between text-[13.5px]">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-semibold tabular-nums">
                    {course.pricePaise === 0 ? "Free" : formatInr(course.pricePaise)}
                  </span>
                </div>
              </>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 px-6 pb-8 sm:flex-row sm:px-10">
            {course ? (
              <Button asChild size="lg" className="flex-1">
                <Link href={`/checkout/${course.id}`}>
                  <RotateCcw aria-hidden /> Try again
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="outline" size="lg" className="flex-1">
              <Link href="/help">
                <HelpCircle aria-hidden /> Get help
              </Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}