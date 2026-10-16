"use client";

import { LocalizedText, useTranslate } from "@/components/providers/localized-text";
import * as React from "react";
import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Course } from "@/types";
import { CourseCard, CourseCardSkeleton } from "@/components/courses/course-card";
import { SectionHeader } from "@/components/courses/section-header";
import { cn } from "@/lib/utils";

export function CourseCarousel({
  title,
  description,
  courses,
  onViewAll,
  loading = false,
  className,
}: {
  title: string;
  description?: string;
  courses: Course[];
  onViewAll?: () => void;
  loading?: boolean;
  className?: string;
}) {
  const translateUi = useTranslate();
  const railRef = useRef<HTMLUListElement>(null);

  const scrollBy = (dir: 1 | -1) => {
    const el = railRef.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({
      left: dir * el.clientWidth * 0.8,
      behavior: reduced ? "auto" : "smooth",
    });
  };

  const arrows = (
    <div className="hidden items-center gap-1 md:flex">
      <button
        type="button"
        aria-label={translateUi(`Scroll ${title} back`)}
        onClick={() => scrollBy(-1)}
        className="flex size-9 cursor-pointer items-center justify-center rounded-lg border border-border bg-white text-muted-foreground shadow-xs transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:outline-none"
      >
        <ChevronLeft className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        aria-label={translateUi(`Scroll ${title} forward`)}
        onClick={() => scrollBy(1)}
        className="flex size-9 cursor-pointer items-center justify-center rounded-lg border border-border bg-white text-muted-foreground shadow-xs transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:outline-none"
      >
        <ChevronRight className="size-4" aria-hidden />
      </button>
    </div>
  );

  return (
    <section className={className}>
      <SectionHeader title={translateUi(title)} description={description} onViewAll={onViewAll} actions={arrows} />
      <ul
        ref={railRef}
        aria-label={translateUi(title)}
        className="-mr-4 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-contain-x pr-4 pb-2 scrollbar-hide sm:-mr-6 sm:pr-6 lg:-mr-10 lg:pr-10"
      >
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="w-[248px] shrink-0 snap-start sm:w-[300px]">
                <CourseCardSkeleton className="h-full" />
              </li>
            ))
          : courses.map((course, index) => (
              <li key={course.id} className="w-[248px] shrink-0 snap-start sm:w-[300px]">
                {/* The first three cards are above the fold: fetch their
                    thumbnails with the document rather than after layout. */}
                <CourseCard course={course} priority={index < 3} className="h-full" />
              </li>
            ))}
      </ul>
    </section>
  );
}
