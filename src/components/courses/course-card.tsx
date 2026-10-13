"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
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

const STATUS_BADGE: Record<string, { label: string; variant: "amber" | "violet" | "emerald" }> = {
  bestseller: { label: "Bestseller", variant: "amber" },
  popular: { label: "Popular", variant: "violet" },
  new: { label: "New", variant: "emerald" },
};

export function CourseCard({
  course,
  className,
}: {
  course: Course;
  className?: string;
}) {
  const instructor = getCourseInstructor(course);
  const category = courseCategory(course);
  const CategoryIcon = categoryIcon(category.icon);
  const status = course.badge ? STATUS_BADGE[course.badge] : undefined;

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-white shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-card-hover",
        className
      )}
    >
      <Link
        href={`/courses/${course.slug}`}
        className="flex h-full flex-col outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        aria-label={course.title}
      >
        {/* Thumbnail — always 16:9 */}
        <div className="relative aspect-video w-full overflow-hidden bg-muted">
          <Image
            src={course.thumbnail}
            alt={course.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1200px) 50vw, 320px"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
          <div className="absolute top-2.5 left-2.5 flex max-w-[75%] flex-wrap gap-1.5">
            <Badge variant="solid_white" className="gap-1 shadow-xs">
              {React.createElement(CategoryIcon, { className: "text-primary", "aria-hidden": true })}
              {category.shortName}
            </Badge>
            {status && <Badge variant={status.variant}>{status.label}</Badge>}
          </div>
        </div>

        {/* Body */}
        <div className="flex min-w-0 flex-1 flex-col gap-2 p-3.5 sm:p-4">
          <h3 className="font-display line-clamp-2 text-[15px] leading-snug font-semibold tracking-tight transition-colors group-hover:text-primary">
            {course.title}
          </h3>
          <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
            {course.subtitle}
          </p>

          <div className="flex items-center gap-2 pt-0.5">
            <Avatar className="size-5.5">
              <AvatarFallback className={cn("text-[8.5px]", instructor.avatarColor)}>
                {instructor.initials}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-[12px] text-muted-foreground">{instructor.name}</span>
          </div>

          <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[12.5px]">
            <Star className="size-3.5 shrink-0 fill-star text-star" aria-hidden />
            <span className="font-semibold text-foreground">{course.rating.toFixed(1)}</span>
            <span className="text-zinc-400">({formatCount(course.ratingsCount)})</span>
            <span className="px-0.5 text-zinc-300" aria-hidden>·</span>
            <span className="text-muted-foreground">{formatCompact(course.studentsCount)} students</span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
            <span className="flex items-center gap-1 whitespace-nowrap">
              <CirclePlay className="size-3.5 text-zinc-400" aria-hidden />
              {course.lessonsCount} lessons
            </span>
            <span className="flex items-center gap-1 whitespace-nowrap">
              <Clock3 className="size-3.5 text-zinc-400" aria-hidden />
              {formatDuration(course.durationMinutes)}
            </span>
            <span className="flex items-center gap-1 whitespace-nowrap">
              <Signal className="size-3.5 text-zinc-400" aria-hidden />
              {LEVEL_LABELS[course.level]}
            </span>
          </div>

          {/* Price row pinned to bottom for grid alignment */}
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
            {course.price === 0 ? (
              <span className="font-display text-[15px] font-bold text-success">Free</span>
            ) : (
              <span className="flex items-baseline gap-1.5">
                <span className="font-display text-[15.5px] font-bold tracking-tight">
                  ${course.price}
                </span>
                {course.compareAtPrice && (
                  <span className="text-[12px] text-zinc-400 line-through">
                    ${course.compareAtPrice}
                  </span>
                )}
              </span>
            )}
          </div>
        </div>
      </Link>

      <BookmarkButton
        courseId={course.id}
        courseTitle={course.title}
        className="absolute top-2 right-2 z-10 size-10 sm:top-2.5 sm:right-2.5 sm:size-8"
      />
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
