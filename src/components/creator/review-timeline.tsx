import { CircleCheck, CircleDashed, CircleX, MessageSquareWarning, Send } from "lucide-react";
import { statusMeta } from "@/lib/creator";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface ReviewEvent {
  id: string;
  at: string;
  status: string;
  actor: string;
  note: string | null;
}

const STATUS_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  draft: CircleDashed,
  pending: Send,
  published: CircleCheck,
  changes_requested: MessageSquareWarning,
  rejected: CircleX,
};

const TONE: Record<string, string> = {
  published: "border-emerald-200 text-emerald-600",
  changes_requested: "border-sky-200 text-sky-600",
  rejected: "border-red-200 text-red-500",
  pending: "border-amber-200 text-amber-600",
};

/** Chronological moderation history recorded against a course. */
export function ReviewTimeline({ events }: { events: ReviewEvent[] }) {
  const sorted = [...events].sort((a, b) => a.at.localeCompare(b.at));

  if (sorted.length === 0) {
    return (
      <p className="mt-4 text-[13px] text-muted-foreground">
        Nothing has happened yet. Submitting a course starts this history.
      </p>
    );
  }

  return (
    <ol className="relative mt-4 space-y-4">
      {sorted.map((event, index) => {
        const Icon = STATUS_ICON[event.status] ?? CircleDashed;
        const meta = statusMeta(event.status);
        const isLast = index === sorted.length - 1;
        return (
          <li key={event.id} className="relative flex gap-3">
            {!isLast ? (
              <span className="absolute top-7 left-[13px] h-[calc(100%-14px)] w-px bg-border" aria-hidden />
            ) : null}
            <span
              className={cn(
                "z-10 flex size-7 shrink-0 items-center justify-center rounded-full border bg-white",
                TONE[event.status] ?? "border-zinc-200 text-zinc-500"
              )}
            >
              <Icon className="size-3.5" aria-hidden />
            </span>
            <div className="min-w-0 pb-1">
              <p className="text-[13.5px] font-semibold">
                {meta.label}
                <span className="ml-2 text-[11.5px] font-normal text-zinc-400">
                  {event.actor === "creator" ? "by you" : "by the review team"} · {timeAgo(event.at)}
                </span>
              </p>
              {event.note ? (
                <p className="mt-1 rounded-lg border border-border bg-muted/50 px-3 py-2 text-[12.5px] leading-relaxed text-muted-foreground">
                  {event.note}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}