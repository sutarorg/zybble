/**
 * Central site configuration.
 *
 * The canonical production domain is `https://zybble.com`. It is configurable
 * via NEXT_PUBLIC_SITE_URL so the same codebase can run on Vercel previews and
 * production without code changes, but the value is normalised defensively:
 *
 *  - the scheme is forced to HTTPS for every non-local host (a mistyped
 *    `http://zybble.com` in an environment variable must never leak into
 *    canonical tags, the sitemap or robots.txt again);
 *  - `www.zybble.com` is folded into the apex `zybble.com`, which is the
 *    single canonical host served by the host-level redirects in
 *    `next.config.ts`;
 *  - trailing slashes are stripped.
 *
 * `zybble.app` is a retired domain. It is intentionally NOT a fallback here:
 * emitting it in metadata re-associated the site with an old identity. Any
 * request to it is permanently redirected to the canonical domain.
 */

export const CANONICAL_HOST = "zybble.com";

const fallbackUrl = `https://${CANONICAL_HOST}`;

function isLocalHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname.endsWith(".localhost")
  );
}

/**
 * Normalise a configured site URL into a canonical, HTTPS origin.
 *
 * Local development origins (`http://localhost:3000`) are preserved so the
 * dev server, tests and preview builds keep working.
 */
export function normaliseSiteUrl(raw: string | undefined | null): string {
  const value = (raw ?? "").trim().replace(/\/+$/, "");
  if (!value) return fallbackUrl;

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return fallbackUrl;
  }

  if (!isLocalHost(url.hostname)) {
    url.protocol = "https:";
  }
  if (url.hostname === `www.${CANONICAL_HOST}`) {
    url.hostname = CANONICAL_HOST;
  }
  return url.origin;
}

export const siteConfig = {
  name: "Zybble",
  tagline: "LinkedIn Post Scheduler & Analytics",
  description:
    "Zybble is the focused LinkedIn scheduler and analytics workspace for B2B founders, consultants and creators. Plan content, publish on time and understand what drives engagement.",
  url: normaliseSiteUrl(process.env.NEXT_PUBLIC_SITE_URL ?? fallbackUrl),
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
