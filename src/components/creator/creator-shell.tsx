import * as React from "react";
import { CreatorSidebar } from "@/components/creator/creator-sidebar";
import { CreatorHeader } from "@/components/creator/creator-header";

/**
 * Creator workspace chrome.
 *
 * Authorization already happened on the server in the route-group layout, so
 * this component only lays out the sidebar and header.
 */
export function CreatorShell({ children }: { children: React.ReactNode }) {
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