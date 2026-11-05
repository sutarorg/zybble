"use client";

import { ArrowLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_NAV, isNavItemActive } from "./nav-config";
import { cn } from "@/lib/utils";

/**
 * Admin sidebar.
 *
 * Deliberately the same component language as the workspace sidebar
 * (`src/components/app/sidebar-content.tsx`): a `slate-50/60` rail, a white
 * pill for the active row, and an 18px icon. An operator moving between the
 * product and this console should not have to relearn the navigation.
 *
 * The active state is a filled row rather than a weight or colour change so it
 * is legible at a glance and does not reflow when the selection moves.
 */
export function AdminSidebar({
  operatorEmail,
  adminCount,
}: {
  operatorEmail: string | null;
  /** How many accounts are on the allowlist, including this one. */
  adminCount: number;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-slate-50/60">
      <div className="flex h-16 shrink-0 items-center border-b border-slate-200/70 px-5">
        <Link href="/admin" aria-label="Zybble platform admin" className="rounded-md">
          <span className="inline-flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo.png"
              alt=""
              width={32}
              height={32}
              className="size-8 rounded-[9px]"
            />
            <span className="leading-tight">
              <span className="block text-[17px] font-semibold tracking-tight text-slate-900">
                Zybble
              </span>
              <span className="block text-[11px] font-medium text-slate-500">
                Platform admin
              </span>
            </span>
          </span>
        </Link>
      </div>

      <nav aria-label="Admin sections" className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-0.5">
          {ADMIN_NAV.map((item) => {
            const active = isNavItemActive(item, pathname);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
                    active
                      ? "bg-white text-brand-700 shadow-xs ring-1 ring-slate-200"
                      : "text-slate-600 hover:bg-white hover:text-slate-900 hover:ring-1 hover:ring-slate-200/70",
                  )}
                >
                  <item.icon
                    className={cn(
                      "size-[18px] shrink-0 transition-colors",
                      active ? "text-brand-600" : "text-slate-500 group-hover:text-slate-500",
                    )}
                    aria-hidden
                  />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Session context — mirrors the plan card in the workspace sidebar. */}
      <div className="px-4 pb-3">
        <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-900">
              <ShieldCheck className="size-3.5 text-brand-600" aria-hidden />
              Read-only
            </p>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 tabular-nums">
              {adminCount} {adminCount === 1 ? "admin" : "admins"}
            </span>
          </div>
          <p className="mt-2 truncate text-xs leading-5 text-slate-600" title={operatorEmail ?? ""}>
            {operatorEmail ?? "Signed in"}
          </p>
        </div>
      </div>

      <div className="shrink-0 border-t border-slate-200/70 p-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-white hover:text-slate-900 hover:ring-1 hover:ring-slate-200/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          <ArrowLeft className="size-[18px] shrink-0 text-slate-500" aria-hidden />
          Back to app
        </Link>
      </div>
    </div>
  );
}
