"use client";

import * as React from "react";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, Banknote, Info, Lock, ShieldCheck } from "lucide-react";
import type { Course, Order } from "@/types";
import { getCourseInstructor } from "@/lib/courses";
import { useApp } from "@/components/providers/app-providers";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

const FAIL_CARD = "4000000000000002";
const COUNTRIES = ["United States", "United Kingdom", "Germany", "France", "Spain", "Portugal", "Brazil", "Nigeria", "India", "Japan", "Australia", "Canada"];

function formatCardNumber(v: string) {
  return v.replace(/\D/g, "").slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 ");
}

function formatExpiry(v: string) {
  const digits = v.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export function CheckoutClient({ course }: { course: Course }) {
  const router = useRouter();
  const { user, completeOrder, isEnrolled, hydrated } = useApp();
  const instructor = getCourseInstructor(course);
  const free = course.price === 0;

  /* `null` = untouched, so the signed-in user's details prefill the form
     without an effect once the session hydrates. */
  const [emailDraft, setEmailDraft] = useState<string | null>(null);
  const [cardNameDraft, setCardNameDraft] = useState<string | null>(null);
  const email = emailDraft ?? user?.email ?? "";
  const cardName = cardNameDraft ?? user?.name ?? "";
  const setEmail = setEmailDraft;
  const setCardName = setCardNameDraft;
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [country, setCountry] = useState("United States");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState(false);

  const enrolled = hydrated && isEnrolled(course.id);

  const buildOrder = (status: Order["status"]): Order => ({
    id: `zyb_${Math.random().toString(36).slice(2, 10)}`,
    courseId: course.id,
    userId: user?.id ?? null,
    email: email.trim().toLowerCase(),
    total: course.price,
    createdAt: new Date().toISOString(),
    status,
    cardLast4: free ? "FREE" : cardNumber.replace(/\s/g, "").slice(-4),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "Enter a valid email address.";
    if (!free) {
      if (cardName.trim().length < 2) next.cardName = "Enter the name on the card.";
      const digits = cardNumber.replace(/\s/g, "");
      if (digits.length < 15) next.cardNumber = "Enter a valid card number.";
      if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)) next.expiry = "Use MM/YY.";
      if (!/^\d{3,4}$/.test(cvc)) next.cvc = "3–4 digits.";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setProcessing(true);
    window.setTimeout(() => {
      const failed = !free && cardNumber.replace(/\s/g, "") === FAIL_CARD;
      if (failed) {
        completeOrder(buildOrder("failed"));
        router.push(`/checkout/failed?course=${course.slug}`);
        return;
      }
      const order = buildOrder("paid");
      completeOrder(order);
      router.push(`/checkout/success?order=${order.id}&course=${course.slug}`);
    }, 1600);
  };

  return (
    <div className="min-h-dvh bg-muted/40">
      {/* Minimal checkout chrome */}
      <header className="sticky top-0 z-20 border-b border-border bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <p className="hidden items-center gap-1.5 text-[13px] text-muted-foreground sm:flex">
            <Lock className="size-3.5 text-success" aria-hidden />
            Secure checkout
          </p>
          <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700">
            Demo — no real payment
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Link
          href={`/courses/${course.slug}`}
          className="inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to course
        </Link>

        {enrolled ? (
          <div className="mx-auto mt-10 max-w-md rounded-2xl border border-border bg-white p-8 text-center shadow-card">
            <ShieldCheck className="mx-auto size-10 text-success" aria-hidden />
            <h1 className="font-display mt-4 text-xl font-bold tracking-tight">
              You already own this course
            </h1>
            <p className="mt-2 text-[14px] text-muted-foreground">
              “{course.title}” is in your library. Time to keep learning.
            </p>
            <Button asChild size="lg" className="mt-6 w-full">
              <Link href="/my-learning">Go to My Learning</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
            {/* Payment form */}
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight">Checkout</h1>
              <p className="mt-1 text-[14px] text-muted-foreground">
                Enroll in <span className="font-medium text-foreground">{course.title}</span>
              </p>

              <form onSubmit={submit} noValidate className="mt-6 space-y-6">
                <section className="rounded-xl border border-border bg-white p-5 sm:p-6">
                  <h2 className="font-display text-[15px] font-semibold">Contact</h2>
                  <div className="mt-4 space-y-1.5">
                    <Label htmlFor="ck-email">Email for course access</Label>
                    <Input
                      id="ck-email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      aria-invalid={!!errors.email}
                    />
                    {errors.email && <p className="text-[12px] text-destructive">{errors.email}</p>}
                  </div>
                </section>

                {!free && (
                  <section className="rounded-xl border border-border bg-white p-5 sm:p-6">
                    <div className="flex items-center justify-between">
                      <h2 className="font-display text-[15px] font-semibold">Payment</h2>
                      <div className="flex gap-1.5" aria-hidden>
                        {["VISA", "MC", "AMEX"].map((b) => (
                          <span key={b} className="rounded border border-border bg-muted px-1.5 py-0.5 text-[9.5px] font-bold text-zinc-500">
                            {b}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="mt-4 space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="ck-name">Name on card</Label>
                        <Input
                          id="ck-name"
                          autoComplete="cc-name"
                          placeholder="Alex Carter"
                          value={cardName}
                          onChange={(e) => setCardName(e.target.value)}
                          aria-invalid={!!errors.cardName}
                        />
                        {errors.cardName && <p className="text-[12px] text-destructive">{errors.cardName}</p>}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="ck-number">Card number</Label>
                        <Input
                          id="ck-number"
                          inputMode="numeric"
                          autoComplete="cc-number"
                          placeholder="4242 4242 4242 4242"
                          value={cardNumber}
                          onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                          aria-invalid={!!errors.cardNumber}
                        />
                        {errors.cardNumber && <p className="text-[12px] text-destructive">{errors.cardNumber}</p>}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="ck-exp">Expiry</Label>
                          <Input
                            id="ck-exp"
                            inputMode="numeric"
                            autoComplete="cc-exp"
                            placeholder="MM/YY"
                            value={expiry}
                            onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                            aria-invalid={!!errors.expiry}
                          />
                          {errors.expiry && <p className="text-[12px] text-destructive">{errors.expiry}</p>}
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="ck-cvc">CVC</Label>
                          <Input
                            id="ck-cvc"
                            inputMode="numeric"
                            autoComplete="cc-csc"
                            placeholder="123"
                            value={cvc}
                            onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                            aria-invalid={!!errors.cvc}
                          />
                          {errors.cvc && <p className="text-[12px] text-destructive">{errors.cvc}</p>}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="ck-country">Country</Label>
                        <Select value={country} onValueChange={setCountry}>
                          <SelectTrigger id="ck-country">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {COUNTRIES.map((c) => (
                              <SelectItem key={c} value={c}>
                                {c}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-start gap-2.5 rounded-lg border border-violet-200 bg-accent p-3">
                        <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                        <p className="text-[12px] leading-relaxed text-violet-950/70">
                          Demo cards: any formatted number succeeds — except{" "}
                          <code className="rounded bg-white px-1 font-mono text-[11px] text-violet-900">
                            4000 0000 0000 0002
                          </code>
                          , which simulates a decline.
                        </p>
                      </div>
                    </div>
                  </section>
                )}

                <Button type="submit" size="lg" className="w-full sm:w-auto" loading={processing}>
                  {processing
                    ? "Processing…"
                    : free
                      ? "Complete free enrollment"
                      : `Pay $${course.price.toFixed(2)}`}
                </Button>
                <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                  <Lock className="size-3.5" aria-hidden />
                  This is a simulated checkout. No payment is processed and no card data leaves your
                  browser.
                </p>
              </form>
            </div>

            {/* Order summary */}
            <aside className="h-fit lg:sticky lg:top-24">
              <div className="overflow-hidden rounded-xl border border-border bg-white shadow-card">
                <div className="relative aspect-video w-full bg-muted">
                  <Image
                    src={course.thumbnail}
                    alt={course.title}
                    fill
                    sizes="380px"
                    className="object-cover"
                  />
                </div>
                <div className="p-5">
                  <h2 className="font-display text-[15px] leading-snug font-semibold tracking-tight">
                    {course.title}
                  </h2>
                  <p className="mt-1 text-[12.5px] text-muted-foreground">by {instructor.name}</p>

                  <Separator className="my-4" />

                  <dl className="space-y-2 text-[13.5px]">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Price</dt>
                      <dd className="tabular-nums">
                        {free ? "Free" : `$${(course.compareAtPrice ?? course.price).toFixed(2)}`}
                      </dd>
                    </div>
                    {course.compareAtPrice && !free && (
                      <div className="flex justify-between text-success">
                        <dt>Discount</dt>
                        <dd className="tabular-nums">
                          −${(course.compareAtPrice - course.price).toFixed(2)}
                        </dd>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-border pt-2.5 font-semibold">
                      <dt>Total</dt>
                      <dd className="font-display text-[16px] tabular-nums">
                        {free ? "Free" : `$${course.price.toFixed(2)}`}
                      </dd>
                    </div>
                  </dl>

                  <p className="mt-4 flex items-center gap-2 text-[12px] text-muted-foreground">
                    <ShieldCheck className="size-4 shrink-0 text-success" aria-hidden />
                    30-day money-back guarantee
                  </p>
                  <p className="mt-2 flex items-center gap-2 text-[12px] text-muted-foreground">
                    <Banknote className="size-4 shrink-0 text-zinc-400" aria-hidden />
                    Taxes included. Charged in USD (demo).
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
