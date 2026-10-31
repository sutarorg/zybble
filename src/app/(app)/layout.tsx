import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppTopbar } from "@/components/app/app-topbar";
import { SidebarContent } from "@/components/app/sidebar-content";

export const metadata: Metadata = {
  title: { default: "Workspace", template: "%s · Zybble" },
  robots: { index: false, follow: false },
};

/**
 * Authenticated application shell. Auth itself ships in Prompt 3; the shell is
 * fully client-safe today — every nav item resolves to a real route.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] border-r border-slate-200 lg:block">
        <SidebarContent />
      </aside>

      <div className="lg:pl-[264px]">
        <AppTopbar />
        <div className="px-4 py-8 sm:px-6 lg:px-8">{children}</div>
      </div>
    </div>
  );
}
