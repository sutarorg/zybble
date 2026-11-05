import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AccessDenied } from "@/components/admin/access-denied";
import { AdminMobileNav } from "@/components/admin/admin-mobile-nav";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { gateAdminPage } from "@/features/admin/guard";

/**
 * `/admin` shell.
 *
 * Authorisation happens twice on purpose:
 *
 *  1. `src/lib/supabase/proxy.ts` answers non-admins with a real HTTP 403
 *     before any rendering starts — that is where the status code comes from.
 *  2. This layout re-checks with `gateAdminPage()`, so the pages underneath
 *     are safe even if the proxy rule is ever removed or narrowed.
 *
 * The children are server components that call the admin services directly.
 * They are only reachable once both gates have passed.
 */

export const metadata: Metadata = {
  title: { default: "Platform admin", template: "%s · Zybble Admin" },
  // Private by definition. The meta robots tag covers HTML crawlers and
  // next.config.ts adds X-Robots-Tag for anything that only reads headers.
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const gate = await gateAdminPage();

  if (!gate.ok) {
    if (gate.kind === "unauthenticated") {
      redirect("/login?next=%2Fadmin");
    }
    return <AccessDenied />;
  }

  return (
    <div className="min-h-screen bg-slate-50/40">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] border-r border-slate-200 bg-white lg:block">
        <AdminSidebar />
      </aside>

      <div className="lg:pl-[248px]">
        <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <AdminMobileNav />
          <div className="pt-5 lg:pt-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
