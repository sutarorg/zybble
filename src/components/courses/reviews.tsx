import type { Review } from "@/types";
import { formatCount, formatDate } from "@/lib/format";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RatingStars } from "@/components/ui/rating-stars";
import { cn } from "@/lib/utils";

export function ReviewsSummary({
  rating,
  ratingsCount,
}: {
  rating: number;
  ratingsCount: number;
}) {
  // Deterministic, plausible distribution for the summary bars (demo data).
  const dist = [0.72, 0.18, 0.06, 0.03, 0.01].map((base, i) => {
    const boost = rating >= 4.8 ? [0.06, -0.02, -0.01, -0.02, -0.01][i] : rating >= 4.6 ? [0, 0, 0, 0, 0][i] : [-0.08, 0.04, 0.02, 0.01, 0.01][i];
    return Math.max(0.01, Math.min(0.97, base + boost));
  });

  return (
    <div className="mb-6 flex flex-col gap-6 rounded-xl border border-border bg-muted/50 p-5 sm:flex-row sm:items-center sm:gap-10">
      <div className="text-center sm:text-left">
        <p className="font-display text-4xl font-bold tracking-tight">{rating.toFixed(1)}</p>
        <RatingStars rating={rating} className="mt-2" starClassName="size-4" />
        <p className="mt-1.5 text-[12.5px] text-muted-foreground">
          {formatCount(ratingsCount)} ratings
        </p>
      </div>
      <div className="flex-1 space-y-1.5">
        {dist.map((pct, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="w-7 text-right text-[11.5px] text-zinc-400 tabular-nums">{5 - i}★</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200">
              <div className="h-full rounded-full bg-star" style={{ width: `${pct * 100}%` }} />
            </div>
            <span className="w-9 text-[11.5px] text-zinc-400 tabular-nums">
              {Math.round(pct * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReviewList({ reviews }: { reviews: Review[] }) {
  if (reviews.length === 0) return null;
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {reviews.map((review) => (
        <li key={review.id} className="rounded-xl border border-border bg-white p-5">
          <div className="flex items-center gap-3">
            <Avatar className="size-9">
              <AvatarFallback className={cn("text-[11px]", review.avatarColor)}>
                {review.initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-semibold">
                {review.author}
                {review.role && (
                  <span className="ml-1.5 text-[12px] font-normal text-zinc-400">· {review.role}</span>
                )}
              </p>
              <div className="mt-0.5 flex items-center gap-2">
                <RatingStars rating={review.rating} />
                <span className="text-[11.5px] text-zinc-400">{formatDate(review.date)}</span>
              </div>
            </div>
          </div>
          <p className="mt-3 text-[13.5px] font-medium">{review.title}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{review.text}</p>
        </li>
      ))}
    </ul>
  );
}
