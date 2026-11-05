import { Activity, Building2, CreditCard, LayoutGrid, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * `/admin` navigation.
 *
 * Five sections, no nesting, no badges, no counters — a flat list is all this
 * surface needs, and adding a second level would make it harder to see
 * everything at a glance rather than easier.
 *
 * `exact` marks the index route. Without it, `/admin` would match every
 * `/admin/…` path and the Overview tab would light up on all five pages, so
 * every entry declares it explicitly rather than relying on `?:`.
 */
export type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact: boolean;
};

export const ADMIN_NAV: readonly AdminNavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutGrid, exact: true },
  { href: "/admin/users", label: "Users", icon: Users, exact: false },
  { href: "/admin/workspaces", label: "Workspaces", icon: Building2, exact: false },
  { href: "/admin/billing", label: "Billing", icon: CreditCard, exact: false },
  { href: "/admin/system", label: "System", icon: Activity, exact: false },
];

/** Whether a nav entry owns the current path. */
export function isNavItemActive(item: AdminNavItem, pathname: string): boolean {
  return item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
}
