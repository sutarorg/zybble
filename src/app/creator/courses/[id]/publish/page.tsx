"use client";

import { LocalizedText, useTranslate } from "@/components/providers/localized-text";
import * as React from "react";
import { use, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  CircleCheck,
  Eye,
  Info,
  Pencil,
  RotateCcw,
  Send,
} from "lucide-react";
import { useCreator } from "@/components/providers/creator-provider";
import { STATUS_META } from "@/lib/creator";
import { getCategoryBySlug, LEVEL_LABELS } from "@/lib/courses";
import { formatPrice } from "@/lib/format";
import { StatusBadge } from "@/components/creator/status-badge";
import { ReviewTimeline } from "@/components/creator/review-timeline";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function PublishPage({ params }: { params: Promise<{ id: string }> }) {
  const translateUi = useTranslate();
  const { id } = use(params);
  const { hydrated, getCourse, submitForReview, withdrawSubmission } = useCreator();
  const [busy, setBusy] = useState(false);

  const course = hydrated ? getCourse(id) : undefined;

  if (!hydrated) {
    return (
      <div aria-busy>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-6 h-96 rounded-xl" />
      </div>
    );
  }
  if (!course) notFound();

  const meta = STATUS_META[course.status];
  const category = getCategoryBySlug(course.category);
  const lessonsCount = course.curriculum.reduce((n, s) => n + s.lessons.length, 0);

  const checks = [
    { label: "Basics complete", ok: course.title.length >= 4 && course.description.length >= 20 && !!course.category },
    { label: "2+ learning outcomes", ok: course.whatYouLearn.length >= 2 },
    { label: "Curriculum has lessons", ok: lessonsCount > 0 },
    { label: "Pricing set", ok: course.price === 0 || course.price >= 4.99 },
    { label: "Thumbnail chosen", ok: !!course.thumbnail },
  ];
  const readyCount = checks.filter((c) => c.ok).length;

  const canSubmit = course.status === "draft" || course.status === "changes_requested" || course.status === "rejected";
  const canWithdraw = course.status === "pending";

  const doSubmit = () => {
    setBusy(true);
    window.setTimeout(() => {
      submitForReview(id);
      setBusy(false);
      toast.success("Submitted for review — track it below (simulated)");
    }, 800);
  };

  const doWithdraw = () => {
    withdrawSubmission(id);
    toast.success("Submission withdrawn — back to Draft");
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/creator/courses">
            <ArrowLeft aria-hidden /><LocalizedText text={"My Courses"} /></Link>
        </Button>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-[24px] font-bold tracking-tight"><LocalizedText text={"Preview & publish"} /></h1>
            <p className="mt-1 text-[13px] text-muted-foreground"><LocalizedText text={course.title} /></p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/creator/courses/${id}/edit`}>
                <Pencil aria-hidden /><LocalizedText text={"Edit details"} /></Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/courses/${course.slug}`}>
                <Eye aria-hidden /><LocalizedText text={"Public preview"} /></Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Status banner */}
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 rounded-xl border p-5",
          course.status === "published" && "border-emerald-200 bg-emerald-50",
          course.status === "pending" && "border-amber-200 bg-amber-50",
          course.status === "draft" && "border-border bg-muted/50",
          course.status === "changes_requested" && "border-sky-200 bg-sky-50",
          course.status === "rejected" && "border-red-200 bg-red-50"
        )}
      >
        <div className="flex items-center gap-3">
          <StatusBadge status={course.status} />
          <p className="text-[13px] text-muted-foreground"><LocalizedText text={meta.description} /><LocalizedText text={"Local simulation — no real admin review happens."} /></p>
        </div>
        <div className="flex items-center gap-2">
          {canSubmit && (
            <Button onClick={doSubmit} loading={busy} size="sm">
              <Send aria-hidden />
              {course.status === "changes_requested" ? "Resubmit for review" : "Submit for review"}
            </Button>
          )}
          {canWithdraw && (
            <Button onClick={doWithdraw} variant="outline" size="sm">
              <RotateCcw aria-hidden /><LocalizedText text={"Withdraw submission"} /></Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Preview card */}
        <section className="rounded-xl border border-border bg-white p-5 shadow-card">
          <h2 className="font-display text-[15.5px] font-semibold"><LocalizedText text={"Course preview"} /></h2>
          <div className="mt-4 overflow-hidden rounded-xl border border-border">
            <div className="relative aspect-video w-full bg-muted">
              <Image src={course.thumbnail} alt={translateUi("")} fill sizes="480px" className="object-cover" />
            </div>
            <div className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                {category && <Badge variant="violet"><LocalizedText text={category.name} /></Badge>}
                <Badge variant="secondary"><LocalizedText text={LEVEL_LABELS[course.level]} /></Badge>
                <Badge variant="secondary">{course.language}</Badge>
              </div>
              <p className="font-display mt-2.5 text-[15px] font-semibold tracking-tight"><LocalizedText text={course.title} /></p>
              <p className="mt-1 line-clamp-2 text-[12.5px] text-muted-foreground"><LocalizedText text={course.subtitle} /></p>
              <div className="mt-3 flex items-center justify-between">
                <span className="font-display text-[15px] font-bold">
                  {course.price === 0 ? <span className="text-success"><LocalizedText text={"Free"} /></span> : formatPrice(course.price)}
                </span>
                <span className="text-[12px] text-muted-foreground">
                  {lessonsCount}<LocalizedText text={"lessons ·"} />{course.curriculum.length}<LocalizedText text={"sections"} /></span>
              </div>
            </div>
          </div>

          {/* Checklist */}
          <h3 className="mt-5 text-[13px] font-semibold"><LocalizedText text={"Readiness checklist"} /></h3>
          <ul className="mt-2.5 space-y-2">
            {checks.map((c) => (
              <li key={c.label} className="flex items-center gap-2 text-[13px]">
                {c.ok ? (
                  <CircleCheck className="size-4 shrink-0 text-emerald-500" aria-hidden />
                ) : (
                  <span className="size-4 shrink-0 rounded-full border-2 border-amber-400" aria-hidden />
                )}
                <span className={cn(!c.ok && "text-amber-700")}><LocalizedText text={c.label} /></span>
              </li>
            ))}
          </ul>
          <p className="mt-2.5 text-[12px] text-zinc-400">{readyCount}/{checks.length}<LocalizedText text={"complete"} /></p>
        </section>

        {/* Review history */}
        <section className="rounded-xl border border-border bg-white p-5 shadow-card">
          <h2 className="font-display text-[15.5px] font-semibold"><LocalizedText text={"Review history"} /></h2>
          <div className="mt-4">
            <ReviewTimeline events={course.reviewHistory} />
          </div>
          <div className="mt-5 flex items-start gap-2 rounded-lg border border-violet-200 bg-accent p-3 text-[12px] leading-relaxed text-violet-950/70">
            <Info className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden /><LocalizedText text={"Reviewer notes in this timeline are simulated locally. A real marketplace review would appear here once processed."} /></div>
        </section>
      </div>
    </div>
  );
}
