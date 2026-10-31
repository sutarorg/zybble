import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Belt and braces. These routes already send `X-Robots-Tag: noindex`
      // through their layout metadata, but a crawler that ignores it should
      // still never be told the paths exist.
      disallow: [
        "/api/",
        "/dashboard",
        "/calendar",
        "/posts",
        "/analytics",
        "/settings",
        "/onboarding",
        "/login",
        "/signup",
        "/forgot-password",
        "/reset-password",
        "/auth/",
      ],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
