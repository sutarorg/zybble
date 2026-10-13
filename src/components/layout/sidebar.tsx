"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, GraduationCap, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORIES } from "@/data/mock-data";
import { categoryIcon } from "@/lib/icons";
import { getDictionary } from "@/lib/i18n";
import { useApp } from "@/components/providers/app-providers";
import { Logo } from "@/components/layout/logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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
      <span className="truncate">{label}</span>
      {trailing ? <span className="ml-auto">{trailing}</span> : null}
    </Link>
  );
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user, signOut, language, enrollments } = useApp();
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
              enrollments.length > 0 ? (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-md bg-violet-100 px-1 text-[10.5px] font-semibold text-violet-700">
                  {enrollments.length}
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
        <nav aria-label="Primary" className="flex flex-col gap-0.5">
          {mainNav.map((item) => (
            <NavItem key={item.href} {...item} onNavigate={onNavigate} />
          ))}
        </nav>

        <Separator className="my-4" />

        <p className="px-3 pb-2 text-[10.5px] font-semibold tracking-[0.08em] text-zinc-400 uppercase">
          {dict.categories}
        </p>
        <nav aria-label={dict.categories} className="flex flex-col gap-0.5 pb-4">
          {CATEGORIES.map((category) => {
            const Icon = categoryIcon(category.icon);
            const href = `/categories/${category.slug}`;
            return (
              <NavItem
                key={category.slug}
                href={href}
                icon={Icon}
                label={category.name}
                active={pathname === href}
                onNavigate={onNavigate}
              />
            );
          })}
        </nav>
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
              <p className="truncate text-[11.5px] text-muted-foreground">{user.email}</p>
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

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-white lg:block">
      <SidebarContent />
    </aside>
  );
}
