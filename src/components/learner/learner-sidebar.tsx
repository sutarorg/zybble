"use client";

import { LocalizedText, useTranslate } from "@/components/providers/localized-text";
import Link from "next/link";
import { TeachingCard } from "@/components/layout/teaching-card";
import { usePathname, useRouter } from "next/navigation";
import {
  Award,
  Bookmark,
  Compass,
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
import type { SidebarCounts } from "./learner-counts";

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

export function LearnerSidebarContent({
  onNavigate,
  counts,
}: {
  onNavigate?: () => void;
  counts?: SidebarCounts;
}) {
  const translateUi = useTranslate();
  const pathname = usePathname();
  const router = useRouter();
  const { signOut, language } = useApp();
  const enrollmentCount = counts?.enrollmentCount ?? 0;
  const wishlistCount = counts?.wishlistCount ?? 0;
  const certificateCount = counts?.certificateCount ?? 0;
  // Counters, the daily goal and the streak are read on the server and passed
  // through as props; the browser never invents them.
  const goalMinutesPerDay = counts?.goalMinutesPerDay ?? 0;
  const streakDays = counts?.streakDays ?? 0;
  const activeDays = counts?.activeDays ?? [];
  const lessonsThisWeek = counts?.lessonsThisWeek ?? 0;
  const dict = getDictionary(language);

  const items = [
    { href: "/dashboard", icon: LayoutDashboard, label: dict.overview, active: pathname === "/dashboard" },
    {
      href: "/my-learning",
      icon: GraduationCap,
      label: dict.myLearning,
      active: pathname.startsWith("/my-learning") || pathname.startsWith("/learn"),
      trailing:
        enrollmentCount > 0 ? (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-md bg-violet-100 px-1 text-[10.5px] font-semibold text-violet-700">
            {enrollmentCount}
          </span>
        ) : undefined,
    },
    {
      href: "/wishlist",
      icon: Bookmark,
      label: dict.wishlist,
      active: pathname.startsWith("/wishlist"),
      trailing:
        wishlistCount > 0 ? (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-md bg-violet-100 px-1 text-[10.5px] font-semibold text-violet-700">
            {wishlistCount}
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
        certificateCount > 0 ? (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-md bg-emerald-100 px-1 text-[10.5px] font-semibold text-emerald-700">
            {certificateCount}
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
        <nav aria-label={translateUi("Learner")} className="flex flex-col gap-0.5">
          {items.map((item) => (
            <NavItem key={item.href} {...item} onNavigate={onNavigate} />
          ))}
        </nav>

        {/* Streak / goal panel — every number comes from `lesson_progress`. */}
        <div className="mx-0.5 mt-6 mb-4 rounded-xl border border-violet-200/80 bg-accent p-3.5">
          <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-accent-foreground">
            <Flame className="size-3.5" aria-hidden />
            <LocalizedText text={dict.dailyGoal(goalMinutesPerDay)} />
          </p>

          <div className="mt-2.5 flex gap-1" role="img" aria-label={translateUi(dict.lastSevenDays)}>
            {activeDays.map((active, index) => (
              <span
                key={index}
                className={cn("h-1.5 flex-1 rounded-full", active ? "bg-primary" : "bg-violet-200")}
                aria-hidden
              />
            ))}
          </div>

          <p className="mt-2 text-[11px] leading-relaxed text-violet-900/60">
            <LocalizedText
              text={
                streakDays > 0
                  ? dict.streakSummary(streakDays, lessonsThisWeek)
                  : dict.streakEmpty
              }
            />
          </p>
        </div>
      </div>

      {/*
        No profile block down here. The header's user menu already carries the
        avatar, name, settings link and sign-out; repeating the learner's
        identity at the bottom of the navigation only duplicated it.
      */}
      <div className="border-t border-border p-3">
        <div className="flex flex-col gap-0.5">
          <TeachingCard onNavigate={onNavigate} />
          <Link
            href="/"
            onClick={onNavigate}
            className="mt-2 flex h-10 items-center gap-3 rounded-lg px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:h-9"
          >
            <Compass className="size-4 text-zinc-400" aria-hidden />
            <LocalizedText text={dict.backToExplore} />
          </Link>
          <button
            type="button"
            onClick={() => {
              signOut();
              router.push("/");
            }}
            className="flex h-10 cursor-pointer items-center gap-3 rounded-lg px-3 text-left text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:outline-none lg:h-9"
          >
            <LogOut className="size-4 text-zinc-400" aria-hidden />
            <LocalizedText text={dict.signOut} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function LearnerSidebar({ counts }: { counts?: SidebarCounts }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-white lg:block">
      <LearnerSidebarContent counts={counts} />
    </aside>
  );
}
