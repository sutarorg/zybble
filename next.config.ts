import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.e2b.app"],
  // One fewer header on every response, and one fewer fingerprint of the stack.
  poweredByHeader: false,
  images: {
    // Thumbnails and avatars are streamed from the private R2 bucket through
    // this app, so `next/image` is restricted to same-origin sources.
    remotePatterns: [],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  experimental: {
    /**
     * Client router cache lifetimes, in seconds.
     *
     * The default for `dynamic` is `0`, which means every navigation refetches
     * the page even if it was visited seconds ago — back/forward and repeat
     * visits felt like a cold load. Thirty seconds makes them instant while
     * keeping catalog data fresh on the timescale a learner actually notices.
     */
    staleTimes: { dynamic: 30, static: 300 },
    /** Hovering a link starts the server render, so the click has nothing to wait for. */
    dynamicOnHover: true,
    optimizePackageImports: ["lucide-react", "date-fns", "sonner"],
  },
  // Source maps stay off in production: they are large, and Sentry is fed by
  // the CI upload rather than by anything the browser can read.
  productionBrowserSourceMaps: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // `frame-src` is required for the Bunny Stream player iframe; it is
          // the only third-party frame Zybble embeds.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://www.googletagmanager.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              "img-src 'self' data: blob: https:",
              "media-src 'self' blob:",
              "frame-src 'self' https://api.razorpay.com https://player.mediadelivery.net",
              "connect-src 'self' https://*.supabase.co https://api.razorpay.com https://*.razorpay.com https://*.bunny.net https://*.bunnycdn.com wss://*.supabase.co",
              "form-action 'self' https://api.razorpay.com",
              "frame-ancestors 'self' https://*.e2b.app https://*.arena.ai https://*.lmarena.ai",
              "base-uri 'self'",
              "object-src 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Source maps are uploaded by CI only when a Sentry auth token is present.
  silent: !process.env.NEXT_PUBLIC_SENTRY_DSN,
  widenClientFileUpload: true,
});
