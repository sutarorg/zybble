/**
 * Central site configuration.
 *
 * The canonical production domain is configurable via NEXT_PUBLIC_SITE_URL so
 * the same codebase can run on Vercel previews and production without code
 * changes. Metadata, canonical URLs, sitemap and JSON-LD all read from here.
 */
const fallbackUrl = "https://www.zybble.app";

export const siteConfig = {
  name: "Zybble",
  tagline: "LinkedIn Post Scheduler & Analytics",
  description:
    "Zybble is the focused LinkedIn scheduler and analytics workspace for B2B founders, consultants and creators. Plan content, publish on time and understand what drives engagement.",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? fallbackUrl).replace(/\/$/, ""),
  logoPath: "/brand/logo.png",
  ogImage: "/og/og-image.png",
  links: {
    product: "/linkedin-scheduler",
    analytics: "/linkedin-analytics",
    pricing: "/pricing",
    blog: "/blog",
    login: "/login",
    signup: "/signup",
    privacy: "/privacy",
    terms: "/terms",
  },
  plans: {
    free: { name: "Free", price: 0 },
    pro: { name: "Pro", price: 15 },
  },
} as const;

export type SiteConfig = typeof siteConfig;
