import {
  BarChart3,
  CalendarDays,
  LayoutDashboard,
  PenSquare,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface AppNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Prefix match for active state. */
  match: string;
}

export const appNavItems: AppNavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, match: "/dashboard" },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, match: "/calendar" },
  { href: "/posts", label: "Posts", icon: PenSquare, match: "/posts" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, match: "/analytics" },
  { href: "/settings", label: "Settings", icon: Settings, match: "/settings" },
];

export interface TopbarConfig {
  title: string;
  subtitle?: string;
  action?: "new-post" | null;
}

/** Route → topbar chrome. Evaluated against the pathname (first match wins). */
export const topbarRoutes: [match: string, config: TopbarConfig][] = [
  ["/posts/new", { title: "New post", subtitle: "Compose and schedule", action: null }],
  ["/posts", { title: "Posts", subtitle: "Drafts, queue and history", action: "new-post" }],
  ["/dashboard", { title: "Dashboard", subtitle: "Your week on LinkedIn", action: "new-post" }],
  ["/calendar", { title: "Calendar", subtitle: "Plan your publishing rhythm", action: "new-post" }],
  ["/analytics", { title: "Analytics", subtitle: "What your audience responded to", action: null }],
  ["/settings/linkedin", { title: "LinkedIn connections", subtitle: "Accounts & publishing access", action: null }],
  ["/settings/account", { title: "Account", subtitle: "Profile & security", action: null }],
  ["/settings/team", { title: "Team", subtitle: "Seats & collaborators", action: null }],
  ["/settings/billing", { title: "Billing", subtitle: "Plan & subscription", action: null }],
  ["/settings", { title: "Workspace settings", subtitle: "Identity & preferences", action: null }],
];

export function getTopbarConfig(pathname: string): TopbarConfig {
  for (const [match, config] of topbarRoutes) {
    if (pathname.startsWith(match)) return config;
  }
  return { title: "Zybble", action: null };
}
