import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import { siteConfig } from "@/lib/site";
import "./globals.css";

/**
 * Inter, self-hosted as a variable font instead of fetched from Google Fonts
 * at build time.
 *
 * `next/font/google` already served fonts from our own origin in production,
 * but the build itself depended on reaching fonts.googleapis.com — a network
 * dependency that fails builds behind restrictive egress and adds a
 * third-party request to every deploy. Committing the woff2 files (latin and
 * latin-ext subsets, weight axis 100–900, normal style) keeps the rendering
 * identical while making builds hermetic and shaving a blocking request off
 * first load.
 */
const inter = localFont({
  src: [
    { path: "./fonts/inter-latin-wght-normal.woff2", weight: "100 900", style: "normal" },
    { path: "./fonts/inter-latin-ext-wght-normal.woff2", weight: "100 900", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  alternates: { canonical: "/" },
  /**
   * Google Search Console / Bing Webmaster verification. Set
   * NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION (the `content` value of the
   * verification meta tag) in the deployment environment and it is rendered
   * here; unset it renders nothing, so verification is opt-in per environment.
   */
  ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION } }
    : {}),
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    url: siteConfig.url,
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
    images: [{ url: siteConfig.ogImage, width: 1200, height: 630, alt: siteConfig.name }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
    images: [siteConfig.ogImage],
  },
  robots: { index: true, follow: true },
  /**
   * Declared explicitly rather than left to the `app/icon.png` file
   * convention: a file-based icon is dropped as soon as an `icons` field
   * exists (which it must, for the iOS Home Screen entry below).
   * `apple-touch-icon.png` is flattened onto white on purpose — iOS renders
   * PNG transparency as black, so the transparent master cannot be reused.
   */
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png", sizes: "256x256" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-white font-sans text-slate-900 antialiased">{children}</body>
    </html>
  );
}
