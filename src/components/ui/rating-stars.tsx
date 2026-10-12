import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** 5-star display with fractional fill, e.g. 4.7 stars. */
export function RatingStars({
  rating,
  className,
  starClassName,
}: {
  rating: number;
  className?: string;
  starClassName?: string;
}) {
  const pct = Math.min(100, Math.max(0, (rating / 5) * 100));
  return (
    <span className={cn("relative inline-flex align-middle", className)} aria-hidden>
      <span className="flex gap-px text-zinc-300">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className={cn("size-3.5 fill-current", starClassName)} />
        ))}
      </span>
      <span
        className="absolute inset-0 flex gap-px overflow-hidden text-star"
        style={{ width: `${pct}%` }}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className={cn("size-3.5 shrink-0 fill-current", starClassName)} />
        ))}
      </span>
      <span className="sr-only">{rating} out of 5 stars</span>
    </span>
  );
}
