"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ADMIN_NAV, isNavItemActive } from "./nav-config";

/**
 * Mobile and tablet navigation.
 *
 * A scrollable row of tabs rather than a drawer: five items fit comfortably on
 * a phone, and a drawer would add a stateful open/close control worth more
 * complexity than the navigation needs.
 */
export function AdminMobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin sections"
      className="-mx-4 overflow-x-auto border-b border-slate-200 px-4 lg:hidden"
    >
      <ul className="flex min-w-max gap-1 pb-px">
        {ADMIN_NAV.map((item) => {
          const active = isNavItemActive(item, pathname);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors",
                  active
                    ? "border-brand-600 text-brand-700"
                    : "border-transparent text-slate-600 hover:text-slate-900",
                )}
              >
                <item.icon className="size-4" aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
