"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { AlertTriangle, Bell, CheckCircle2, Info, Loader2, XCircle } from "lucide-react";
import Link from "next/link";
import { apiPatch, errorMessage } from "@/lib/api/client";
import { useNotifications } from "@/lib/app/hooks";
import type { NotificationItem } from "@/lib/app/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Notifications entry point.
 *
 * Reads the workspace feed from `/api/notifications` (RLS-scoped, polled every
 * 60 s by the hook) and marks rows read through `PATCH`, which is also
 * RLS-scoped. Nothing here is synthesised: an empty feed means the backend has
 * produced no events yet.
 */

const SEVERITY_ICON = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
} as const;

const SEVERITY_TONE = {
  info: "bg-brand-50 text-brand-600",
  success: "bg-emerald-50 text-emerald-600",
  warning: "bg-amber-50 text-amber-600",
  error: "bg-red-50 text-red-600",
} as const;

export function NotificationsMenu() {
  const notifications = useNotifications(8);
  const items = notifications.data ?? [];
  const unread = items.filter((item) => item.readAt === null);

  async function markAllRead() {
    try {
      await apiPatch("/api/notifications", { all: true });
      notifications.setData(items.map((item) => ({ ...item, readAt: new Date().toISOString() })));
    } catch (error) {
      notifications.setError(errorMessage(error, "Could not clear notifications."));
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={
            unread.length > 0
              ? `Notifications — ${unread.length} unread`
              : "Notifications — none unread"
          }
          className="relative flex size-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-brand-600"
        >
          <Bell className="size-[18px]" aria-hidden />
          {unread.length > 0 && (
            <span
              aria-hidden
              className="absolute right-1.5 top-1.5 size-2 rounded-full bg-brand-600 ring-2 ring-white"
            />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">Notifications</p>
          <div className="flex items-center gap-2">
            {notifications.loading && <Loader2 className="size-3.5 animate-spin text-slate-400" aria-hidden />}
            {unread.length > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs font-medium text-brand-700 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
        </div>

        {notifications.error ? (
          <p role="alert" className="px-4 py-8 text-center text-[13px] text-red-600">
            {notifications.error}
          </p>
        ) : items.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Bell className="mx-auto size-5 text-slate-300" aria-hidden />
            <p className="mt-3 text-sm font-medium text-slate-700">You&rsquo;re all caught up</p>
            <p className="mt-1 text-[13px] leading-5 text-slate-500">
              Publish results, failures, connection notices and billing events land here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 py-1">
            {items.map((item) => (
              <NotificationRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

function NotificationRow({ item }: { item: NotificationItem }) {
  const Icon = SEVERITY_ICON[item.severity] ?? Info;
  const inner = (
    <div
      className={cn(
        "flex gap-3 px-4 py-3 transition",
        item.actionUrl && "hover:bg-slate-50",
        item.readAt === null && "bg-brand-50/30",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg",
          SEVERITY_TONE[item.severity] ?? SEVERITY_TONE.info,
        )}
      >
        <Icon className="size-3.5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-slate-800">{item.title}</p>
        <p className="mt-0.5 text-[13px] leading-5 text-slate-500">{item.body}</p>
        <p className="mt-1 text-[11px] text-slate-400">
          {formatDistanceToNowStrict(new Date(item.createdAt), { addSuffix: true })}
        </p>
      </div>
    </div>
  );

  return (
    <li>
      {item.actionUrl ? (
        <Link href={item.actionUrl} className="block">
          {inner}
        </Link>
      ) : (
        inner
      )}
    </li>
  );
}
