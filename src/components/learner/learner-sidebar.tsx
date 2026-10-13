"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Award,
  Bookmark,
  Flame,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Receipt,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getDictionary } from "@/lib/i18n";
import { Logo } from "@/components/layout/logo";
import { useApp } from "@/components/providers/app-providers";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

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
      <span className="truncate">{label}</span>
      {trailing ? <span className="ml-auto">{trailing}</span> : null}
    </Link>
  );
}

export function LearnerSidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user, signOut, wishlist, enrollments, learnerPrefs, certificates, language } = useApp();
  const dict = getDictionary(language);

  const items = [
    { href: "/dashboard", icon: LayoutDashboard, label: dict.overview, active: pathname === "/dashboard" },
    {
      href: "/my-learning",
      icon: GraduationCap,
      label: dict.myLearning,
      active: pathname.startsWith("/my-learning") || pathname.startsWith("/learn"),
      trailing:
        enrollments.length > 0 ? (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-md bg-violet-100 px-1 text-[10.5px] font-semibold text-violet-700">
            {enrollments.length}
          </span>
        ) : undefined,
    },
    {
      href: "/wishlist",
      icon: Bookmark,
      label: dict.wishlist,
      active: pathname.startsWith("/wishlist"),
      trailing:
        wishlist.length > 0 ? (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-md bg-violet-100 px-1 text-[10.5px] font-semibold text-violet-700">
            {wishlist.length}
          </span>
        ) : undefined,
    },
    { href: "/orders", icon: Receipt, label: dict.orders, active: pathname.startsWith("/orders") },
    {
      href: "/certificates",
      icon: Award,
      label: dict.certificates,
      active: pathname.startsWith("/certificates"),
      trailing:
        certificates.length > 0 ? (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-md bg-emerald-100 px-1 text-[10.5px] font-semibold text-emerald-700">
            {certificates.length}
          </span>
        ) : undefined,
    },
    { href: "/settings", icon: Settings, label: dict.settings, active: pathname.startsWith("/settings") },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-5 pb-4">
        <Logo href="/dashboard" />
      </div>

      <div className="flex-1 overflow-y-auto px-3 scrollbar-thin">
        <nav aria-label="Learner" className="flex flex-col gap-0.5">
          {items.map((item) => (
            <NavItem key={item.href} {...item} onNavigate={onNavigate} />
          ))}
        </nav>

        {/* Streak / goal panel */}
        <div className="mx-0.5 mt-6 mb-4 rounded-xl border border-violet-200/80 bg-accent p-3.5">
          <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-accent-foreground">
            <Flame className="size-3.5" aria-hidden />
            Daily goal: {learnerPrefs.goalMinutesPerDay} min
          </p>
          <div className="mt-2.5 flex gap-1">
            {[0, 1, 2, 3, 4, 5, 6].map((d) => (
              <span
                key={d}
                className={cn(
                  "h-1.5 flex-1 rounded-full",
                  d < 4 ? "bg-primary" : "bg-violet-200"
                )}
                aria-hidden
              />
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-violet-900/60">
            Simulated 4-day streak — small sessions compound.
          </p>
        </div>
      </div>

      <div className="border-t border-border p-3">
        {user ? (
          <div className="flex items-center gap-2.5 rounded-lg p-1.5">
            <Avatar className="size-8.5">
              <AvatarFallback className="bg-primary text-[11px] text-white">
                {user.initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold">{user.name}</p>
              <Link href="/settings" className="text-[11.5px] font-medium text-primary hover:underline">
                {dict.viewSettings}
              </Link>
            </div>
            <button
              type="button"
              onClick={signOut}
              title={dict.signOut}
              className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:outline-none"
            >
              <LogOut className="size-4" />
              <span className="sr-only">{dict.signOut}</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 p-1">
            <Button asChild size="sm" className="w-full">
              <Link href="/signup">{dict.createFreeAccount}</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link href="/login">{dict.signIn}</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function LearnerSidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-white lg:block">
      <LearnerSidebarContent />
    </aside>
  );
}
