"use client";

import Link from "next/link";
import { Check, Compass, GraduationCap, Hourglass } from "lucide-react";
import type { LearnerOrder } from "@/lib/learner-types";
import { formatInr } from "@/lib/money";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

/**
 * Post-checkout screen.
 *
 * This page grants nothing. It only reports what the database already says
 * about the order the user was redirected with, so a hand-typed URL cannot
 * manufacture an enrolment.
 */
export function CheckoutSuccessClient({ order }: { order: LearnerOrder | null }) {
  const item = order?.items[0];
  const paid = order?.status === "paid";
  const free = order?.isFree === true;

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
            <span className="flex size-16 items-center justify-center rounded-full bg-emerald-100">
              {paid ? (
                <Check className="size-8 text-emerald-600" strokeWidth={3} aria-hidden />
              ) : (
                <Hourglass className="size-8 text-amber-600" aria-hidden />
              )}
            </span>
            <p className="mt-5 text-[11px] font-bold tracking-[0.16em] text-emerald-700 uppercase">
              {paid ? (free ? "Enrolment complete" : "Payment confirmed") : "Confirming payment"}
            </p>
            <h1 className="font-display mt-2 text-[24px] leading-tight font-bold tracking-tight">
              {paid ? `You're enrolled in ${item?.courseTitle ?? "your course"}` : "We're still confirming your payment"}
            </h1>
            <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-muted-foreground">
              {paid
                ? "Access is live on your account now. Receipts are in your order history."
                : "Razorpay has not confirmed this payment yet, so access has not been granted. It appears the moment their webhook or our verification call succeeds — usually within a minute."}
            </p>
          </div>

          <Separator />

          <dl className="space-y-2.5 px-6 py-5 text-[13.5px] sm:px-10">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Course</dt>
              <dd className="text-right font-medium">{item?.courseTitle ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Order</dt>
              <dd className="font-mono text-[12.5px]">{order?.publicId ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Status</dt>
              <dd className="font-medium capitalize">{order?.status ?? "unknown"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Total paid</dt>
              <dd className="font-semibold tabular-nums">
                {order ? (order.isFree ? "Free" : formatInr(order.totalPaise)) : "—"}
                {order && !order.isFree && order.method !== "—" ? (
                  <span className="ml-1.5 font-normal text-zinc-400">· {order.method}</span>
                ) : null}
              </dd>
            </div>
          </dl>

          <div className="flex flex-col gap-2 px-6 pb-8 sm:flex-row sm:px-10">
            <Button asChild size="lg" className="flex-1">
              <Link href="/my-learning">
                <GraduationCap aria-hidden /> Start learning
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="flex-1">
              <Link href="/">
                <Compass aria-hidden /> Keep exploring
              </Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}