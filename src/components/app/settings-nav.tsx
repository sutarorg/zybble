"use client";

import { CreditCard, UserRound, Users, Building2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LinkedinIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

export const settingsNav = [
  { href: "/settings", label: "Workspace", icon: Building2 },
  { href: "/settings/linkedin", label: "LinkedIn", icon: LinkedinIcon },
  { href: "/settings/account", label: "Account", icon: UserRound },
  { href: "/settings/team", label: "Team", icon: Users },
  { href: "/settings/billing", label: "Billing", icon: CreditCard },
] as const;

/** Horizontal pill navigation shared across all settings screens. */
export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Settings sections" className="mb-8 overflow-x-auto">
      <ul className="flex min-w-max items-center gap-1 rounded-xl bg-slate-100 p-1">
        {settingsNav.map((item) => {
          const active =
            item.href === "/settings" ? pathname === "/settings" : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-800",
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
