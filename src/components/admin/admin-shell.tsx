import * as React from "react";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminHeader } from "@/components/admin/admin-header";

/**
 * Admin portal chrome.
 *
 * Authorization happens in `src/app/admin/layout.tsx` on the server, so this
 * component only lays out the sidebar and header.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-muted/40">
      <AdminSidebar />
      <div className="flex min-h-dvh flex-col lg:pl-64">
        <AdminHeader />
        <main className="min-w-0 flex-1 px-4 py-7 sm:px-6 sm:py-8 lg:px-9">{children}</main>
      </div>
    </div>
  );
}
