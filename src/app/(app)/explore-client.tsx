"use client";

import { LocalizedText, useTranslate } from "@/components/providers/localized-text";
import * as React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Course, CourseFilters, SortOption } from "@/types";
import { getCategoryBySlug, sortCourses } from "@/lib/courses";
import { CategoryChips } from "@/components/courses/category-chips";
import { CourseBrowser } from "@/components/courses/course-browser";
import { CourseCarousel } from "@/components/courses/course-carousel";
import { useApp } from "@/components/providers/app-providers";
import { getDictionary } from "@/lib/i18n";

interface Preset {
  key: string;
  label: string;
  sort?: SortOption;
  filters?: Partial<CourseFilters>;
}

export function ExploreClient({ q, courses }: { q: string; courses: Course[] }) {
  const translateUi = useTranslate();
  const router = useRouter();
  const { language } = useApp();
  const dict = getDictionary(language);
  const [category, setCategory] = useState<string | null>(null);
  const [preset, setPreset] = useState<Preset | null>(null);

  const curated = !q.trim() && !category && !preset;
  const activeCategory = category ? getCategoryBySlug(category) : undefined;

  const reset = () => {
    setCategory(null);
    setPreset(null);
    if (q) router.replace("/");
  };

  // Every record here was read from Postgres as a published course; an empty
  // catalog renders the empty state rather than placeholder content.
  const pool = React.useMemo(() => courses, [courses]);
  const popular = React.useMemo(() => sortCourses(courses, "popular").slice(0, 8), [courses]);
  const newest = React.useMemo(() => sortCourses(courses, "newest").slice(0, 8), [courses]);
  const topRated = React.useMemo(() => sortCourses(courses, "rating").slice(0, 8), [courses]);
  const free = React.useMemo(() => courses.filter((c) => c.pricePaise === 0), [courses]);

  return (
    <div className="page-container py-7 sm:py-9">
      {/* Page header */}
      <header>
        <p className="text-[11px] font-bold tracking-[0.14em] text-primary uppercase">
          <LocalizedText text={dict.exploreEyebrow} />
        </p>
        <h1 className="font-display mt-2 text-[26px] leading-tight font-bold tracking-tight sm:text-[34px]">
          <LocalizedText text={dict.exploreTitle} />
        </h1>
        <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-muted-foreground">
          <LocalizedText text={dict.exploreSubtitle} />
        </p>
      </header>

      {/* Category chips — always visible for quick switching */}
      <CategoryChips
        value={category}
        onChange={(slug) => {
          setCategory(slug);
          setPreset(null);
        }}
        className="mt-6"
      />

      {curated ? (
        <>
          <div className="mt-12 space-y-12">
            <CourseCarousel
              title={translateUi(dict.popularCourses)}
              description={translateUi(dict.popularCoursesDesc)}
              courses={popular}
              onViewAll={() => setPreset({ key: "popular", label: dict.popularCourses, sort: "popular" })}
            />
            <CourseCarousel
              title={translateUi(dict.newCourses)}
              description={translateUi(dict.newCoursesDesc)}
              courses={newest}
              onViewAll={() => setPreset({ key: "newest", label: dict.newCourses, sort: "newest" })}
            />
            <CourseCarousel
              title={translateUi(dict.topRated)}
              description={translateUi(dict.topRatedDesc)}
              courses={topRated}
              onViewAll={() => setPreset({ key: "rating", label: dict.topRated, sort: "rating" })}
            />
            <CourseCarousel
              title={translateUi(dict.freeCourses)}
              description={translateUi(dict.freeCoursesDesc)}
              courses={free}
              onViewAll={() =>
                setPreset({
                  key: "free",
                  label: dict.freeCourses,
                  sort: "rating",
                  filters: { price: "free" },
                })
              }
            />
          </div>
        </>
      ) : (
        <div className="mt-7">
          <h2 className="font-display text-xl font-semibold tracking-tight">
            {<LocalizedText text={q.trim()
              ? dict.searchResults
              : activeCategory
                ? activeCategory.name
                : (preset?.label ?? dict.allCourses)} />}
          </h2>
          {activeCategory && !q.trim() && (
            <p className="mt-1 text-[13.5px] text-muted-foreground"><LocalizedText text={activeCategory.description} /></p>
          )}
          <CourseBrowser
            key={`${preset?.key}|${category}`}
            className="mt-5"
            pool={category ? pool.filter((c) => c.category === category) : pool}
            q={q}
            defaultSort={preset?.sort ?? "popular"}
            initialFilters={preset?.filters}
            onResetQuery={reset}
          />
        </div>
      )}
    </div>
  );
}
