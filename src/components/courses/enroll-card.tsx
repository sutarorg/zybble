"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Award,
  Bookmark,
  CirclePlay,
  Clock3,
  FileDown,
  GraduationCap,
  Infinity as InfinityIcon,
  ShieldCheck,
} from "lucide-react";
import type { Course } from "@/types";
import { formatHours } from "@/lib/format";
import { formatInr } from "@/lib/money";
import { useApp } from "@/components/providers/app-providers";
import { toggleWishlist } from "@/app/(learner)/actions";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

/**
 * Purchase card.
 *
 * `enrolled` and `saved` are decided on the server and passed in: the browser
 * cannot mark itself as owning a course. `checkoutBlocked` is set only when
 * paid checkout is unavailable in the environment (for example when Razorpay
 * keys are not configured).
 */
export function EnrollCard({
  course,
  enrolled = false,
  saved = false,
  checkoutBlocked = null,
}: {
  course: Course;
  enrolled: boolean;
  saved: boolean;
  /** Human-readable reason paid checkout is unavailable, or `null`. */
  checkoutBlocked?: string | null;
}) {
  const router = useRouter();
  const { session } = useApp();
  const [wishlisted, setWishlisted] = React.useState(saved);
  const [busy, setBusy] = React.useState(false);

  const isFree = course.pricePaise === 0;
  const compareAt = course.compareAtPaise ?? null;
  const discount =
    compareAt && course.pricePaise > 0 && compareAt > course.pricePaise
      ? Math.round((1 - course.pricePaise / compareAt) * 100)
      : 0;

  const includes: { icon: React.ComponentType<{ className?: string }>; label: string }[] = [
    { icon: Clock3, label: `${formatHours(course.durationMinutes)} of on-demand video` },
    { icon: CirclePlay, label: `${course.lessonsCount} lessons in ${course.curriculum.length} sections` },
    ...(course.downloadableResources > 0
      ? [{ icon: FileDown, label: `${course.downloadableResources} downloadable resources` }]
      : []),
    { icon: Award, label: "Certificate of completion" },
    { icon: InfinityIcon, label: "Lifetime access" },
  ];

  return (
    <div className="sticky top-22 rounded-xl border border-border bg-white p-5 shadow-card">
      <div className="flex items-baseline gap-2">
        {isFree ? (
          <span className="font-display text-3xl font-bold tracking-tight text-success">Free</span>
        ) : (
          <>
            <span className="font-display text-3xl font-bold tracking-tight">
              {formatInr(course.pricePaise)}
            </span>
            {compareAt && compareAt > course.pricePaise ? (
              <span className="text-[15px] text-zinc-400 line-through">{formatInr(compareAt)}</span>
            ) : null}
            {discount > 0 ? (
              <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11.5px] font-semibold text-emerald-700">
                {discount}% off
              </span>
            ) : null}
          </>
        )}
      </div>
      <p className="mt-1 text-[12.5px] text-muted-foreground">
        {isFree ? "Free to enroll · lifetime access" : `One-time purchase · INR (₹) · paid via Razorpay`}
      </p>

      <div className="mt-4 space-y-2">
        {enrolled ? (
          <Button asChild size="lg" className="w-full">
            <Link href={`/learn/${course.id}`}>
              <GraduationCap aria-hidden /> Go to my learning
            </Link>
          </Button>
        ) : session ? (
          <Button
            size="lg"
            className="w-full"
            disabled={Boolean(checkoutBlocked) && !isFree}
            onClick={() => router.push(`/checkout/${course.id}`)}
          >
            {isFree ? "Enroll for free" : "Enroll now"}
          </Button>
        ) : (
          <Button asChild size="lg" className="w-full">
            <Link href={`/login?next=/checkout/${course.id}`}>Sign in to enroll</Link>
          </Button>
        )}

        <Button
          variant="outline"
          size="lg"
          className={cn("w-full", wishlisted && "border-primary/40 text-primary")}
          disabled={!session || busy}
          onClick={() => {
            setBusy(true);
            void toggleWishlist(course.id)
              .then((result) => {
                if (!result.ok) {
                  toast.error(result.error ?? "Could not update your wishlist");
                  return;
                }
                setWishlisted((previous) => !previous);
                toast.success(wishlisted ? "Removed from wishlist" : "Saved to your wishlist");
                router.refresh();
              })
              .finally(() => setBusy(false));
          }}
        >
          <Bookmark className={cn(wishlisted && "fill-primary text-primary")} aria-hidden />
          {wishlisted ? "Saved to wishlist" : "Add to wishlist"}
        </Button>
      </div>

      {checkoutBlocked && !isFree ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
          {checkoutBlocked}
        </p>
      ) : null}

      <Separator className="my-5" />

      <p className="mb-3 text-[13px] font-semibold">This course includes</p>
      <ul className="space-y-2.5">
        {includes.map((item) => (
          <li key={item.label} className="flex items-center gap-2.5 text-[13px] text-muted-foreground">
            <item.icon className="size-4 shrink-0 text-zinc-400" aria-hidden />
            {item.label}
          </li>
        ))}
      </ul>

      <p className="mt-4 flex items-start gap-1.5 text-[11.5px] text-zinc-400">
        <ShieldCheck className="mt-px size-3.5 shrink-0" aria-hidden />
        Access is granted only after Razorpay confirms your payment. Zybble publishes no refund policy.
      </p>
    </div>
  );
}