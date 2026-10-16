"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, Info, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import type { Course } from "@/types";
import { formatInr } from "@/lib/money";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

/**
 * Razorpay Checkout, mounted from the official checkout.js bundle.
 *
 * The bundle is loaded from Razorpay's own CDN and is only ever given the
 * public key id, the order id and a display name. No secret key, no signed
 * payload and no PII beyond what the checkout form itself asks for is placed in
 * the browser.
 */
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (payload: Record<string, string>) => void) => void;
    };
  }
}

const RAZORPAY_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";
let scriptPromise: Promise<boolean> | null = null;

function loadRazorpay(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<boolean>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${RAZORPAY_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(Boolean(window.Razorpay)));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const script = document.createElement("script");
    script.src = RAZORPAY_SCRIPT;
    script.async = true;
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
  return scriptPromise;
}

interface StartCheckoutResponse {
  orderId: string;
  publicId: string;
  amountPaise: number;
  isFree?: boolean;
  keyId?: string;
  checkoutOptions?: Record<string, unknown>;
  error?: string;
}

export function CheckoutClient({
  course,
  enrolled,
  checkoutBlocked,
  buyerEmail,
  buyerName,
}: {
  course: Course;
  /** Server-confirmed entitlement. */
  enrolled: boolean;
  /** Set when Razorpay cannot take this purchase right now. */
  checkoutBlocked: string | null;
  buyerEmail: string;
  buyerName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const free = course.pricePaise === 0;
  const instructor = course.instructor;
  const compareAt = course.compareAtPaise ?? null;

  async function start() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ courseId: course.id, mode: free ? "free" : "auto" }),
      });
      const payload = (await response.json()) as StartCheckoutResponse;

      if (!response.ok) {
        toast.error(payload.error ?? "Checkout is unavailable");
        setBusy(false);
        return;
      }

      // Free courses are authorised entirely on the server and are already
      // settled — there is nothing for Razorpay to do.
      if (free || payload.isFree || !payload.keyId || !payload.checkoutOptions) {
        router.push(`/checkout/success?order=${encodeURIComponent(payload.publicId)}`);
        return;
      }

      const loaded = await loadRazorpay();
      if (!loaded || !window.Razorpay) {
        toast.error("Razorpay Checkout could not be loaded. Check your connection.");
        setBusy(false);
        return;
      }

      const razorpay = new window.Razorpay({
        ...payload.checkoutOptions,
        key: payload.keyId,
        modal: {
          ondismiss: () => {
            setBusy(false);
            router.push(`/checkout/failed?course=${course.slug}&reason=dismissed`);
          },
        },
        handler: async (result: Record<string, string>) => {
          try {
            const confirmation = await fetch("/api/checkout", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                publicOrderId: payload.publicId,
                razorpayOrderId: String(result.razorpay_order_id ?? ""),
                razorpayPaymentId: String(result.razorpay_payment_id ?? ""),
                razorpaySignature: String(result.razorpay_signature ?? ""),
              }),
            });
            const confirmed = (await confirmation.json()) as { status?: string; error?: string };
            if (!confirmation.ok || confirmed.status !== "paid") {
              toast.error(confirmed.error ?? "We could not verify the payment yet");
              router.push(`/checkout/failed?course=${course.slug}&reason=verification`);
              return;
            }
            router.push(`/checkout/success?order=${encodeURIComponent(payload.publicId)}`);
          } catch {
            toast.error("We could not verify the payment yet. Email support if this persists.");
            router.push(`/checkout/failed?course=${course.slug}&reason=verification`);
          }
        },
      });

      razorpay.open();
    } catch {
      toast.error("Checkout is temporarily unavailable. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh bg-muted/40">
      <header className="sticky top-0 z-20 border-b border-border bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <Lock className="size-3.5 text-success" aria-hidden /> Secure checkout · Razorpay
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Link
          href={`/courses/${course.slug}`}
          className="inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden /> Back to course
        </Link>

        {enrolled ? (
          <div className="mx-auto mt-10 max-w-md rounded-2xl border border-border bg-white p-8 text-center shadow-card">
            <ShieldCheck className="mx-auto size-10 text-success" aria-hidden />
            <h1 className="font-display mt-4 text-xl font-bold tracking-tight">You already own this course</h1>
            <p className="mt-2 text-[14px] text-muted-foreground">{course.title} is in your library.</p>
            <Button asChild size="lg" className="mt-6 w-full">
              <Link href="/my-learning">Go to my learning</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight">Checkout</h1>
              <p className="mt-1 text-[14px] text-muted-foreground">
                Enrolling in <span className="font-medium text-foreground">{course.title}</span>
              </p>

              <div className="mt-6 space-y-6">
                <section className="rounded-xl border border-border bg-white p-5 sm:p-6">
                  <h2 className="font-display text-[15px] font-semibold">Who is buying</h2>
                  <p className="mt-2 text-[13.5px] text-muted-foreground">
                    Receipts, course access and account notices go to{" "}
                    <span className="font-medium text-foreground">{buyerEmail}</span>
                    {buyerName ? ` (${buyerName})` : ""}. Change it in{" "}
                    <Link href="/settings" className="font-medium text-primary hover:underline">
                      settings
                    </Link>
                    .
                  </p>
                </section>

                <section className="rounded-xl border border-border bg-white p-5 sm:p-6">
                  <h2 className="font-display text-[15px] font-semibold">Payment</h2>
                  <p className="mt-2 text-[13.5px] text-muted-foreground">
                    {free
                      ? "This course is free. Enrolling creates a real entitlement on your account immediately — no payment provider is involved."
                      : "Razorpay Checkout opens next. It accepts UPI, cards, netbanking, wallets and EMI as configured on your Razorpay account. Zybble never sees or stores your card or UPI credentials."}
                  </p>
                </section>

                {checkoutBlocked && !free ? (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
                    {checkoutBlocked}
                  </p>
                ) : (
                  <Button size="lg" className="w-full sm:w-auto" loading={busy} onClick={() => void start()}>
                    {free ? "Complete free enrollment" : `Pay ${formatInr(course.pricePaise)}`}
                  </Button>
                )}

                <div className="flex items-start gap-2.5 rounded-lg border border-border bg-white p-3">
                  <Info className="mt-0.5 size-4 shrink-0 text-zinc-400" aria-hidden />
                  <p className="text-[12px] leading-relaxed text-muted-foreground">
                    Access is granted only after Razorpay confirms the payment was captured — never because you
                    reached the success page. If your access has not appeared within a minute, refresh My Learning or
                    contact support from the Help Center.
                  </p>
                </div>
              </div>
            </div>

            <aside className="h-fit lg:sticky lg:top-24">
              <div className="overflow-hidden rounded-xl border border-border bg-white shadow-card">
                <div className="relative aspect-video w-full bg-muted">
                  {course.thumbnail ? (
                    <Image src={course.thumbnail} alt="" fill sizes="380px" className="object-cover" />
                  ) : null}
                </div>
                <div className="p-5">
                  <h2 className="font-display text-[15px] leading-snug font-semibold tracking-tight">{course.title}</h2>
                  {instructor ? (
                    <p className="mt-1 text-[12.5px] text-muted-foreground">by {instructor.name}</p>
                  ) : null}

                  <Separator className="my-4" />

                  <dl className="space-y-2 text-[13.5px]">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Course price</dt>
                      <dd className="tabular-nums">{free ? "Free" : formatInr(compareAt && compareAt > course.pricePaise ? compareAt : course.pricePaise)}</dd>
                    </div>
                    {compareAt && compareAt > course.pricePaise && !free ? (
                      <div className="flex justify-between text-success">
                        <dt>Discount</dt>
                        <dd className="tabular-nums">−{formatInr(compareAt - course.pricePaise)}</dd>
                      </div>
                    ) : null}
                    <div className="flex justify-between border-t border-border pt-2.5 font-semibold">
                      <dt>Total payable</dt>
                      <dd className="font-display text-[16px] tabular-nums">{free ? "Free" : formatInr(course.pricePaise)}</dd>
                    </div>
                  </dl>

                  <p className="mt-3 text-[11.5px] text-zinc-400">
                    Amounts are in Indian Rupees and no tax line is added to your order — your receipt is the
                    Razorpay payment record.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}