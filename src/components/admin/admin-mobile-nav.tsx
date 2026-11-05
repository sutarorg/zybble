"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_NAV, isNavItemActive } from "./nav-config";
import { cn } from "@/lib/utils";

/**
 * Mobile and tablet navigation.
 *
 * A scrollable row of pills rather than a drawer: five items fit on a phone,
 * and a drawer would add stateful open/close behaviour worth more complexity
 * than this navigation needs.
 *
 * The strip uses the same `slate-50/60` ground and white active pill as the
 * desktop sidebar, so the two are visibly the same control at different
 * widths rather than two unrelated patterns.
 */
export function AdminMobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin sections"
      className="overflow-x-auto border-b border-slate-200 bg-slate-50/60 px-4 sm:px-6 lg:px-8"
    >
      <ul className="flex min-w-max gap-1 py-3">
        {ADMIN_NAV.map((item) => {
          const active = isNavItemActive(item, pathname);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
                  active
                    ? "bg-white text-brand-700 shadow-xs ring-1 ring-slate-200"
                    : "text-slate-600 hover:bg-white hover:text-slate-900 hover:ring-1 hover:ring-slate-200/70",
                )}
              >
                <item.icon
                  className={cn(
                    "size-4 shrink-0",
                    active ? "text-brand-600" : "text-slate-500",
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
  );
}
