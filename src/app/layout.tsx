import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AppProviders } from "@/components/providers/app-providers";
import { ScrollToTop } from "@/components/layout/scroll-to-top";
import { getSession } from "@/lib/server/session";
import { publicEnv } from "@/lib/env";
import { GA4Script } from "@/components/analytics/ga4";
import { PostHogProvider } from "@/components/analytics/posthog";
import "./globals.css";

/**
 * Inter + Space Grotesk, kept off the critical path.
 *
 * The stylesheet is fetched with `media="print"`, which browsers download at
 * low priority without blocking the first paint; a two-line inline script
 * promotes it the moment it has arrived. Text renders immediately in the
 * system fallback stack (`display=swap`) and settles onto the brand faces.
 */
const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap";

const FONT_BOOTSTRAP = `(function(){var l=document.getElementById("zybble-fonts");if(!l)return;var go=function(){l.media="all"};if(l.sheet)go();else l.addEventListener("load",go,{"once":true});})();`;

export const metadata: Metadata = {
  title: {
    default: "Zybble — Learn AI Skills That Matter",
    template: "%s · Zybble",
  },
  description:
    "Zybble is India's marketplace for practical AI courses: automation, development, generative AI, creation, marketing, data science, business and productivity. All prices in INR (₹).",
  keywords: ["AI courses", "learn AI", "online learning India", "automation", "ChatGPT", "machine learning"],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/zybble-favicon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/zybble-favicon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    shortcut: ["/favicon.ico"],
  },
  manifest: "/site.webmanifest",
  metadataBase: publicEnv.siteUrl ? new URL(publicEnv.siteUrl) : undefined,
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await getSession();

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preload" as="style" href={FONT_HREF} />
        <link id="zybble-fonts" rel="stylesheet" href={FONT_HREF} media="print" />
        <script dangerouslySetInnerHTML={{ __html: FONT_BOOTSTRAP }} />
        <noscript>
          <link rel="stylesheet" href={FONT_HREF} />
        </noscript>
      </head>
      <body className="bg-background font-sans text-foreground antialiased">
        <ScrollToTop />
        <GA4Script />
        <PostHogProvider />
        <AppProviders session={session}>{children}</AppProviders>
      </body>
    </html>
  );
}
