import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter, Space_Grotesk } from "next/font/google";
import { AppProviders } from "@/components/providers/app-providers";
import { CreatorProvider } from "@/components/providers/creator-provider";
import { AdminProvider } from "@/components/providers/admin-provider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Zybble — Learn AI Skills That Matter",
    template: "%s · Zybble",
  },
  description:
    "Zybble is the global marketplace for practical AI courses: automation, development, generative AI, creation, marketing, data science, business and productivity.",
  keywords: ["AI courses", "learn AI", "online learning", "automation", "ChatGPT", "machine learning"],
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="bg-background font-sans text-foreground antialiased">
        <AppProviders>
          <CreatorProvider>
            <AdminProvider>{children}</AdminProvider>
          </CreatorProvider>
        </AppProviders>
      </body>
    </html>
  );
}
