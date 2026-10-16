import * as React from "react";
import { Suspense } from "react";
import dynamic from "next/dynamic";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { getEnrollments, getNotifications } from "@/lib/server/learner";

/**
 * The assistant is a floating widget, not part of any page's critical path.
 * Splitting it out keeps its Radix dialog and icon set out of the bundle the
 * browser needs before the first paint; it loads right after hydration.
 */
const PublicChatbot = dynamic(() =>
  import("@/components/layout/public-chatbot").then((module) => module.PublicChatbot)
);

/**
 * The shared public shell: fixed sidebar + sticky header + content + footer.
 * Used by all marketplace routes in the (app) route group.
 *
 * The sidebar badge and the notification bell need per-user reads. Those are
 * put behind their own Suspense boundaries so the page a learner actually
 * clicked for streams immediately instead of waiting on them, and the chrome
 * fills in a beat later. Both fallbacks reserve the finished element's exact
 * footprint, so nothing shifts when the real thing lands.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-white">
      <Suspense fallback={<SidebarFallback />}>
        <SidebarWithCount />
      </Suspense>
      <div className="flex min-h-dvh flex-col lg:pl-64">
        <Suspense fallback={<HeaderFallback />}>
          <HeaderWithNotifications />
        </Suspense>
        <main className="min-w-0 flex-1">{children}</main>
        <Footer />
      </div>
      <PublicChatbot />
    </div>
  );
}

async function SidebarWithCount() {
  const enrollments = await getEnrollments();
  return <Sidebar enrollmentCount={enrollments.length} />;
}

async function HeaderWithNotifications() {
  const notifications = await getNotifications();
  return <Header notifications={notifications} />;
}

function SidebarFallback() {
  return (
    <aside
      aria-hidden
      className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-white lg:block"
    >
      <div className="px-5 pt-5 pb-4">
        <div className="size-8 rounded-[10px] bg-muted" />
      </div>
      <div className="space-y-2 px-6">
        {Array.from({ length: 9 }).map((_, index) => (
          <div key={index} className="h-4 rounded bg-muted" />
        ))}
      </div>
    </aside>
  );
}

function HeaderFallback() {
  return (
    <header
      aria-hidden
      className="pt-safe sticky top-0 z-30 border-b border-border bg-white/85 backdrop-blur-md"
    >
      <div className="flex h-16 items-center gap-2 px-3 sm:gap-4 sm:px-6 lg:px-10">
        <div className="size-9 rounded-lg bg-muted lg:hidden" />
        <div className="mx-auto hidden h-10 w-full max-w-xl flex-1 rounded-xl bg-muted sm:block" />
        <div className="ml-auto flex items-center gap-2 sm:ml-0">
          <div className="size-9 rounded-lg bg-muted" />
          <div className="size-9 rounded-lg bg-muted" />
        </div>
      </div>
    </header>
  );
}
