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
   *
   * Favicon sizes, and why they are listed smallest-first:
   *
   *  - Google Search renders a favicon next to the site name, and asks for a
   *    square at least 8x8 that it recommends making larger than 48x48. The
   *    sizes below are multiples of 48 (48, 96, 144) so Googlebot-Image is
   *    offered clean, already-square rasters at the scale it downscales from,
   *    rather than only the 256x256 master.
   *  - `/favicon.ico` is kept at the root because that is the path Google's
   *    own documentation uses and the one a crawler requests by convention
   *    even when no link tag is seen. It carries 16/32/48/64 variants.
   *  - The URLs are stable (no content hash), which Google requires: a
   *    favicon whose URL changes on every deploy is treated as a new asset.
   *  - None of these paths are disallowed in robots.txt, so Googlebot-Image
   *    can fetch them.
   */
  icons: {
    icon: [
      { url: "/favicon-48x48.png", type: "image/png", sizes: "48x48" },
      { url: "/favicon-96x96.png", type: "image/png", sizes: "96x96" },
      { url: "/favicon-144x144.png", type: "image/png", sizes: "144x144" },
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
