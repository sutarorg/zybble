import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AppProviders } from "@/components/providers/app-providers";
import { CreatorProvider } from "@/components/providers/creator-provider";
import { AdminProvider } from "@/components/providers/admin-provider";
import { ScrollToTop } from "@/components/layout/scroll-to-top";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Zybble — Learn AI Skills That Matter",
    template: "%s · Zybble",
  },
  description:
    "Zybble is the global marketplace for practical AI courses: automation, development, generative AI, creation, marketing, data science, business and productivity.",
  keywords: ["AI courses", "learn AI", "online learning", "automation", "ChatGPT", "machine learning"],
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  // Keep pinch-zoom available for accessibility while making the layout
  // fit the notch/home-indicator safe areas on modern phones.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/*
          Inter + Space Grotesk (the Zybble type pair) are loaded as a plain
          stylesheet instead of `next/font/google` so the production build does
          not depend on a live connection to fonts.googleapis.com at build time.
          The CSS stacks in globals.css fall back to system fonts when the
          request is unavailable, so the app renders correctly offline too.
        */}
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
        <AppProviders>
          <CreatorProvider>
            <AdminProvider>{children}</AdminProvider>
          </CreatorProvider>
        </AppProviders>
      </body>
    </html>
  );
}
