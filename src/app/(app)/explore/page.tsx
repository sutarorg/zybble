import type { Metadata } from "next";
import { ExploreClient } from "./explore-client";

export const metadata: Metadata = {
  title: "Explore AI Courses",
  description:
    "Browse practical AI courses in automation, development, generative AI, creation, marketing, data science, business and productivity.",
};

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  return <ExploreClient q={typeof q === "string" ? q : ""} />;
}
