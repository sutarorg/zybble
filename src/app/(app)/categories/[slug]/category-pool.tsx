"use client";

import type { Course } from "@/types";
import { CourseBrowser } from "@/components/courses/course-browser";

/**
 * Client wrapper around the category browser.
 *
 * The pool is passed in from the server, which read it from Supabase under RLS,
 * so only published courses are ever offered here.
 */
export function CategoryPool({ pool }: { pool: Course[] }) {
  return <CourseBrowser pool={pool} defaultSort="popular" className="mt-8" />;
}
