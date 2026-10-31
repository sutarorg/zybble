import type { MetadataRoute } from "next";
import { posts } from "@/lib/blog";
import { siteConfig } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { path: "", priority: 1 },
    { path: "/pricing", priority: 0.9 },
    { path: "/linkedin-scheduler", priority: 0.9 },
    { path: "/linkedin-analytics", priority: 0.9 },
    { path: "/blog", priority: 0.8 },
    { path: "/signup", priority: 0.7 },
    { path: "/login", priority: 0.5 },
    { path: "/privacy", priority: 0.3 },
    { path: "/terms", priority: 0.3 },
  ].map(({ path, priority }) => ({
    url: `${siteConfig.url}${path}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority,
  }));

  const blogRoutes: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${siteConfig.url}/blog/${post.slug}`,
    lastModified: new Date(post.publishedAt),
    changeFrequency: "yearly" as const,
    priority: 0.7,
  }));

  return [...staticRoutes, ...blogRoutes];
}
