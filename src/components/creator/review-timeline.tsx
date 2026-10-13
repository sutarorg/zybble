import { LocalizedText } from "@/components/providers/localized-text";
import { CircleCheck, CircleDashed, CircleX, MessageSquareWarning, Send } from "lucide-react";
import type { CourseReviewEvent, CourseStatus } from "@/types";
import { STATUS_META } from "@/lib/creator";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_ICON: Record<CourseStatus, React.ComponentType<{ className?: string }>> = {
  draft: CircleDashed,
  pending: Send,
  published: CircleCheck,
  changes_requested: MessageSquareWarning,
  rejected: CircleX,
};

export function ReviewTimeline({ events }: { events: CourseReviewEvent[] }) {
  const sorted = [...events].sort((a, b) => +new Date(a.at) - +new Date(b.at));
  return (
    <ol className="relative space-y-4">
      {sorted.map((event, i) => {
        const Icon = STATUS_ICON[event.status];
        const meta = STATUS_META[event.status];
        const isLast = i === sorted.length - 1;
        return (
          <li key={event.id} className="relative flex gap-3">
            {!isLast && (
              <span className="absolute top-7 left-[13px] h-[calc(100%-14px)] w-px bg-border" aria-hidden />
            )}
            <span
              className={cn(
                "z-10 flex size-7 shrink-0 items-center justify-center rounded-full border bg-white",
                event.status === "published"
                  ? "border-emerald-200 text-emerald-600"
                  : event.status === "changes_requested"
                    ? "border-sky-200 text-sky-600"
                    : event.status === "rejected"
                      ? "border-red-200 text-red-500"
                      : event.status === "pending"
                        ? "border-amber-200 text-amber-600"
                        : "border-zinc-200 text-zinc-500"
              )}
            >
              <Icon className="size-3.5" aria-hidden />
            </span>
            <div className="min-w-0 pb-1">
              <p className="text-[13.5px] font-semibold">
                <LocalizedText text={meta.label} />
                <span className="ml-2 text-[11.5px] font-normal text-zinc-400">
                  {event.actor === "creator" ? "by you" : "by review team (simulated)"} ·<LocalizedText text={" "} />
                  <LocalizedText text={timeAgo(event.at)} />
                </span>
              </p>
              {event.note && (
                <p className="mt-1 rounded-lg border border-border bg-muted/50 px-3 py-2 text-[12.5px] leading-relaxed text-muted-foreground">
                  <LocalizedText text={event.note} />
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
