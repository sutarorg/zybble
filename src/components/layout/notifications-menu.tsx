"use client";

import * as React from "react";
import { LocalizedText, useTranslate } from "@/components/providers/localized-text";
import { useRouter } from "next/navigation";
import { Bell, BookOpen, CheckCheck, Megaphone, MessageSquare, Sparkles } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { markNotificationsRead } from "@/app/(learner)/actions";
import { useApp } from "@/components/providers/app-providers";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface NotificationItem {
  id: string;
  kind: string;
  title: string;
  body: string;
  href: string | null;
  createdAt: string;
  read: boolean;
}

const KIND_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  course: BookOpen,
  promo: Megaphone,
  message: MessageSquare,
  moderation: MessageSquare,
  payout: Megaphone,
  system: Sparkles,
};

/**
 * Learner notifications.
 *
 * The list is read from Postgres on the server and passed in; marking read is a
 * server action scoped to the caller's own rows by RLS.
 */
export function NotificationsMenu({ items }: { items: NotificationItem[] }) {
  const translateUi = useTranslate();
  const router = useRouter();
  const { session } = useApp();
  const [read, setRead] = React.useState<string[]>(items.filter((item) => item.read).map((item) => item.id));

  const visible = session ? items : [];
  const unread = visible.filter((item) => !read.includes(item.id));

  function mark(ids: string[]) {
    setRead((previous) => Array.from(new Set([...previous, ...ids])));
    void markNotificationsRead(ids);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={!session}
          aria-label={translateUi(`Notifications${unread.length ? `, ${unread.length} unread` : ""}`)}
          title={session ? undefined : "Sign in to see notifications"}
          className="relative flex size-9.5 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Bell className="size-4.5" aria-hidden />
          {unread.length > 0 ? (
            <span className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white ring-2 ring-white">
              {unread.length}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-88 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="font-display text-sm font-semibold"><LocalizedText text={"Notifications"} /></p>
          <button
            type="button"
            disabled={unread.length === 0}
            onClick={() => mark(unread.map((item) => item.id))}
            className="flex cursor-pointer items-center gap-1 text-[12px] font-medium text-primary transition-colors hover:text-primary-hover disabled:cursor-not-allowed disabled:text-zinc-400"
          >
            <CheckCheck className="size-3.5" aria-hidden /><LocalizedText text={"Mark all read"} /></button>
        </div>
        {visible.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">
            Nothing new. Course updates and order receipts will show up here.
          </p>
        ) : (
          <ul className="max-h-96 overflow-y-auto p-1.5 scrollbar-thin">
            {visible.map((item) => {
              const Icon = KIND_ICON[item.kind] ?? Sparkles;
              const isUnread = !read.includes(item.id);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (isUnread) mark([item.id]);
                      if (item.href) router.push(item.href);
                    }}
                    className={cn(
                      "flex w-full cursor-pointer items-start gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-muted",
                      isUnread && "bg-accent/60"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border",
                        isUnread ? "border-violet-200 bg-white text-primary" : "border-border bg-muted text-zinc-500"
                      )}
                    >
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[13px] font-semibold"><LocalizedText text={item.title} /></span>
                        {isUnread ? <span className="size-1.5 shrink-0 rounded-full bg-primary" /> : null}
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-[12px] leading-snug text-muted-foreground">
                        <LocalizedText text={item.body} />
                      </span>
                      <span className="mt-1 block text-[11px] text-zinc-400">{timeAgo(item.createdAt)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}