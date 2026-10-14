import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AppProviders } from "@/components/providers/app-providers";
import { ScrollToTop } from "@/components/layout/scroll-to-top";
import { getSession } from "@/lib/server/session";
import { publicEnv } from "@/lib/env";
import { GA4Script } from "@/components/analytics/ga4";
import { PostHogProvider } from "@/components/analytics/posthog";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Zybble — Learn AI Skills That Matter",
    template: "%s · Zybble",
  },
  description:
    "Zybble is India's marketplace for practical AI courses: automation, development, generative AI, creation, marketing, data science, business and productivity. All prices in INR (₹).",
  keywords: ["AI courses", "learn AI", "online learning India", "automation", "ChatGPT", "machine learning"],
  icons: { icon: "/favicon.ico" },
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
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- App Router: fonts are declared once in the root layout, not per page. */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap"
        />
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
