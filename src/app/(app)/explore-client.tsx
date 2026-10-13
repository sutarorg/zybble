"use client";

import * as React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CourseFilters, SortOption } from "@/types";
import { COURSES } from "@/data/mock-data";
import { getCategoryBySlug, sortCourses } from "@/lib/courses";
import { CategoryChips } from "@/components/courses/category-chips";
import { CourseBrowser } from "@/components/courses/course-browser";
import { CourseCarousel } from "@/components/courses/course-carousel";
import { useCommunityCourses } from "@/components/providers/creator-provider";
import { useApp } from "@/components/providers/app-providers";
import { getDictionary } from "@/lib/i18n";

interface Preset {
  key: string;
  label: string;
  sort?: SortOption;
  filters?: Partial<CourseFilters>;
}

export function ExploreClient({ q }: { q: string }) {
  const router = useRouter();
  const { language } = useApp();
  const dict = getDictionary(language);
  const community = useCommunityCourses();
  const [category, setCategory] = useState<string | null>(null);
  const [preset, setPreset] = useState<Preset | null>(null);

  const curated = !q.trim() && !category && !preset;
  const activeCategory = category ? getCategoryBySlug(category) : undefined;

  const reset = () => {
    setCategory(null);
    setPreset(null);
    if (q) router.replace("/");
  };

  // Static catalog + courses published locally from the creator studio.
  const pool = React.useMemo(() => [...community, ...COURSES], [community]);
  const popular = React.useMemo(() => sortCourses(COURSES, "popular").slice(0, 8), []);
  const newest = React.useMemo(() => sortCourses(pool, "newest").slice(0, 8), [pool]);
  const topRated = React.useMemo(() => sortCourses(COURSES, "rating").slice(0, 8), []);
  const free = React.useMemo(() => pool.filter((c) => c.price === 0), [pool]);

  return (
    <div className="page-container py-7 sm:py-9">
      {/* Page header */}
      <header>
        <p className="text-[11px] font-bold tracking-[0.14em] text-primary uppercase">
          {dict.exploreEyebrow}
        </p>
        <h1 className="font-display mt-2 text-[26px] leading-tight font-bold tracking-tight sm:text-[34px]">
          {dict.exploreTitle}
        </h1>
        <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-muted-foreground">
          {dict.exploreSubtitle}
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
              title={dict.popularCourses}
              description={dict.popularCoursesDesc}
              courses={popular}
              onViewAll={() => setPreset({ key: "popular", label: dict.popularCourses, sort: "popular" })}
            />
            <CourseCarousel
              title={dict.newCourses}
              description={dict.newCoursesDesc}
              courses={newest}
              onViewAll={() => setPreset({ key: "newest", label: dict.newCourses, sort: "newest" })}
            />
            <CourseCarousel
              title={dict.topRated}
              description={dict.topRatedDesc}
              courses={topRated}
              onViewAll={() => setPreset({ key: "rating", label: dict.topRated, sort: "rating" })}
            />
            <CourseCarousel
              title={dict.freeCourses}
              description={dict.freeCoursesDesc}
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
            {q.trim()
              ? dict.searchResults
              : activeCategory
                ? activeCategory.name
                : (preset?.label ?? dict.allCourses)}
          </h2>
          {activeCategory && !q.trim() && (
            <p className="mt-1 text-[13.5px] text-muted-foreground">{activeCategory.description}</p>
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
