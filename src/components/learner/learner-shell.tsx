"use client";

import { useRouter } from "next/navigation";
import { useApp } from "@/components/providers/app-providers";
import * as React from "react";
import { LearnerSidebar } from "@/components/learner/learner-sidebar";
import { LearnerHeader } from "@/components/learner/learner-header";
import { Footer } from "@/components/layout/footer";

/**
 * Learner dashboard chrome — same visual language as the public Explore
 * shell: fixed sidebar, sticky header with global search, light surfaces.
 */
export function LearnerShell({ children }: { children: React.ReactNode }) {
  const { user, hydrated } = useApp();
  const router = useRouter();
  React.useEffect(() => { if (hydrated && !user) router.replace("/login"); }, [hydrated, user, router]);
  if (!hydrated || !user) return <div className="min-h-dvh bg-white" aria-busy="true" />;
  return (
    <div className="min-h-dvh bg-white">
      <LearnerSidebar />
      <div className="flex min-h-dvh flex-col lg:pl-64">
        <LearnerHeader />
        <main className="min-w-0 flex-1">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
