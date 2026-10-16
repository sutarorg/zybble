"use client";

import { LocalizedText, useTranslate } from "@/components/providers/localized-text";
import Link from "next/link";
import { TeachingCard } from "@/components/layout/teaching-card";
import { usePathname } from "next/navigation";
import { Compass, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORIES } from "@/lib/config/catalog";
import { categoryIcon } from "@/lib/icons";
import { getDictionary } from "@/lib/i18n";
import { useApp } from "@/components/providers/app-providers";
import { Logo } from "@/components/layout/logo";
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

export function SidebarContent({
  onNavigate,
  enrollmentCount = 0,
}: {
  onNavigate?: () => void;
  /** Server-counted enrollments for this learner. 0 when signed out. */
  enrollmentCount?: number;
}) {
  const translateUi = useTranslate();
  const pathname = usePathname();
  const { user, language } = useApp();
  const dict = getDictionary(language);

  // Explore is the site root. Signed-in learners also get My Learning
  // directly below it; guests and signed-out visitors do not.
  const mainNav = [
    {
      href: "/",
      icon: Compass,
      label: dict.explore,
      active: pathname === "/",
    },
    ...(user
      ? [
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
        ]
      : []),
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-5 pb-4">
        <Logo />
      </div>

      <div className="flex-1 overflow-y-auto px-3 scrollbar-thin">
        <nav aria-label={translateUi("Primary")} className="flex flex-col gap-0.5">
          {mainNav.map((item) => (
            <NavItem key={item.href} {...item} onNavigate={onNavigate} />
          ))}
        </nav>

        <Separator className="my-4" />

        <p className="px-3 pb-2 text-[10.5px] font-semibold tracking-[0.08em] text-zinc-400 uppercase">
          <LocalizedText text={dict.categories} />
        </p>
        <nav aria-label={translateUi(dict.categories)} className="flex flex-col gap-0.5 pb-4">
          {CATEGORIES.map((category) => {
            const Icon = categoryIcon(category.icon);
            const href = `/categories/${category.slug}`;
            return (
              <NavItem
                key={category.slug}
                href={href}
                icon={Icon}
                label={translateUi(category.name)}
                active={pathname === href}
                onNavigate={onNavigate}
              />
            );
          })}
        </nav>
      </div>

      {/*
        The public sidebar deliberately shows no account block. The marketplace
        is browsable by guests and shared screens alike, so the signed-in
        learner's name, avatar and sign-out live only in the header account
        menu, where the session is unambiguous and one click away.
      */}
      <div className="border-t border-border p-3">
        <TeachingCard onNavigate={onNavigate} />
      </div>
    </div>
  );
}

export function Sidebar({ enrollmentCount = 0 }: { enrollmentCount?: number }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-white lg:block">
      <SidebarContent enrollmentCount={enrollmentCount} />
    </aside>
  );
}
