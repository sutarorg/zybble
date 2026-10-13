"use client";

import { LocalizedText, useTranslate } from "@/components/providers/localized-text";
import * as React from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { CornerDownRight, MessageSquareReply, SearchX, Send, Star } from "lucide-react";
import { REVIEWS } from "@/data/mock-data";
import { useCreator } from "@/components/providers/creator-provider";
import { formatDate } from "@/lib/format";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RatingStars } from "@/components/ui/rating-stars";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function CreatorReviewsPage() {
  const translateUi = useTranslate();
  const { hydrated, courses, replies, addReply, profile } = useCreator();
  const [courseFilter, setCourseFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [openReply, setOpenReply] = useState<string | null>(null);

  const courseMap = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);
  const reviews = useMemo(
    () =>
      REVIEWS.filter((r) => courseMap.has(r.courseId)).sort(
        (a, b) => +new Date(b.date) - +new Date(a.date)
      ),
    [courseMap]
  );

  const filtered = useMemo(
    () =>
      reviews.filter((r) => {
        if (courseFilter !== "all" && r.courseId !== courseFilter) return false;
        if (ratingFilter !== "all" && Math.floor(r.rating) !== Number(ratingFilter)) return false;
        return true;
      }),
    [reviews, courseFilter, ratingFilter]
  );

  const summary = useMemo(() => {
    const avg = reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : 0;
    const dist = [5, 4, 3, 2, 1].map((stars) => ({
      stars,
      count: reviews.filter((r) => Math.floor(r.rating) === stars).length,
    }));
    return { avg, dist, total: reviews.length };
  }, [reviews]);

  if (!hydrated) {
    return (
      <div aria-busy>
        <Skeleton className="h-9 w-56" />
        <Skeleton className="mt-6 h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold tracking-[0.14em] text-primary uppercase"><LocalizedText text={"Creator Studio"} /></p>
        <h1 className="font-display mt-1.5 text-[26px] font-bold tracking-tight sm:text-3xl"><LocalizedText text={"Student reviews"} /></h1>
        <p className="mt-1.5 text-[14px] text-muted-foreground"><LocalizedText text={"What learners say about your published courses. Replies are stored locally."} /></p>
      </div>

      {/* Summary */}
      <section className="flex flex-col gap-6 rounded-xl border border-border bg-white p-5 shadow-card sm:flex-row sm:items-center sm:gap-10">
        <div className="text-center sm:w-36 sm:text-left">
          <p className="font-display text-4xl font-bold tracking-tight"><LocalizedText text={summary.avg.toFixed(1)} /></p>
          <RatingStars rating={summary.avg} className="mt-2" starClassName="size-4" />
          <p className="mt-1.5 text-[12.5px] text-muted-foreground">{summary.total}<LocalizedText text={"reviews"} /></p>
        </div>
        <div className="flex-1 space-y-1.5">
          {summary.dist.map((d) => (
            <div key={d.stars} className="flex items-center gap-3">
              <span className="flex w-7 items-center gap-0.5 text-[11.5px] text-zinc-400 tabular-nums">
                {d.stars}
                <Star className="size-3 fill-zinc-300 text-zinc-300" aria-hidden />
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
                <div
                  className="h-full rounded-full bg-star transition-all duration-500"
                  style={{ width: `${summary.total ? (d.count / summary.total) * 100 : 0}%` }}
                />
              </div>
              <span className="w-6 text-[11.5px] text-zinc-400 tabular-nums">{d.count}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2 sm:flex-col">
          <Select value={courseFilter} onValueChange={setCourseFilter}>
            <SelectTrigger className="h-8.5 w-48 text-[12.5px]" aria-label={translateUi("Filter by course")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="all"><LocalizedText text={"All courses"} /></SelectItem>
              {courses
                .filter((c) => reviews.some((r) => r.courseId === c.id))
                .map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <LocalizedText text={c.title} />
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Select value={ratingFilter} onValueChange={setRatingFilter}>
            <SelectTrigger className="h-8.5 w-32 text-[12.5px]" aria-label={translateUi("Filter by rating")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="all"><LocalizedText text={"All ratings"} /></SelectItem>
              {[5, 4, 3, 2, 1].map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {s}<LocalizedText text={"stars"} /></SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* Review list */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={translateUi("No reviews match")}
          description={translateUi("Try another course or rating filter.")}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCourseFilter("all");
                setRatingFilter("all");
              }}
            ><LocalizedText text={"Clear filters"} /></Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {filtered.map((review) => {
            const course = courseMap.get(review.courseId);
            const reply = replies[review.id];
            return (
              <li key={review.id} className="rounded-xl border border-border bg-white p-5 shadow-card">
                <div className="flex items-start gap-3">
                  <Avatar className="size-9.5">
                    <AvatarFallback className={cn("text-[11px]", review.avatarColor)}>
                      <LocalizedText text={review.initials} />
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <p className="text-[13.5px] font-semibold"><LocalizedText text={review.author} /></p>
                      {review.role && <span className="text-[12px] text-zinc-400">· <LocalizedText text={review.role} /></span>}
                      <RatingStars rating={review.rating} />
                      <span className="text-[11.5px] text-zinc-400"><LocalizedText text={formatDate(review.date)} /></span>
                    </div>
                    <p className="mt-2 text-[13.5px] font-medium"><LocalizedText text={review.title} /></p>
                    <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted-foreground"><LocalizedText text={review.text} /></p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      {course && (
                        <Badge variant="secondary" className="font-normal">
                          <LocalizedText text={course.title} />
                        </Badge>
                      )}
                      <button
                        type="button"
                        onClick={() => setOpenReply(openReply === review.id ? null : review.id)}
                        className="flex cursor-pointer items-center gap-1 text-[12px] font-medium text-primary hover:underline"
                      >
                        <MessageSquareReply className="size-3.5" aria-hidden />
                        {reply ? "Edit reply" : "Reply"}
                      </button>
                    </div>

                    {/* Saved instructor reply */}
                    {reply && (
                      <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-violet-200 bg-accent px-3.5 py-2.5">
                        <CornerDownRight className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                        <div>
                          <p className="text-[11.5px] font-semibold text-accent-foreground"><LocalizedText text={"Your response as"} /><LocalizedText text={profile.displayName.split(" ")[0]} />
                          </p>
                          <p className="mt-0.5 text-[12.5px] leading-relaxed text-violet-950/80"><LocalizedText text={reply} /></p>
                        </div>
                      </div>
                    )}

                    {/* Reply composer */}
                    {openReply === review.id && (
                      <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3">
                        <Textarea
                          value={replyDrafts[review.id] ?? reply ?? ""}
                          onChange={(e) => setReplyDrafts((d) => ({ ...d, [review.id]: e.target.value }))}
                          placeholder={translateUi("Thank the learner and add something useful — replies are saved locally.")}
                          className="min-h-20 bg-white"
                          aria-label={translateUi(`Reply to ${review.author}`)}
                        />
                        <div className="mt-2 flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setOpenReply(null)}><LocalizedText text={"Cancel"} /></Button>
                          <Button
                            size="sm"
                            disabled={!(replyDrafts[review.id] ?? reply ?? "").trim()}
                            onClick={() => {
                              addReply(review.id, (replyDrafts[review.id] ?? reply ?? "").trim());
                              setOpenReply(null);
                              toast.success("Reply saved (locally)");
                            }}
                          >
                            <Send aria-hidden />
                            {reply ? "Update reply" : "Post reply"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-center text-[12px] text-zinc-400"><LocalizedText text={"Learners also see these reviews on the"} /><LocalizedText text={" "} />
        <Link href="/" className="font-medium text-primary hover:underline"><LocalizedText text={"public course pages"} /></Link>
        .
      </p>
    </div>
  );
}
