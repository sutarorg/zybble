"use client";

import { LocalizedText } from "@/components/providers/localized-text";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Check, Compass, GraduationCap, PartyPopper } from "lucide-react";
import { getCourseBySlug } from "@/lib/courses";
import { useApp } from "@/components/providers/app-providers";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatDate, formatPrice } from "@/lib/format";

export function CheckoutSuccessClient({
  orderId,
  courseSlug,
}: {
  orderId: string;
  courseSlug: string;
}) {
  const router = useRouter();
  const { orders, hydrated } = useApp();

  const course = getCourseBySlug(courseSlug);
  const order = orders.find((o) => o.id === orderId);

  useEffect(() => {
    if (!course) router.replace("/");
  }, [course, router]);

  if (!course) return null;

  return (
    <div className="flex min-h-dvh flex-col bg-muted/40">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700"><LocalizedText text={"No real payment is processed"} /></span>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-white shadow-card">
          <div className="flex flex-col items-center px-6 pt-10 pb-6 text-center sm:px-10">
            <span className="relative flex size-16 items-center justify-center rounded-full bg-emerald-100">
              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-200/60" aria-hidden />
              <Check className="relative size-8 text-emerald-600" strokeWidth={3} aria-hidden />
            </span>
            <p className="mt-5 flex items-center gap-1.5 text-[11px] font-bold tracking-[0.16em] text-emerald-700 uppercase">
              <PartyPopper className="size-3.5" aria-hidden /><LocalizedText text={"Enrollment confirmed"} /></p>
            <h1 className="font-display mt-2 text-[24px] leading-tight font-bold tracking-tight"><LocalizedText text={"You're enrolled in"} /><LocalizedText text={course.title} />
            </h1>
            <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-muted-foreground">
              {<LocalizedText text={order?.email
                ? `A receipt was (not really) sent to ${order.email}.`
                : "Your preview enrollment is complete."} />}<LocalizedText text={" "} /><LocalizedText text={"The course is waiting for you in My Learning."} /></p>
          </div>

          <Separator />

          <dl className="space-y-2.5 px-6 py-5 text-[13.5px] sm:px-10">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground"><LocalizedText text={"Course"} /></dt>
              <dd className="text-right font-medium"><LocalizedText text={course.title} /></dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground"><LocalizedText text={"Order"} /></dt>
              <dd className="font-mono text-[12.5px]"><LocalizedText text={orderId || "—"} /></dd>
            </div>
            {order && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground"><LocalizedText text={"Date"} /></dt>
                <dd><LocalizedText text={formatDate(order.createdAt)} /></dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground"><LocalizedText text={"Total paid"} /></dt>
              <dd className="font-semibold">
                <LocalizedText text={hydrated && order ? formatPrice(order.total) : formatPrice(course.price)} />
                {order && order.cardLast4 !== "FREE" && (
                  <span className="text-zinc-400"><LocalizedText text={"· card ••••"} /><LocalizedText text={order.cardLast4} /></span>
                )}
              </dd>
            </div>
          </dl>

          <div className="flex flex-col gap-2 px-6 pb-8 sm:flex-row sm:px-10">
            <Button asChild size="lg" className="flex-1">
              <Link href="/my-learning">
                <GraduationCap aria-hidden /><LocalizedText text={"Start learning"} /></Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="flex-1">
              <Link href="/">
                <Compass aria-hidden /><LocalizedText text={"Keep exploring"} /></Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
