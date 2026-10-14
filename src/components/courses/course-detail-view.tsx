"use client";

import { LocalizedText, useTranslate } from "@/components/providers/localized-text";
import * as React from "react";
import Link from "next/link";
import { Check, FileDown, Globe2, Languages, RefreshCcw, Signal, Sparkles, Users } from "lucide-react";
import { useApp } from "@/components/providers/app-providers";
import type { Course, Instructor, Review } from "@/types";
import { courseCategory, LEVEL_LABELS } from "@/lib/courses";
import { formatCount, formatMonthYear } from "@/lib/format";
import { categoryIcon } from "@/lib/icons";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RatingStars } from "@/components/ui/rating-stars";
import { Curriculum } from "@/components/courses/curriculum";
import { InstructorCard } from "@/components/courses/instructor-card";
import { ReviewsSummary, ReviewList } from "@/components/courses/reviews";
import { EnrollCard } from "@/components/courses/enroll-card";
import { PreviewDialog } from "@/components/courses/preview-dialog";
import { CourseCard } from "@/components/courses/course-card";
import { SectionHeader } from "@/components/courses/section-header";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

function Section({
  id,
  title,
  children,
  className,
}: {
  id?: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("mt-10", className)}>
      <h2 className="font-display mb-4 text-lg font-semibold tracking-tight"><LocalizedText text={title} /></h2>
      {children}
    </section>
  );
}

/**
 * Shared course detail body — used by the static catalog page (SSG) and by
 * the client-side view for locally published creator courses.
 */
