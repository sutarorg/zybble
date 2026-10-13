"use client";

import { LocalizedText, useTranslate } from "@/components/providers/localized-text";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ClipboardCheck,
  Compass,
  Flag,
  LayoutGrid,
  Landmark,
  LayoutDashboard,
  LibraryBig,
  Receipt,
  Settings,
  ShieldCheck,
  Star,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/layout/logo";
import { useAdmin } from "@/components/providers/admin-provider";
import { useCreator } from "@/components/providers/creator-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

function NavItem({
  href,
  icon: Icon,
  label,
  active,
  trailing,
  onNavigate,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  trailing?: React.ReactNode;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex h-10 items-center gap-3 rounded-lg px-3 text-[13.5px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/25 lg:h-9",
        active
          ? "bg-accent text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0 transition-colors",
          active ? "text-primary" : "text-zinc-400 group-hover:text-foreground"
        )}
      />
      <span className="truncate"><LocalizedText text={label} /></span>
      {trailing ? <span className="ml-auto">{trailing}</span> : null}
    </Link>
  );
}

export function AdminSidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const translateUi = useTranslate();
  const pathname = usePathname();
  const { adminName, reports } = useAdmin();
  const { courses } = useCreator();

  const pendingReview = courses.filter((c) => c.status === "pending").length;
  const openReports = reports.filter((r) => r.status === "open" || r.status === "under_review").length;

  const groups: {
    label: string;
    items: {
      href: string;
      icon: React.ComponentType<{ className?: string }>;
      label: string;
      exact?: boolean;
      trailing?: React.ReactNode;
    }[];
  }[] = [
    {
      label: "Operations",
      items: [
        { href: "/admin", icon: LayoutDashboard, label: "Overview", exact: true },
        {
          href: "/admin/courses",
          icon: ClipboardCheck,
          label: "Course Moderation",
          trailing:
            pendingReview > 0 ? (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-md bg-amber-100 px-1 text-[10.5px] font-semibold text-amber-700">
                {pendingReview}
              </span>
            ) : undefined,
        },
        { href: "/admin/courses?tab=published", icon: LibraryBig, label: "Courses" },
        { href: "/admin/users", icon: Users, label: "Users" },
      ],
    },
    {
      label: "Marketplace",
      items: [
        { href: "/admin/orders", icon: Receipt, label: "Orders" },
        { href: "/admin/payouts", icon: Landmark, label: "Payouts" },
        { href: "/admin/categories", icon: LayoutGrid, label: "Categories" },
      ],
    },
    {
      label: "Trust & Insight",
      items: [
        { href: "/admin/reviews", icon: Star, label: "Reviews" },
        {
          href: "/admin/reports",
          icon: Flag,
          label: "Reports",
          trailing:
            openReports > 0 ? (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-md bg-red-100 px-1 text-[10.5px] font-semibold text-red-600">
                {openReports}
              </span>
            ) : undefined,
        },
        { href: "/admin/analytics", icon: BarChart3, label: "Analytics" },
        { href: "/admin/settings", icon: Settings, label: "Settings" },
      ],
    },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <Logo href="/admin" />
        <span className="rounded-md border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[9.5px] font-bold tracking-wider text-white uppercase"><LocalizedText text={"Admin"} /></span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 scrollbar-thin">
        {groups.map((group, gi) => (
          <div key={group.label} className={cn(gi > 0 && "mt-5")}>
            <p className="px-3 pb-2 text-[10.5px] font-semibold tracking-[0.08em] text-zinc-400 uppercase">
              <LocalizedText text={group.label} />
            </p>
            <nav aria-label={translateUi(group.label)} className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const base = item.href.split("?")[0];
                const active = item.exact ? pathname === base : pathname.startsWith(base);
                return (
                  <NavItem
                    key={item.label}
                    href={item.href}
                    icon={item.icon}
                    label={translateUi(item.label)}
                    active={active}
                    trailing={item.trailing}
                    onNavigate={onNavigate}
                  />
                );
              })}
            </nav>
          </div>
        ))}

        <div className="mx-0.5 mt-6 mb-4 rounded-xl border border-zinc-200 bg-muted/60 p-3.5">
          <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-foreground">
            <ShieldCheck className="size-3.5 text-primary" aria-hidden /><LocalizedText text={"Simulation mode"} /></p>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground"><LocalizedText text={"Every action in this portal changes local preview state only — nothing touches a server."} /></p>
        </div>
      </div>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2.5 rounded-lg p-1.5">
          <Avatar className="size-8.5">
            <AvatarFallback className="bg-zinc-800 text-[11px] text-white"><LocalizedText text={"NV"} /></AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold"><LocalizedText text={adminName} /></p>
            <p className="truncate text-[11.5px] text-muted-foreground"><LocalizedText text={"Marketplace admin · preview"} /></p>
          </div>
        </div>
        <Separator className="my-2" />
        <Link
          href="/"
          className="flex h-10 items-center gap-3 rounded-lg px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:h-9"
        >
          <Compass className="size-4 text-zinc-400" aria-hidden /><LocalizedText text={"Back to Explore"} /></Link>
      </div>
    </div>
  );
}

export function AdminSidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-white lg:block">
      <AdminSidebarContent />
    </aside>
  );
}
