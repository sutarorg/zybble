import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CreatorShell } from "@/components/creator/creator-shell";

export const metadata: Metadata = {
  title: {
    default: "Creator Studio",
    template: "%s · Zybble Creator",
  },
  description: "The Zybble creator studio — build courses, track performance and grow your teaching business.",
};

export default function CreatorLayout({ children }: { children: ReactNode }) {
  return <CreatorShell>{children}</CreatorShell>;
}
