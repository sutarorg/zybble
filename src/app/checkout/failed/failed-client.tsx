"use client";

import { LocalizedText } from "@/components/providers/localized-text";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { CircleX, CreditCard, HelpCircle, RotateCcw } from "lucide-react";
import { getCourseBySlug } from "@/lib/courses";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function CheckoutFailedClient({ courseSlug }: { courseSlug: string }) {
  const router = useRouter();
  const course = getCourseBySlug(courseSlug);

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
            <span className="flex size-16 items-center justify-center rounded-full bg-red-100">
              <CircleX className="size-8 text-red-600" aria-hidden />
            </span>
            <p className="mt-5 text-[11px] font-bold tracking-[0.16em] text-red-600 uppercase"><LocalizedText text={"Payment declined"} /></p>
            <h1 className="font-display mt-2 text-[24px] leading-tight font-bold tracking-tight"><LocalizedText text={"We couldn't complete your enrollment"} /></h1>
            <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-muted-foreground"><LocalizedText text={"Don't worry — nothing was charged (nothing ever is, in this preview). You can try a different card below."} /></p>
          </div>

          <Separator />

          <div className="space-y-3 px-6 py-5 sm:px-10">
            <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/60 p-3.5">
              <CreditCard className="mt-0.5 size-4 shrink-0 text-zinc-400" aria-hidden />
              <div className="text-[12.5px] leading-relaxed text-muted-foreground">
                <p className="font-medium text-foreground"><LocalizedText text={"About this simulated decline"} /></p>
                <p className="mt-0.5"><LocalizedText text={"The preview card"} /><code className="rounded bg-white px-1 font-mono text-[11.5px]">4000 0000 0000 0002</code><LocalizedText text={" "} /><LocalizedText text={"always fails. Any other formatted number succeeds."} /></p>
              </div>
            </div>
            <div className="flex justify-between text-[13.5px]">
              <span className="text-muted-foreground"><LocalizedText text={"Course"} /></span>
              <span className="font-medium"><LocalizedText text={course.title} /></span>
            </div>
            <div className="flex justify-between text-[13.5px]">
              <span className="text-muted-foreground"><LocalizedText text={"Amount"} /></span>
              <span className="font-semibold">$<LocalizedText text={course.price.toFixed(2)} /></span>
            </div>
          </div>

          <div className="flex flex-col gap-2 px-6 pb-8 sm:flex-row sm:px-10">
            <Button asChild size="lg" className="flex-1">
              <Link href={`/checkout/${course.id}`}>
                <RotateCcw aria-hidden /><LocalizedText text={"Try again"} /></Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="flex-1">
              <Link href="/help">
                <HelpCircle aria-hidden /><LocalizedText text={"Get help"} /></Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
