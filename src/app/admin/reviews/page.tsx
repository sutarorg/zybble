import { MessageSquare, Star } from "lucide-react";
import { getAdminReviews } from "@/lib/server/admin";
import { EmptyState } from "@/components/ui/empty-state";
import { ModerateReviewButton } from "./moderate-review-button";

export const metadata = { title: "Reviews" };
export const dynamic = "force-dynamic";

export default async function AdminReviewsPage() {
  const reviews = await getAdminReviews();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-[26px] leading-tight font-bold tracking-tight">Reviews</h1>
        <p className="mt-1.5 text-[14px] text-muted-foreground">
          {reviews.length === 0
            ? "No reviews yet."
            : `${reviews.length} review${reviews.length === 1 ? "" : "s"} · ${reviews.filter((r) => !r.published).length} hidden`}
        </p>
      </header>

      {reviews.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No reviews"
          description="Reviews can only be written by learners with an entitlement, and they are never seeded."
        />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {reviews.map((review) => (
            <li key={review.id} className="rounded-xl border border-border bg-white p-4 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[12.5px] text-muted-foreground">{review.courseTitle}</p>
                  <p className="mt-0.5 text-[14px] font-semibold">{review.title || "No title"}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
                  <span className="text-[13px] font-medium tabular-nums">{review.rating.toFixed(1)}</span>
                </div>
              </div>
              <p className="mt-2 text-[13.5px] leading-relaxed">{review.body}</p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[12px] text-zinc-400">
                  {review.author} · {new Date(review.createdAt).toLocaleDateString("en-IN")}
                </p>
                <ModerateReviewButton reviewId={review.id} published={review.published} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}