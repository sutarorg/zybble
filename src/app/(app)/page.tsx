import type { Metadata } from "next";
import { ExploreClient } from "./explore-client";
import { queryPublishedCourses } from "@/lib/server/catalog";

export const metadata: Metadata = {
  title: "Explore AI Courses",
  description:
    "Browse practical AI courses in automation, development, generative AI, creation, marketing, data science, business and productivity. All prices in INR (₹).",
};

/**
 * The public catalog.
 *
 * Courses are read from Supabase with RLS applied, so only `status =
 * 'published'` records can reach this page. With no published courses the
 * storefront renders an honest empty state.
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const courses = await queryPublishedCourses({ limit: 96 });
  return <ExploreClient q={typeof q === "string" ? q : ""} courses={courses} />;
}
