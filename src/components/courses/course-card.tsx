"use client";

import { LocalizedText, useTranslate } from "@/components/providers/localized-text";
import { useApp } from "@/components/providers/app-providers";
import { getDictionary, localeOf, translateCourse } from "@/lib/i18n";
import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { CirclePlay, Clock3, Signal, Star } from "lucide-react";
import type { Course } from "@/types";
import { getCourseInstructor, courseCategory, LEVEL_LABELS } from "@/lib/courses";
import { formatCompact, formatCount, formatDuration } from "@/lib/format";
import { categoryIcon } from "@/lib/icons";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { BookmarkButton } from "@/components/courses/bookmark-button";
import { cn } from "@/lib/utils";
import { CURRENCY } from "@/lib/money";
import { impressionSource, trackCourseEvent } from "@/lib/analytics-events";

const STATUS_BADGE: Record<string, { label: string; variant: "amber" | "violet" | "emerald" }> = {
  bestseller: { label: "Bestseller", variant: "amber" },
  popular: { label: "Popular", variant: "violet" },
  new: { label: "New", variant: "emerald" },
};

function PreviewCardLink({ children, className, "aria-label": label }: React.ComponentProps<typeof Link>) {
  return <div className={className} aria-label={label}>{children}</div>;
}

export function CourseCard({
  course: authoredCourse,
  wishlisted = false,
  priority = false,
  className,
  preview = false,
}: {
  course: Course;
  /** Non-interactive studio preview, without analytics or wishlist writes. */
  preview?: boolean;
  /** Server-read wishlist membership so the icon matches the database. */
  wishlisted?: boolean;
  /** Set on the first cards in view: they are the LCP element on a catalog page. */
  priority?: boolean;
  className?: string;
}) {
  const translateUi = useTranslate();
  const { language } = useApp();
  const d = getDictionary(language);
  const course = translateCourse(authoredCourse, language);
  const numbers = new Intl.NumberFormat(localeOf(language));
  // Zybble is INR-only: every interface language formats rupees identically.
  const currency = new Intl.NumberFormat(localeOf(language), {
    style: "currency",
    currency: CURRENCY,
    maximumFractionDigits: 2,
  });
  const cardRef = React.useRef<HTMLElement | null>(null);
  const pathname = usePathname();

  // A card only counts as an impression once it is genuinely on screen, and only
  // once per course per page load — scrolling a grid up and down is not reach.
  React.useEffect(() => {
    const node = cardRef.current;
    if (preview || !node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        trackCourseEvent({
          courseId: authoredCourse.id,
          kind: "impression",
          source: impressionSource(pathname),
        });
        observer.disconnect();
      },
      { threshold: 0.5 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [authoredCourse.id, pathname, preview]);

  const instructor = getCourseInstructor(course)!;
  const category = courseCategory(course);
  const CategoryIcon = categoryIcon(category.icon);
  const status = course.badge ? STATUS_BADGE[course.badge] : undefined;

  const CardLink = preview ? PreviewCardLink : Link;

  return (
    <article
      ref={cardRef}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-white shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-card-hover",
        className
      )}
    >
      <CardLink
        href={`/courses/${course.slug}`}
        className="flex h-full flex-col outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        aria-label={translateUi(course.title)}
      >
        {/* Thumbnail — always 16:9 */}
        <div className="relative aspect-video w-full overflow-hidden bg-muted">
          <Image
            src={course.thumbnail}
            alt={translateUi(course.title)}
            fill
            priority={priority}
            sizes="(max-width: 640px) 100vw, (max-width: 1200px) 50vw, 320px"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
          <div className="absolute top-2.5 left-2.5 flex max-w-[75%] flex-wrap gap-1.5">
            {status && <Badge variant={status.variant}><LocalizedText text={status.label} /></Badge>}
          </div>
        </div>

        {/* Body */}
        <div className="flex min-w-0 flex-1 flex-col gap-2 p-3.5 sm:p-4">
          <h3 className="font-display line-clamp-2 text-[15px] leading-snug font-semibold tracking-tight transition-colors group-hover:text-primary">
            <LocalizedText text={course.title} />
          </h3>
          <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
            <LocalizedText text={course.subtitle} />
          </p>

          <div className="flex items-center gap-2 pt-0.5">
            <Avatar className="size-5.5">
              <AvatarFallback className={cn("text-[8.5px]", instructor.avatarColor)}>
                <LocalizedText text={instructor.initials} />
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-[12px] text-muted-foreground"><LocalizedText text={instructor.name} /></span>
          </div>

          <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[12.5px]">
            <Star className="size-3.5 shrink-0 fill-star text-star" aria-hidden />
            <span className="font-semibold text-foreground"><LocalizedText text={course.rating.toFixed(1)} /></span>
            <span className="text-zinc-400">(<LocalizedText text={numbers.format(course.ratingsCount)} />)</span>
            <span className="px-0.5 text-zinc-300" aria-hidden>·</span>
            <span className="text-muted-foreground"><LocalizedText text={new Intl.NumberFormat(localeOf(language), { notation: "compact", maximumFractionDigits: 1 }).format(course.studentsCount)} /><LocalizedText text={" "} /><LocalizedText text={d.studentsLabel} /></span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
            <span className="flex items-center gap-1 whitespace-nowrap">
              <CirclePlay className="size-3.5 text-zinc-400" aria-hidden />
              <LocalizedText text={d.lessons(course.lessonsCount)} /></span>
            <span className="flex items-center gap-1 whitespace-nowrap">
              <Clock3 className="size-3.5 text-zinc-400" aria-hidden />
              <LocalizedText text={formatDuration(course.durationMinutes, language)} />
            </span>
            <span className="flex items-center gap-1 whitespace-nowrap">
              <Signal className="size-3.5 text-zinc-400" aria-hidden />
              <LocalizedText text={course.level === "beginner" ? d.levelBeginner : course.level === "intermediate" ? d.levelIntermediate : d.levelAdvanced} />
            </span>
          </div>

          {/* Price row pinned to bottom for grid alignment */}
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
            {course.pricePaise === 0 ? (
              <span className="font-display text-[15px] font-bold text-success">Free</span>
            ) : (
              <span className="flex items-baseline gap-1.5">
                <span className="font-display text-[15.5px] font-bold tracking-tight">
                  {currency.format(course.pricePaise / 100)}
                </span>
                {course.compareAtPaise && course.compareAtPaise > course.pricePaise ? (
                  <span className="text-[12px] text-zinc-400 line-through">
                    {currency.format(course.compareAtPaise / 100)}
                  </span>
                ) : null}
              </span>
            )}
          </div>
        </div>
      </CardLink>

      {!preview ? <BookmarkButton
        courseId={course.id}
        initialBookmarked={wishlisted}
        className="absolute top-2 right-2 z-10 size-10 sm:top-2.5 sm:right-2.5 sm:size-8"
      /> : null}
    </article>
  );
}

export function CourseCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-border bg-white shadow-card", className)}>
      <Skeleton className="aspect-video w-full rounded-none" />
      <div className="space-y-2.5 p-4">
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-2/3" />
        <div className="flex items-center gap-2 pt-1">
          <Skeleton className="size-5.5 rounded-full" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="flex items-center justify-between pt-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-12" />
        </div>
      </div>
    </div>
  );
}
