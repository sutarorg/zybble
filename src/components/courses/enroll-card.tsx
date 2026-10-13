"use client";

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
  Languages,
} from "lucide-react";
import type { Course } from "@/types";
import { formatHours } from "@/lib/format";
import { useApp } from "@/components/providers/app-providers";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export function EnrollCard({ course }: { course: Course }) {
  const router = useRouter();
  const { isEnrolled, isWishlisted, toggleWishlist, hydrated } = useApp();
  const enrolled = hydrated && isEnrolled(course.id);
  const saved = hydrated && isWishlisted(course.id);
  const discount =
    course.compareAtPrice && course.price > 0
      ? Math.round((1 - course.price / course.compareAtPrice) * 100)
      : 0;

  const includes: { icon: React.ComponentType<{ className?: string }>; label: string }[] = [
    { icon: Clock3, label: `${formatHours(course.durationMinutes)} of on-demand video` },
    { icon: CirclePlay, label: `${course.lessonsCount} lessons in ${course.curriculum.length} sections` },
    ...(course.downloadableResources > 0
      ? [{ icon: FileDown, label: `${course.downloadableResources} downloadable resources` }]
      : []),
    { icon: Languages, label: `Captions: ${course.captions.slice(0, 3).join(", ")}${course.captions.length > 3 ? ` +${course.captions.length - 3}` : ""}` },
    { icon: Award, label: "Certificate of completion" },
    { icon: InfinityIcon, label: "Lifetime access" },
  ];

  return (
    <div className="sticky top-22 rounded-xl border border-border bg-white p-5 shadow-card">
      {/* Price */}
      <div className="flex items-baseline gap-2">
        {course.price === 0 ? (
          <span className="font-display text-3xl font-bold tracking-tight text-success">Free</span>
        ) : (
          <>
            <span className="font-display text-3xl font-bold tracking-tight">${course.price}</span>
            {course.compareAtPrice && (
              <span className="text-[15px] text-zinc-400 line-through">${course.compareAtPrice}</span>
            )}
            {discount > 0 && (
              <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11.5px] font-semibold text-emerald-700">
                {discount}% off
              </span>
            )}
          </>
        )}
      </div>
      <p className="mt-1 text-[12.5px] text-muted-foreground">
        One-time purchase · USD · demo checkout
      </p>

      {/* Actions */}
      <div className="mt-4 space-y-2">
        {enrolled ? (
          <Button asChild size="lg" className="w-full">
            <Link href="/my-learning">
              <GraduationCap aria-hidden />
              Go to My Learning
            </Link>
          </Button>
        ) : (
          <Button
            size="lg"
            className="w-full"
            onClick={() => router.push(`/checkout/${course.id}`)}
          >
            {course.price === 0 ? "Enroll for free" : "Enroll now"}
          </Button>
        )}
        <Button
          variant="outline"
          size="lg"
          className={cn("w-full", saved && "border-primary/40 text-primary")}
          onClick={() => {
            const added = toggleWishlist(course.id);
            if (added) toast.success("Saved to your wishlist");
            else toast("Removed from wishlist");
          }}
        >
          <Bookmark className={cn(saved && "fill-primary text-primary")} aria-hidden />
          {saved ? "Saved to wishlist" : "Add to wishlist"}
        </Button>
      </div>

      <Separator className="my-5" />

      {/* Includes */}
      <p className="mb-3 text-[13px] font-semibold">This course includes</p>
      <ul className="space-y-2.5">
        {includes.map((item) => (
          <li key={item.label} className="flex items-center gap-2.5 text-[13px] text-muted-foreground">
            <item.icon className="size-4 shrink-0 text-zinc-400" aria-hidden />
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
