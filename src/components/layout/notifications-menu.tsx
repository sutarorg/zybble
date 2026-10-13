"use client";

import { LocalizedText, useTranslate } from "@/components/providers/localized-text";
import { useRouter } from "next/navigation";
import { Bell, BookOpen, CheckCheck, Megaphone, MessageSquare, Sparkles } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NOTIFICATIONS } from "@/data/mock-data";
import { useApp } from "@/components/providers/app-providers";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

const KIND_ICON = {
  course: BookOpen,
  promo: Megaphone,
  message: MessageSquare,
  system: Sparkles,
} as const;

export function NotificationsMenu() {
  const translateUi = useTranslate();
  const router = useRouter();
  const { readNotificationIds, markAllNotificationsRead, hydrated } = useApp();
  const unread = hydrated
    ? NOTIFICATIONS.filter((n) => !readNotificationIds.includes(n.id))
    : [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={translateUi(`Notifications${unread.length ? `, ${unread.length} unread` : ""}`)}
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
          <p className="font-display text-sm font-semibold"><LocalizedText text={"Notifications"} /></p>
          <button
            type="button"
            disabled={unread.length === 0}
            onClick={() => markAllNotificationsRead(NOTIFICATIONS.map((n) => n.id))}
            className="flex cursor-pointer items-center gap-1 text-[12px] font-medium text-primary transition-colors hover:text-primary-hover disabled:cursor-not-allowed disabled:text-zinc-400"
          >
            <CheckCheck className="size-3.5" aria-hidden /><LocalizedText text={"Mark all read"} /></button>
        </div>
        <ul className="max-h-96 overflow-y-auto p-1.5 scrollbar-thin">
          {NOTIFICATIONS.map((n) => {
            const Icon = KIND_ICON[n.kind];
            const isUnread = hydrated && !readNotificationIds.includes(n.id);
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (!readNotificationIds.includes(n.id)) {
                      markAllNotificationsRead([...readNotificationIds, n.id]);
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
                      <span className="truncate text-[13px] font-semibold"><LocalizedText text={n.title} /></span>
                      {isUnread && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-[12px] leading-snug text-muted-foreground">
                      <LocalizedText text={n.body} />
                    </span>
                    <span className="mt-1 block text-[11px] text-zinc-400"><LocalizedText text={timeAgo(n.createdAt)} /></span>
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
