import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AccessDenied } from "@/components/admin/access-denied";
import { AdminMobileNav } from "@/components/admin/admin-mobile-nav";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopbar } from "@/components/admin/admin-topbar";
import { gateAdminPage } from "@/features/admin/guard";
import { adminCount } from "@/lib/admin/access";

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
 * The structure mirrors the workspace shell in `src/app/(app)/layout.tsx` —
 * fixed rail, sticky topbar, `max-w-7xl` content — so the two read as one
 * product. The children are server components that call the admin services
 * directly; they are only reachable once both gates have passed.
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

  const operatorEmail = gate.user.email ?? null;

  return (
    <div className="min-h-screen bg-white">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] border-r border-slate-200 lg:block">
        <AdminSidebar operatorEmail={operatorEmail} adminCount={adminCount()} />
      </aside>

      <div className="lg:pl-[264px]">
        <AdminTopbar />
        <div className="lg:hidden">
          <AdminMobileNav />
        </div>
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</div>
      </div>
    </div>
  );
}
