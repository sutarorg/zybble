"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import {
  EyeOff,
  RotateCcw,
  Search,
  SearchX,
  Star,
} from "lucide-react";
import { COURSES, REVIEWS } from "@/data/mock-data";
import { useAdmin } from "@/components/providers/admin-provider";
import { formatDate } from "@/lib/format";
import { ActionButton } from "@/components/admin/action-button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RatingStars } from "@/components/ui/rating-stars";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

export default function AdminReviewsPage() {
  const { hydrated, hiddenReviewIds, hideReview, restoreReview } = useAdmin();
  const [query, setQuery] = useState("");
  const [starsFilter, setStarsFilter] = useState("all");
  const [visibility, setVisibility] = useState<"all" | "visible" | "hidden">("all");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return REVIEWS.filter((r) => {
      const hidden = hiddenReviewIds.includes(r.id);
      if (visibility === "visible" && hidden) return false;
      if (visibility === "hidden" && !hidden) return false;
      if (starsFilter !== "all" && Math.floor(r.rating) !== Number(starsFilter)) return false;
      const course = COURSES.find((c) => c.id === r.courseId);
      if (q && !`${r.author} ${r.title} ${r.text} ${course?.title ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => +new Date(b.date) - +new Date(a.date));
  }, [query, starsFilter, visibility, hiddenReviewIds]);

  const summary = useMemo(() => {
    const avg = REVIEWS.length ? REVIEWS.reduce((a, r) => a + r.rating, 0) / REVIEWS.length : 0;
    return { total: REVIEWS.length, hidden: hiddenReviewIds.length, avg };
  }, [hiddenReviewIds]);

  if (!hydrated) return <Skeleton className="h-96 rounded-xl" />;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold tracking-[0.14em] text-primary uppercase">Trust & Safety</p>
        <h1 className="font-display mt-1.5 text-[26px] font-bold tracking-tight sm:text-3xl">Review moderation</h1>
        <p className="mt-1.5 max-w-2xl text-[14px] text-muted-foreground">
          {summary.total} marketplace reviews ·{" "}
          <span className="font-medium text-foreground">{summary.hidden} hidden</span> · average
          rating {summary.avg.toFixed(1)}. Moderation actions confirm first and persist locally.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search reviewer, text or course…"
            aria-label="Search reviews"
            className="h-9.5 w-full rounded-lg border border-input bg-white pr-3 pl-9 text-sm shadow-xs outline-none placeholder:text-zinc-400 focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/20 [&::-webkit-search-cancel-button]:hidden"
          />
        </div>
        <div className="flex gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="Rating filter">
          {["all", "5", "4", "3"].map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={starsFilter === s}
              onClick={() => setStarsFilter(s)}
              className={cn(
                "flex h-8 cursor-pointer items-center gap-1 rounded-md px-3 text-[12.5px] font-medium transition-all",
                starsFilter === s ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {s === "all" ? "All ratings" : <>{s}<Star className="size-3 fill-star text-star" aria-hidden />+</>}
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="Visibility filter">
          {(["all", "visible", "hidden"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={visibility === v}
              onClick={() => setVisibility(v)}
              className={cn(
                "h-8 cursor-pointer rounded-md px-3 text-[12.5px] font-medium capitalize transition-all",
                visibility === v ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {v === "all" ? "All" : v === "visible" ? "Visible" : `Hidden (${hiddenReviewIds.length})`}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No reviews match"
          description="Try another search, rating or visibility filter."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setQuery(""); setStarsFilter("all"); setVisibility("all"); }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((review) => {
            const course = COURSES.find((c) => c.id === review.courseId);
            const hidden = hiddenReviewIds.includes(review.id);
            return (
              <li key={review.id} className={cn("rounded-xl border border-border bg-white p-5 shadow-card", hidden && "bg-muted/40")}>
                <div className="flex items-start gap-3">
                  <Avatar className="size-9.5">
                    <AvatarFallback className={cn("text-[11px]", review.avatarColor)}>
                      {review.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <p className="text-[13.5px] font-semibold">{review.author}</p>
                      {review.role && <span className="text-[11.5px] text-zinc-400">· {review.role}</span>}
                      <RatingStars rating={review.rating} />
                      <span className="text-[11.5px] text-zinc-400">{formatDate(review.date)}</span>
                      {hidden && <Badge variant="secondary">Hidden</Badge>}
                    </div>
                    <p className={cn("mt-1.5 text-[13.5px] font-medium", hidden && "text-muted-foreground")}>{review.title}</p>
                    <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-muted-foreground">{review.text}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2.5">
                      {course && (
                        <Badge variant="secondary" className="font-normal">
                          {course.title}
                        </Badge>
                      )}
                      {hidden ? (
                        <ActionButton
                          label="Restore review"
                          icon={RotateCcw}
                          variant="outline"
                          size="sm"
                          confirmTitle="Restore this review?"
                          confirmBody="The review becomes visible again in the local mock state."
                          confirmLabel="Restore review"
                          onAction={() => restoreReview(review.id)}
                          toastText="Review restored (simulated)"
                        />
                      ) : (
                        <ActionButton
                          label="Hide review"
                          icon={EyeOff}
                          variant="outline"
                          danger
                          size="sm"
                          confirmTitle={`Hide the review by ${review.author}?`}
                          confirmBody="Hidden reviews disappear from public course pages in this demo. You can restore them any time."
                          confirmLabel="Hide review"
                          onAction={() => hideReview(review.id)}
                          toastText="Review hidden (simulated)"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
