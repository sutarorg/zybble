"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useApp } from "@/components/providers/app-providers";
import { CreatorSidebar } from "@/components/creator/creator-sidebar";
import { CreatorHeader } from "@/components/creator/creator-header";

/** Persistent creator workspace chrome: sidebar + contextual top bar. */
export function CreatorShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, hydrated } = useApp();
  const previousRole = React.useRef(user?.role);
  const signup = pathname === "/creator/signup";
  React.useEffect(() => {
    const wasCreator = previousRole.current === "creator";
    previousRole.current = user?.role;
    if (!signup && hydrated && user?.role !== "creator") {
      router.replace(wasCreator ? "/" : user ? "/creator/signup" : "/login");
    }
  }, [signup, hydrated, user, router]);
  if (signup) return <>{children}</>;
  if (!hydrated || user?.role !== "creator") return <div className="min-h-dvh bg-white" aria-busy="true" />;
  return (
    <div className="min-h-dvh bg-muted/40">
      <CreatorSidebar />
      <div className="flex min-h-dvh flex-col lg:pl-64">
        <CreatorHeader />
        <main className="min-w-0 flex-1 px-4 py-7 sm:px-6 sm:py-8 lg:px-9">{children}</main>
      </div>
    </div>
  );
}
