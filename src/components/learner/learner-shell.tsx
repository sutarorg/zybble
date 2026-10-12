import * as React from "react";
import { LearnerSidebar } from "@/components/learner/learner-sidebar";
import { LearnerHeader } from "@/components/learner/learner-header";
import { Footer } from "@/components/layout/footer";

/**
 * Learner dashboard chrome — same visual language as the public Explore
 * shell: fixed sidebar, sticky header with global search, light surfaces.
 */
export function LearnerShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <LearnerSidebar />
      <div className="flex min-h-screen flex-col lg:pl-64">
        <LearnerHeader />
        <main className="min-w-0 flex-1">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
