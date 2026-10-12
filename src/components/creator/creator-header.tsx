"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  Menu,
  Plus,
  Search,
  Star,
  Wallet,
  Sparkles,
  ClipboardCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/layout/logo";
import { CreatorSidebarContent } from "@/components/creator/creator-sidebar";
import { useCreator } from "@/components/providers/creator-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";

const KIND_ICON = { review: ClipboardCheck, sale: Star, payout: Wallet, system: Sparkles } as const;

function CreatorNotificationsMenu() {
  const router = useRouter();
  const { creatorNotifications, readCreatorNotifIds, markAllCreatorNotifsRead, hydrated } =
    useCreator();
  const unread = hydrated
    ? creatorNotifications.filter((n) => !readCreatorNotifIds.includes(n.id))
    : [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Creator notifications${unread.length ? `, ${unread.length} unread` : ""}`}
          className="relative flex size-9.5 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:outline-none"
        >
          <Bell className="size-4.5" aria-hidden />
          {unread.length > 0 && (
            <span className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white ring-2 ring-white">
              {unread.length}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-88 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="font-display text-sm font-semibold">Studio notifications</p>
          <button
            type="button"
            disabled={unread.length === 0}
            onClick={() => markAllCreatorNotifsRead(creatorNotifications.map((n) => n.id))}
            className="flex cursor-pointer items-center gap-1 text-[12px] font-medium text-primary transition-colors hover:text-primary-hover disabled:cursor-not-allowed disabled:text-zinc-400"
          >
            <CheckCheck className="size-3.5" aria-hidden />
            Mark all read
          </button>
        </div>
        <ul className="max-h-96 overflow-y-auto p-1.5 scrollbar-thin">
          {creatorNotifications.map((n) => {
            const Icon = KIND_ICON[n.kind];
            const isUnread = hydrated && !readCreatorNotifIds.includes(n.id);
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (!readCreatorNotifIds.includes(n.id)) {
                      markAllCreatorNotifsRead([...readCreatorNotifIds, n.id]);
                    }
                    router.push(n.href);
                  }}
                  className={cn(
                    "flex w-full cursor-pointer items-start gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-muted",
                    isUnread && "bg-accent/60"
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border",
                      isUnread
                        ? "border-violet-200 bg-white text-primary"
                        : "border-border bg-muted text-zinc-500"
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[13px] font-semibold">{n.title}</span>
                      {isUnread && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-[12px] leading-snug text-muted-foreground">
                      {n.body}
                    </span>
                    <span className="mt-1 block text-[11px] text-zinc-400">{timeAgo(n.createdAt)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CreatorAvatarMenu() {
  const { profile } = useCreator();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Creator account menu"
          className="flex cursor-pointer items-center gap-1.5 rounded-full p-0.5 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:outline-none"
        >
          <Avatar className="size-8.5 ring-1 ring-border">
            <AvatarFallback className={cn("text-[11px]", profile.avatarColor)}>
              {profile.initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <div className="flex items-center gap-3 px-2.5 py-2.5">
          <Avatar className="size-10">
            <AvatarFallback className={cn("text-xs", profile.avatarColor)}>
              {profile.initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-[13.5px] font-semibold">{profile.displayName}</p>
            <p className="truncate text-[12px] text-muted-foreground">{profile.headline}</p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/instructors/maya-lindqvist">View public profile</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/creator/profile">Edit instructor profile</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/creator/settings">Studio settings</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/explore">Back to learner experience</Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => toast.info("This demo signs you in as the instructor permanently.")}>
          Switch account (demo)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function CreatorHeader({ title }: { title?: string }) {
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);
  const [q, setQ] = useState("");

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-white/85 backdrop-blur-md">
      <div className="flex h-16 items-center gap-3 px-4 sm:gap-4 sm:px-6 lg:px-8">
        <Sheet open={navOpen} onOpenChange={setNavOpen}>
          <button
            type="button"
            aria-label="Open creator navigation"
            onClick={() => setNavOpen(true)}
            className="flex size-9.5 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:outline-none lg:hidden"
          >
            <Menu className="size-5" aria-hidden />
          </button>
          <SheetContent side="left" className="w-72 p-0">
            <VisuallyHidden.Root>
              <SheetTitle>Creator navigation</SheetTitle>
            </VisuallyHidden.Root>
            <CreatorSidebarContent onNavigate={() => setNavOpen(false)} />
          </SheetContent>
        </Sheet>

        <Logo className="lg:hidden" showWordmark={false} href="/creator" />

        {/* Contextual search: searches your courses */}
        <form
          role="search"
          className="mx-auto w-full max-w-md flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            router.push(q.trim() ? `/creator/courses?q=${encodeURIComponent(q.trim())}` : "/creator/courses");
          }}
        >
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-zinc-400" aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={title ?? "Search your courses…"}
              aria-label="Search your courses"
              className="h-10 w-full rounded-full border border-transparent bg-muted pr-4 pl-10 text-sm outline-none placeholder:text-zinc-400 focus:border-primary/40 focus:bg-white focus:ring-2 focus:ring-ring/15 [&::-webkit-search-cancel-button]:hidden"
            />
          </div>
        </form>

        <div className="flex items-center gap-1.5">
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/creator/courses/new">
              <Plus aria-hidden />
              Create Course
            </Link>
          </Button>
          <CreatorNotificationsMenu />
          <div className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden />
          <CreatorAvatarMenu />
        </div>
      </div>
    </header>
  );
}
