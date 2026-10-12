import type { Metadata } from "next";
import type { ReactNode } from "react";
import { LearnerShell } from "@/components/learner/learner-shell";

export const metadata: Metadata = {
  title: {
    default: "My Learning",
    template: "%s · Zybble",
  },
};

export default function LearnerLayout({ children }: { children: ReactNode }) {
  return <LearnerShell>{children}</LearnerShell>;
}
