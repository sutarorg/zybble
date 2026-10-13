import { redirect } from "next/navigation";

/**
 * The catalog now lives at `/` (the former Explore page). `/explore` is kept
 * only as a permanent alias so old bookmarks and external links land on the
 * canonical sitemap entry instead of 404ing.
 */
export default async function ExploreRedirect({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  redirect(typeof q === "string" && q ? `/?q=${encodeURIComponent(q)}` : "/");
}
