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
import { AiTutorBanner } from "@/components/layout/ai-tutor-promo";
import { useCommunityCourses } from "@/components/providers/creator-provider";

interface Preset {
  key: string;
  label: string;
  sort?: SortOption;
  filters?: Partial<CourseFilters>;
}

export function ExploreClient({ q }: { q: string }) {
  const router = useRouter();
  const community = useCommunityCourses();
  const [category, setCategory] = useState<string | null>(null);
  const [preset, setPreset] = useState<Preset | null>(null);

  const curated = !q.trim() && !category && !preset;
  const activeCategory = category ? getCategoryBySlug(category) : undefined;

  const reset = () => {
    setCategory(null);
    setPreset(null);
    if (q) router.replace("/explore");
  };

  // Static catalog + courses published locally from the creator studio.
  const pool = React.useMemo(() => [...community, ...COURSES], [community]);
  const popular = React.useMemo(() => sortCourses(COURSES, "popular").slice(0, 8), []);
  const newest = React.useMemo(() => sortCourses(pool, "newest").slice(0, 8), [pool]);
  const topRated = React.useMemo(() => sortCourses(COURSES, "rating").slice(0, 8), []);
  const free = React.useMemo(() => pool.filter((c) => c.price === 0), [pool]);

  return (
    <div className="mx-auto max-w-340 px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      {/* Page header */}
      <header>
        <p className="text-[11px] font-bold tracking-[0.14em] text-primary uppercase">
          Explore courses
        </p>
        <h1 className="font-display mt-2 text-[26px] leading-tight font-bold tracking-tight sm:text-[34px]">
          Build in-demand skills with AI courses.
        </h1>
        <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-muted-foreground">
          Practical, project-based courses taught by people who ship. Learn a tool in a weekend
          or master a discipline over months — your AI Tutor is with you either way.
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
          <AiTutorBanner />

          <div className="mt-12 space-y-12">
            <CourseCarousel
              title="Popular Courses"
              description="The courses learners keep coming back for"
              courses={popular}
              onViewAll={() => setPreset({ key: "popular", label: "Popular courses", sort: "popular" })}
            />
            <CourseCarousel
              title="New Courses"
              description="Fresh from our instructor community"
              courses={newest}
              onViewAll={() => setPreset({ key: "newest", label: "New courses", sort: "newest" })}
            />
            <CourseCarousel
              title="Top Rated"
              description="Highest learner satisfaction on Zybble"
              courses={topRated}
              onViewAll={() => setPreset({ key: "rating", label: "Top rated courses", sort: "rating" })}
            />
            <CourseCarousel
              title="Free Courses"
              description="Start learning today — no card required"
              courses={free}
              onViewAll={() =>
                setPreset({
                  key: "free",
                  label: "Free courses",
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
              ? "Search results"
              : activeCategory
                ? activeCategory.name
                : (preset?.label ?? "All courses")}
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
