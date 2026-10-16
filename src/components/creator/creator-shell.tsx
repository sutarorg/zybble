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
    <div className="min-h-dvh bg-[radial-gradient(1200px_500px_at_80%_-10%,var(--color-accent),transparent),linear-gradient(var(--color-muted),var(--color-muted))]">
      <CreatorSidebar />
      <div className="flex min-h-dvh flex-col lg:pl-64">
        <CreatorHeader />
        <main className="mx-auto w-full min-w-0 max-w-[1400px] flex-1 px-4 py-7 sm:px-6 sm:py-8 lg:px-9">{children}</main>
      </div>
    </div>
  );
}