export function CourseDetailView({
  course,
  instructor,
  instructorStats,
  reviews,
  related,
  category,
  enrolled,
  wishlisted,
  checkoutBlocked = null,
}: {
  course: Course;
  instructor: Instructor;
  /** Counted server-side from this creator's published courses and reviews. */
  instructorStats: { courses: number; students: number; reviews: number; rating: number };
  reviews: Review[];
  related: Course[];
  category: ReturnType<typeof courseCategory>;
  /** True when the signed-in learner already holds a live entitlement. */
  enrolled: boolean;
  /** True when this course is on the signed-in learner's wishlist. */
  wishlisted: boolean;
  /** Set when paid checkout cannot be completed for this course right now. */
  checkoutBlocked?: string | null;
}) {
  const translateUi = useTranslate();
  const CategoryIcon = categoryIcon(category.icon);
  // NB: rendered via createElement below — assigning the icon to a capitalised
  // local and rendering it as JSX makes the compiler treat it as a
  // "component created during render".
  const isNew = course.ratingsCount === 0;
  const { session } = useApp();
  // Reviews are already filtered server-side by the `reviews_public_read` RLS
  // policy (published + on a published course), so no client-side trust is needed.
  const visibleReviews = reviews;

  React.useEffect(() => {
    if (!session) return;
    // Anonymous visitors get no local history at all.
    void fetch("/api/learner/recent-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId: course.id }),
    }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course.id]);

  return (
    <div className="mx-auto max-w-330 px-4 py-6 pb-4 sm:px-6 lg:px-8">
      <Breadcrumb
        items={[
          { label: "Explore", href: "/" },
          { label: category.name, href: `/categories/${category.slug}` },
          { label: course.title },
        ]}
      />

      <div className="mt-5 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* ------------------------------- Main column ------------------------------ */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="violet" className="gap-1">
              {React.createElement(CategoryIcon, { "aria-hidden": true })}
              <LocalizedText text={category.name} />
            </Badge>
            {course.badge === "bestseller" && <Badge variant="amber"><LocalizedText text={"Bestseller"} /></Badge>}
            {course.badge === "popular" && <Badge variant="violet"><LocalizedText text={"Popular"} /></Badge>}
            {course.badge === "new" && <Badge variant="emerald"><LocalizedText text={"New"} /></Badge>}
          </div>

          <h1 className="font-display mt-3 text-2xl leading-tight font-bold tracking-tight sm:text-[32px]">
            <LocalizedText text={course.title} />
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            <LocalizedText text={course.subtitle} />
          </p>

          {/* Meta row */}
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-muted-foreground">
            {isNew ? (
              <span className="flex items-center gap-1.5 font-medium text-emerald-700">
                <Sparkles className="size-4" aria-hidden /><LocalizedText text={"New course"} /></span>
            ) : (
              <span className="flex items-center gap-2">
                <span className="font-display text-[15px] font-bold text-foreground">
                  <LocalizedText text={course.rating.toFixed(1)} />
                </span>
                <RatingStars rating={course.rating} />
                <a href="#reviews" className="text-primary hover:underline">
                  (<LocalizedText text={formatCount(course.ratingsCount)} /><LocalizedText text={"ratings)"} /></a>
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Users className="size-4 text-zinc-400" aria-hidden />
              <LocalizedText text={formatCount(course.studentsCount)} /><LocalizedText text={"students"} /></span>
            <span className="flex items-center gap-1.5">
              <Signal className="size-4 text-zinc-400" aria-hidden />
              <LocalizedText text={LEVEL_LABELS[course.level]} />
            </span>
            <span className="flex items-center gap-1.5">
              <RefreshCcw className="size-3.5 text-zinc-400" aria-hidden /><LocalizedText text={"Updated"} /><LocalizedText text={formatMonthYear(course.lastUpdated)} />
            </span>
            <span className="flex items-center gap-1.5">
              <Globe2 className="size-4 text-zinc-400" aria-hidden />
              {course.language}
            </span>
            <span className="flex items-center gap-1.5">
              <Languages className="size-4 text-zinc-400" aria-hidden />
              {course.captions.length}<LocalizedText text={"caption languages"} /></span>
          </div>

          {/* Instructor strip */}
          <div className="mt-5 flex items-center gap-3">
            <Avatar className="size-9 ring-1 ring-border">
              <AvatarFallback className={cn("text-[11px]", instructor.avatarColor)}>
                <LocalizedText text={instructor.initials} />
              </AvatarFallback>
            </Avatar>
            <div className="text-[13px]">
              <Link
                href={`/instructors/${instructor.username}`}
                className="font-semibold transition-colors hover:text-primary"
              >
                <LocalizedText text={instructor.name} />
              </Link>
              <p className="text-muted-foreground"><LocalizedText text={instructor.headline} /></p>
            </div>
          </div>

          {/* Preview (16:9) */}
          <div className="mt-6 max-w-2xl">
            <PreviewDialog course={course} />
          </div>

          {/* What you'll learn */}
          {course.whatYouLearn.length > 0 && (
            <Section title={translateUi("What you'll learn")}>
              <div className="rounded-xl border border-border bg-white p-5 sm:p-6">
                <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
                  {course.whatYouLearn.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                      <LocalizedText text={item} />
                    </li>
                  ))}
                </ul>
              </div>
            </Section>
          )}

          {/* Curriculum */}
          {course.curriculum.length > 0 && (
            <Section title={translateUi("Course curriculum")}>
              <Curriculum course={course} />
              {course.downloadableResources > 0 && (
                <p className="mt-3 flex items-center gap-2 text-[12.5px] text-muted-foreground">
                  <FileDown className="size-4 text-zinc-400" aria-hidden /><LocalizedText text={"Includes"} />{course.downloadableResources}<LocalizedText text={"downloadable resources marked in the curriculum."} /></p>
              )}
            </Section>
          )}

          {/* Description */}
          <Section title={translateUi("About this course")}>
            <div className="space-y-4 text-[14px] leading-relaxed text-muted-foreground">
              {course.longDescription.map((p, i) => (
                <p key={i}><LocalizedText text={p} /></p>
              ))}
            </div>
            {course.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {course.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="font-normal">
                    <LocalizedText text={tag} />
                  </Badge>
                ))}
              </div>
            )}
          </Section>

          {/* Instructor */}
          <Section title={translateUi("Meet your instructor")}>
            <InstructorCard instructor={instructor} stats={instructorStats} />
          </Section>

          {/* Requirements & audience */}
          {(course.requirements.length > 0 || course.audience.length > 0) && (
            <Section title={translateUi("Who this course is for")}>
              <div className="grid gap-4 sm:grid-cols-2">
                {course.requirements.length > 0 && (
                  <div className="rounded-xl border border-border bg-white p-5">
                    <h3 className="text-[13.5px] font-semibold"><LocalizedText text={"Requirements"} /></h3>
                    <ul className="mt-3 space-y-2">
                      {course.requirements.map((r) => (
                        <li key={r} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-muted-foreground">
                          <span className="mt-[7px] size-1 shrink-0 rounded-full bg-zinc-400" aria-hidden />
                          <LocalizedText text={r} />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {course.audience.length > 0 && (
                  <div className="rounded-xl border border-border bg-white p-5">
                    <h3 className="text-[13.5px] font-semibold"><LocalizedText text={"Target audience"} /></h3>
                    <ul className="mt-3 space-y-2">
                      {course.audience.map((a) => (
                        <li key={a} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-muted-foreground">
                          <Check className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                          <LocalizedText text={a} />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Reviews */}
          <Section id="reviews" title={translateUi("Learner reviews")}>
            {isNew ? (
              <EmptyState
                icon={Sparkles}
                title={translateUi("No reviews yet")}
                description={translateUi("This course just launched. Be one of the first learners to enroll and review it.")}
              />
            ) : visibleReviews.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title={translateUi("No visible reviews")}
                description={translateUi("All reviews for this course are currently moderated. Check back later.")}
              />
            ) : (
              <>
                <ReviewsSummary rating={course.rating} ratingsCount={course.ratingsCount} reviews={reviews} />
                <ReviewList reviews={visibleReviews} />
              </>
            )}
          </Section>
        </div>

        {/* ------------------------------ Sticky purchase ----------------------------- */}
        <div className="min-w-0">
          <EnrollCard
            course={course}
            enrolled={enrolled}
            saved={wishlisted}
            checkoutBlocked={checkoutBlocked}
          />
        </div>
      </div>

      {/* Related */}
      {related.length > 0 && (
        <div className="mt-14">
          <SectionHeader
            title={translateUi("Related courses")}
            description={translateUi("Learners who took this course also explored")}
            viewAllHref={`/categories/${category.slug}`}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((c) => (
              <CourseCard key={c.id} course={c} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
