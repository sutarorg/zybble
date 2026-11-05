"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { ADMIN_NAV, isNavItemActive } from "./nav-config";

/**
 * Admin sidebar.
 *
 * Deliberately plain: a wordmark, five links and a way back to the product.
 * Active state is a tinted row rather than a bold weight or an animated
 * indicator, which keeps it legible at a glance and avoids layout shift when
 * the selection changes.
 */
export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-slate-200 px-5">
        <span className="flex size-7 items-center justify-center rounded-md bg-brand-600 text-[13px] font-semibold text-white">
          Z
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-tight text-slate-950">Zybble</p>
          <p className="text-[11px] font-medium text-slate-500">Platform admin</p>
        </div>
      </div>

      <nav aria-label="Admin sections" className="flex-1 space-y-0.5 p-3">
        {ADMIN_NAV.map((item) => {
          const active = isNavItemActive(item, pathname);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                active
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              <item.icon
                className={cn("size-4 shrink-0", active ? "text-brand-600" : "text-slate-400")}
                aria-hidden
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-slate-200 p-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
        >
          <ArrowLeft className="size-4 shrink-0 text-slate-400" aria-hidden />
          Back to app
        </Link>
      </div>
    </div>
  );
}
