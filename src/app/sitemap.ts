import type { MetadataRoute } from "next";
import { categorySlug, getCategories, posts, postsByCategory } from "@/lib/blog";
import { siteConfig } from "@/lib/site";

/**
 * The XML sitemap.
 *
 * Indexing rules baked in here:
 *  - ONLY public, canonical, indexable routes are listed. Login, signup and
 *    every private dashboard route are excluded — they are noindexed and
 *    disallowed in robots.txt, and a sitemap entry would contradict both.
 *  - `lastModified` reflects when the content actually changed. It is derived
 *    from each article's publish/revision date rather than the build time, so
 *    rebuilds do not fake freshness to crawlers.
 *  - Category archives inherit the most recent change of the articles they
 *    contain, because that is precisely what changes an archive page.
 */

/** Date the current marketing site (pages and copy) went live. */
const SITE_LAUNCH = new Date("2026-11-01");

const staticRoutes: Array<{ path: string; priority: number; lastModified?: Date }> = [
  { path: "", priority: 1 },
  { path: "/linkedin-scheduler", priority: 0.9 },
  { path: "/linkedin-analytics", priority: 0.9 },
  { path: "/pricing", priority: 0.9 },
  { path: "/free-linkedin-tools", priority: 0.9 },
  { path: "/tools/linkedin-engagement-rate-calculator", priority: 0.8 },
  { path: "/resources/linkedin-content-calendar-template", priority: 0.8 },
  { path: "/tools/linkedin-character-counter", priority: 0.8 },
  { path: "/tools/linkedin-keyword-analyzer", priority: 0.8 },
  // The blog index changes whenever any article does, so its date is derived
  // below rather than pinned to the launch date.
  { path: "/blog", priority: 0.8 },
  { path: "/about", priority: 0.6 },
  { path: "/contact", priority: 0.5 },
  { path: "/security", priority: 0.4 },
  { path: "/privacy", priority: 0.3 },
  { path: "/terms", priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const latestPostDate = posts.reduce((max, post) => {
    const changed = new Date(post.updatedAt ?? post.publishedAt);
    return changed > max ? changed : max;
  }, new Date(0));

  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map(({ path, priority, lastModified }) => ({
    url: `${siteConfig.url}${path}`,
    lastModified: lastModified ?? (path === "/blog" ? latestPostDate : SITE_LAUNCH),
    changeFrequency: "monthly" as const,
    priority,
  }));

  const blogEntries: MetadataRoute.Sitemap = [...posts]
    .sort((a, b) => a.publishedAt.localeCompare(b.publishedAt))
    .map((post) => ({
      url: `${siteConfig.url}/blog/${post.slug}`,
      lastModified: new Date(post.updatedAt ?? post.publishedAt),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }));

  const categoryEntries: MetadataRoute.Sitemap = getCategories().map((category) => {
    const latest = postsByCategory(categorySlug(category)).reduce((max, post) => {
      const changed = new Date(post.updatedAt ?? post.publishedAt);
      return changed > max ? changed : max;
    }, new Date(0));
    return {
      url: `${siteConfig.url}/blog/category/${categorySlug(category)}`,
      lastModified: latest,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    };
  });

  return [...staticEntries, ...blogEntries, ...categoryEntries];
}
