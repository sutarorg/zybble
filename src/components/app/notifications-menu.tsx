"use client";

import { Bell, CalendarClock } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLocalPosts } from "@/lib/app/hooks";

/**
 * Notifications entry point. Since there is no backend, the feed derives
 * genuinely from the user's own local-scheduled posts — and shows an honest
 * empty state otherwise.
 */
export function NotificationsMenu() {
  const posts = useLocalPosts();
  const scheduled = posts
    .filter((p) => p.status === "scheduled" && p.scheduledAt)
    .slice(0, 3);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={
            scheduled.length > 0
              ? `Notifications — ${scheduled.length} upcoming`
              : "Notifications — none"
          }
          className="relative flex size-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-brand-600"
        >
          <Bell className="size-[18px]" aria-hidden />
          {scheduled.length > 0 && (
            <span
              aria-hidden
              className="absolute right-1.5 top-1.5 size-2 rounded-full bg-brand-600 ring-2 ring-white"
            />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">Notifications</p>
          <Badge variant="neutral">Local preview</Badge>
        </div>
        {scheduled.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Bell className="mx-auto size-5 text-slate-300" aria-hidden />
            <p className="mt-3 text-sm font-medium text-slate-700">You&rsquo;re all caught up</p>
            <p className="mt-1 text-[13px] leading-5 text-slate-500">
              Publish results, failures and connection notices will land here
              once the backend is live.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 py-1">
            {scheduled.map((post) => (
              <li key={post.id} className="flex gap-3 px-4 py-3">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <CalendarClock className="size-3.5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-slate-800">
                    Post scheduled for{" "}
                    {post.scheduledAt
                      ? format(new Date(post.scheduledAt), "EEE d MMM, HH:mm")
                      : "later"}
                  </p>
                  <p className="mt-0.5 truncate text-[13px] text-slate-500">{post.text}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
