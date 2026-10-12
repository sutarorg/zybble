"use client";

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
  const railRef = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: 1 | -1) => {
    const el = railRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  const arrows = (
    <div className="hidden items-center gap-1 md:flex">
      <button
        type="button"
        aria-label={`Scroll ${title} back`}
        onClick={() => scrollBy(-1)}
        className="flex size-8 cursor-pointer items-center justify-center rounded-lg border border-border bg-white text-muted-foreground shadow-xs transition-colors hover:bg-muted hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
      </button>
      <button
        type="button"
        aria-label={`Scroll ${title} forward`}
        onClick={() => scrollBy(1)}
        className="flex size-8 cursor-pointer items-center justify-center rounded-lg border border-border bg-white text-muted-foreground shadow-xs transition-colors hover:bg-muted hover:text-foreground"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );

  return (
    <section className={className}>
      <SectionHeader title={title} description={description} onViewAll={onViewAll} actions={arrows} />
      <div
        ref={railRef}
        className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 scrollbar-hide sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
      >
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <CourseCardSkeleton key={i} className="w-[280px] shrink-0 snap-start sm:w-[300px]" />
            ))
          : courses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                className="w-[280px] shrink-0 snap-start sm:w-[300px]"
              />
            ))}
      </div>
    </section>
  );
}
