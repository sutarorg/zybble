"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  BarChart3,
  Compass,
  LayoutDashboard,
  LibraryBig,
  LifeBuoy,
  Plus,
  Settings2,
  Sparkles,
  Star,
  UserRound,
  Wallet,
  Landmark,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/layout/logo";
import { useCreator } from "@/components/providers/creator-provider";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

function NavItem({
  href,
  icon: Icon,
  label,
  active,
  trailing,
  accent,
  onNavigate,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  trailing?: React.ReactNode;
  accent?: boolean;
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
          : accent
            ? "text-primary hover:bg-accent/70"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0 transition-colors",
          active || accent ? "text-primary" : "text-zinc-400 group-hover:text-foreground"
        )}
      />
      <span className="truncate">{label}</span>
      {trailing ? <span className="ml-auto">{trailing}</span> : null}
    </Link>
  );
}

export function CreatorSidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { courses, profile } = useCreator();
  const pending = courses.filter((c) => c.status === "pending" || c.status === "changes_requested").length;

  const groups: { label: string; items: { href: string; icon: React.ComponentType<{ className?: string }>; label: string; exact?: boolean; trailing?: React.ReactNode; accent?: boolean }[] }[] = [
    {
      label: "Studio",
      items: [
        { href: "/creator", icon: LayoutDashboard, label: "Creator Dashboard", exact: true },
        {
          href: "/creator/courses",
          icon: LibraryBig,
          label: "My Courses",
          trailing:
            pending > 0 ? (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-md bg-amber-100 px-1 text-[10.5px] font-semibold text-amber-700">
                {pending}
              </span>
            ) : undefined,
        },
        {
          href: "/creator/courses/new",
          icon: Plus,
          label: "Create Course",
          accent: true,
        },
      ],
    },
    {
      label: "Insights",
      items: [
        { href: "/creator/analytics", icon: BarChart3, label: "Analytics" },
        { href: "/creator/earnings", icon: Wallet, label: "Earnings" },
        { href: "/creator/payouts", icon: Landmark, label: "Payouts" },
        { href: "/creator/reviews", icon: Star, label: "Reviews" },
      ],
    },
    {
      label: "Account",
      items: [
        { href: "/creator/profile", icon: UserRound, label: "Profile" },
        { href: "/creator/settings", icon: Settings2, label: "Settings" },
        { href: "/help", icon: LifeBuoy, label: "Help Center" },
      ],
    },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-5 pb-4">
        <Logo href="/creator" />
      </div>

      <div className="flex-1 overflow-y-auto px-3 scrollbar-thin">
        {groups.map((group, gi) => (
          <div key={group.label} className={cn(gi > 0 && "mt-5")}>
            <p className="px-3 pb-2 text-[10.5px] font-semibold tracking-[0.08em] text-zinc-400 uppercase">
              {group.label}
            </p>
            <nav aria-label={group.label} className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = item.exact ? pathname === item.href : pathname.startsWith(item.href) && !(item.href === "/creator/courses" && pathname.startsWith("/creator/courses/new"));
                return (
                  <NavItem
                    key={item.href}
                    href={item.href}
                    icon={item.icon}
                    label={item.label}
                    active={active}
                    accent={item.accent}
                    trailing={item.trailing}
                    onNavigate={onNavigate}
                  />
                );
              })}
            </nav>
          </div>
        ))}

        {/* Demo persona note */}
        <div className="mx-0.5 mt-6 mb-4 rounded-xl border border-violet-200/80 bg-accent p-3.5">
          <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-accent-foreground">
            <Sparkles className="size-3.5" aria-hidden />
            Instructor demo
          </p>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-violet-900/70">
            You&apos;re viewing the studio as {profile.displayName.split(" ")[0]}. All changes save
            to this browser only.
          </p>
        </div>
      </div>

      <div className="border-t border-border p-3">
        <Link
          href="/creator"
          className="flex h-10 items-center gap-3 rounded-lg px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:h-9"
        >
          <Compass className="size-4 text-zinc-400" aria-hidden />
          Go to Studio
        </Link>
        <Separator className="my-2" />
        <Link
          href="/"
          className="flex h-10 items-center gap-3 rounded-lg px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:h-9"
        >
          <Compass className="size-4 text-zinc-400" aria-hidden />
          Back to Explore
          <ArrowUpRight className="ml-auto size-3.5 text-zinc-400" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

export function CreatorSidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-white lg:block">
      <CreatorSidebarContent />
    </aside>
  );
}
