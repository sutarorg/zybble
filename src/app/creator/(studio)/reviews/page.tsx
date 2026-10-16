import { MessageSquare } from "lucide-react";
import { getCreatorReviews } from "@/lib/server/creator";
import { EmptyState } from "@/components/ui/empty-state";
import { RatingStars } from "@/components/ui/rating-stars";

export const metadata = { title: "Reviews" };
export const dynamic = "force-dynamic";

interface ReviewRow {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  createdAt: string;
  published: boolean;
  courseTitle: string | null;
  learnerName: string | null;
}

export default async function CreatorReviewsPage() {
  const raw = await getCreatorReviews();
  const reviews = raw.map((row) => {
    const course = (row.courses ?? null) as { title: string } | null;
    const learner = (row.profiles ?? null) as { full_name: string } | null;
    return {
      id: String(row.id),
      rating: Number(row.rating ?? 0),
      title: (row.title as string) ?? null,
      body: String(row.body ?? ""),
      createdAt: String(row.created_at),
      published: Boolean(row.published),
      courseTitle: course?.title ?? "Course",
      learnerName: learner?.full_name ?? "A Zybble learner",
    } satisfies ReviewRow;
  });

  const average = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;

  return (
    <div className="space-y-6 [animation:fadeSlide_.35s_ease_both]">
      <header>
        <h1 className="font-display text-[26px] leading-tight font-bold tracking-tight">Learner reviews</h1>
        <p className="mt-1.5 text-[14px] text-muted-foreground">
          {reviews.length === 0
            ? "Reviews appear here once learners rate your published courses."
            : `${reviews.length} review${reviews.length === 1 ? "" : "s"} · average ${average.toFixed(1)} ★`}
        </p>
      </header>

      {reviews.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No reviews yet"
          description="Reviews come from verified enrollments on published courses. Nothing is generated or seeded."
        />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {reviews.map((review) => (
            <li key={review.id} className="rounded-2xl border border-border bg-white p-4 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-muted-foreground">{review.courseTitle}</p>
                  {review.title ? (
                    <p className="mt-0.5 font-display text-[14.5px] font-semibold tracking-tight">{review.title}</p>
                  ) : null}
                </div>
                {!review.published ? (
                  <span className="shrink-0 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">
                    Hidden by a moderator
                  </span>
                ) : null}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <RatingStars rating={review.rating} />
                <span className="text-[12px] text-muted-foreground">{review.rating.toFixed(1)}</span>
              </div>
              <p className="mt-2.5 text-[13.5px] leading-relaxed text-foreground">{review.body}</p>
              <p className="mt-3 text-[12px] text-zinc-400">
                {review.learnerName} · {new Date(review.createdAt).toLocaleDateString("en-IN")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}