"use client";

import { LocalizedText, useTranslate } from "@/components/providers/localized-text";
import * as React from "react";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Star, Trash2 } from "lucide-react";
import type { Course } from "@/types";
import { useApp } from "@/components/providers/app-providers";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RatingStars } from "@/components/ui/rating-stars";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Interactive 1–5 star picker (keyboard friendly, radio semantics). */
function StarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const [hover, setHover] = useState(0);
  const active = hover || value;
  return (
    <div role="radiogroup" aria-label="Rating" className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star > 1 ? "s" : ""}`}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          onFocus={() => setHover(star)}
          onBlur={() => setHover(0)}
          onClick={() => onChange(star)}
          className="cursor-pointer rounded-md p-0.5 transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
        >
          <Star
            className={cn(
              "size-6 transition-colors",
              star <= active ? "fill-star text-star" : "fill-transparent text-zinc-300"
            )}
            aria-hidden
          />
        </button>
      ))}
    </div>
  );
}

/**
 * "Rate this course" panel for the player.
 *
 * Only rendered once every lesson is complete — reviews are a reward for
 * finishing, and the learner can edit or delete their review afterwards.
 */
export function CourseReviewPanel({ course }: { course: Course }) {
  const translateUi = useTranslate();
  const { user, getCourseReview, saveCourseReview, removeCourseReview, hydrated } = useApp();
  const review = hydrated ? getCourseReview(course.id) : undefined;

  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(review?.rating ?? 5);
  const [title, setTitle] = useState(review?.title ?? "");
  const [text, setText] = useState(review?.text ?? "");
  const [error, setError] = useState("");

  const openDialog = () => {
    setRating(review?.rating ?? 5);
    setTitle(review?.title ?? "");
    setText(review?.text ?? "");
    setError("");
    setOpen(true);
  };

  const submit = () => {
    if (rating < 1) {
      setError("Pick a rating from 1 to 5 stars.");
      return;
    }
    if (title.trim().length < 3) {
      setError("Give your review a short headline (3+ characters).");
      return;
    }
    if (text.trim().length < 10) {
      setError("Tell other learners a little more (10+ characters).");
      return;
    }
    saveCourseReview(course.id, { rating, title: title.trim(), text: text.trim() });
    setOpen(false);
    toast.success(review ? "Your review was updated" : "Thanks! Your review is live on the course page");
  };

  return (
    <section className="mt-8 rounded-xl border border-violet-200 bg-accent/50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-display text-[15.5px] font-semibold">
            <Star className="size-4.5 fill-star text-star" aria-hidden />
            <LocalizedText text={review ? "Your review" : "You finished the course — rate it"} />
          </h2>
          {review ? (
            <div className="mt-2">
              <div className="flex items-center gap-2">
                <RatingStars rating={review.rating} starClassName="size-4" />
                <span className="text-[12px] text-muted-foreground">
                  <LocalizedText text={formatDate(review.updatedAt)} />
                </span>
              </div>
              <p className="mt-2 text-[13.5px] font-semibold"><LocalizedText text={review.title} /></p>
              <p className="mt-0.5 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
                <LocalizedText text={review.text} />
              </p>
              <p className="mt-1.5 text-[11.5px] text-zinc-400">
                <LocalizedText text={user?.name ? `Published as ${user.name}` : "Published on the course page"} />
              </p>
            </div>
          ) : (
            <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
              <LocalizedText text="Reviews are unlocked when you complete every lesson. Share what worked, what didn't, and who this course is for." />
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {review ? (
            <>
              <Button variant="outline" onClick={openDialog}>
                <Pencil aria-hidden /><LocalizedText text={"Edit review"} />
              </Button>
              <Button
                variant="ghost"
                className="text-destructive hover:bg-red-50 hover:text-destructive"
                onClick={() => {
                  removeCourseReview(course.id);
                  toast.success("Review removed");
                }}
              >
                <Trash2 aria-hidden /><span className="sr-only"><LocalizedText text={"Delete review"} /></span>
              </Button>
            </>
          ) : (
            <Button onClick={openDialog}>
              <Star aria-hidden /><LocalizedText text={"Write a review"} />
            </Button>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle><LocalizedText text={review ? "Edit your review" : "Rate this course"} /></DialogTitle>
            <DialogDescription>
              <LocalizedText text={`How was “${course.title}”? Your review appears on the public course page.`} />
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label><LocalizedText text={"Your rating *"} /></Label>
              <StarPicker value={rating} onChange={setRating} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rv-title"><LocalizedText text={"Headline *"} /></Label>
              <Input
                id="rv-title"
                value={title}
                maxLength={80}
                placeholder={translateUi("Sum it up, e.g. “Worth every minute”")}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rv-text"><LocalizedText text={"Your review *"} /></Label>
              <Textarea
                id="rv-text"
                value={text}
                maxLength={1200}
                placeholder={translateUi("What did you build? What surprised you? Who should take this next?")}
                onChange={(e) => setText(e.target.value)}
                className="min-h-28"
              />
              <p className="text-[11.5px] text-zinc-400 tabular-nums">{text.length}/1200</p>
            </div>
            {error && <p className="text-[12.5px] font-medium text-destructive"><LocalizedText text={error} /></p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}><LocalizedText text={"Cancel"} /></Button>
            <Button onClick={submit}>
              <Star aria-hidden /><LocalizedText text={review ? "Save review" : "Publish review"} />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
