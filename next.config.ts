import type { NextConfig } from "next";

/**
 * Security headers.
 *
 * Applied to every route, including static assets, so they cannot be forgotten
 * on a page-by-page basis. Deliberately conservative: each header here is a
 * hard guarantee the app can keep, rather than a policy that looks strict but
 * breaks the first time Next injects an inline script.
 *
 * A full Content-Security-Policy needs hashed or nonced inline scripts and is
 * tracked as a follow-up (see `SECURITY.md` §13) — deploying a CSP that does
 * not match the framework's own output is worse than not deploying one, because
 * it fails open in browsers that only report.
 */
const securityHeaders = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  {
    key: "X-Permitted-Cross-Domain-Policies",
    value: "none",
  },
  {
    // The app stores an OAuth session in cookies; a cross-origin frame has no
    // business rendering any of it.
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin",
  },
];

const nextConfig: NextConfig = {
  // Nothing about the stack needs advertising to attackers.
  poweredByHeader: false,

  // LinkedIn avatars and media are rendered from our own signed URLs, so no
  // external image host needs to be whitelisted.
  reactStrictMode: true,

  async headers() {
    // HSTS is only sent on a real deployment. Emitting it on localhost makes
    // the browser pin `http://localhost:3000` to HTTPS for two years, which
    // breaks local development in a way that is very hard to diagnose.
    const isProduction = process.env.NODE_ENV === "production";

    return [
      {
        source: "/(.*)",
        headers: [
          ...securityHeaders,
          ...(isProduction
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains; preload",
                },
              ]
            : []),
        ],
      },
      {
        // Never cache anything behind auth. A shared cache that answers one
        // tenant with another tenant's dashboard is the worst class of bug in a
        // multi-tenant product, and `no-store` removes the question entirely.
        source: "/((?:dashboard|calendar|posts|analytics|settings|onboarding)(?:/.*)?$)",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
