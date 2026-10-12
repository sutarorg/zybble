"use client";

import * as React from "react";
import type { Category, Course } from "@/types";
import { coursesByCategory } from "@/lib/courses";
import { useCommunityCourses } from "@/components/providers/creator-provider";
import { CourseBrowser } from "@/components/courses/course-browser";

/**
 * Client wrapper that merges locally published creator courses into the
 * (server-provided) static category pool before browsing.
 */
export function CategoryPool({ categorySlug }: { categorySlug: Category["slug"] | string }) {
  const community = useCommunityCourses();
  const pool = React.useMemo(
    () => [...community.filter((c) => c.category === categorySlug), ...coursesByCategory(categorySlug)],
    [community, categorySlug]
  );
  return <CourseBrowser pool={pool} defaultSort="popular" className="mt-8" />;
}
