"use client";

import * as React from "react";
import { use, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Ban,
  Check,
  ClipboardCheck,
  Eye,
  Info,
  MessageSquareWarning,
  RotateCcw,
  Send,
} from "lucide-react";
import { CATEGORIES, INSTRUCTORS } from "@/data/mock-data";
import { getInstructorById } from "@/lib/courses";
import { useAdmin } from "@/components/providers/admin-provider";
import { useCreator } from "@/components/providers/creator-provider";
import { instructorStats } from "@/lib/courses";
import { formatDate, formatPrice } from "@/lib/format";
import { LEVEL_LABELS } from "@/lib/courses";
import { Curriculum } from "@/components/courses/curriculum";
import { ReviewTimeline } from "@/components/creator/review-timeline";
import { StatusBadge } from "@/components/creator/status-badge";
import { ActionButton } from "@/components/admin/action-button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function CourseReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { hydrated } = useAdmin();
  const {
    approveCourse,
    rejectCourse,
    requestChanges,
    returnToQueue,
    moderationNotes,
    addModerationNote,
  } = useAdmin();
  const { getCourse } = useCreator();
  const course = hydrated ? getCourse(id) : undefined;

  const [noteDraft, setNoteDraft] = useState("");
  const [changesNote, setChangesNote] = useState("");
  const [rejectNote, setRejectNote] = useState("");

  if (!hydrated) {
    return (
      <div aria-busy>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-6 h-96 rounded-xl" />
      </div>
    );
  }
  if (!course) notFound();

  const instructor = getInstructorById(course.instructorId);
  const stats = instructor ? instructorStats(instructor.id) : null;
  const category = CATEGORIES.find((c) => c.slug === course.category);
  const notes = moderationNotes.filter((n) => n.courseId === course.id);

  /* Moderation checklist: auto-derived readiness signals */
  const checks: { label: string; ok: boolean; detail: string }[] = [
    { label: "Complete metadata", ok: course.title.length >= 4 && course.description.length >= 20 && !!course.category, detail: "Title, description and category present" },
    { label: "Learning outcomes", ok: course.whatYouLearn.length >= 2, detail: `${course.whatYouLearn.length} outcomes listed` },
    { label: "Curriculum depth", ok: course.lessonsCount >= 5 && course.curriculum.length >= 2, detail: `${course.curriculum.length} sections · ${course.lessonsCount} lessons` },
    { label: "Total length", ok: course.durationMinutes >= 60, detail: `${Math.round((course.durationMinutes / 60) * 10) / 10} hours of content` },
    { label: "Pricing valid", ok: course.price === 0 || course.price >= 4.99, detail: course.price === 0 ? "Free course" : `${formatPrice(course.price)} USD` },
    { label: "Thumbnail present", ok: !!course.thumbnail, detail: "16:9 artwork attached" },
  ];
  const okCount = checks.filter((c) => c.ok).length;

  const canDecide = course.status === "pending" || course.status === "changes_requested" || course.status === "rejected";
  const canRequestChanges = course.status === "pending";

  const submitChanges = () => {
    if (changesNote.trim().length < 12) {
      toast.error("Add a note explaining the requested changes (min. 12 characters).");
      return;
    }
    requestChanges(course.id, changesNote.trim());
    setChangesNote("");
    toast.success("Changes requested — the creator will see your note in their studio");
  };
  const submitReject = () => {
    if (rejectNote.trim().length < 12) {
      toast.error("A rejection note is required (min. 12 characters).");
      return;
    }
    rejectCourse(course.id, rejectNote.trim());
    setRejectNote("");
  };
  const saveNote = () => {
    if (noteDraft.trim().length < 4) {
      toast.error("Write a slightly longer note first.");
      return;
    }
    addModerationNote(course.id, noteDraft.trim());
    setNoteDraft("");
    toast.success("Internal note saved (local)");
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/admin/courses">
            <ArrowLeft aria-hidden />
            Moderation queue
          </Link>
        </Button>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-4">
            <div className="relative hidden aspect-video w-32 shrink-0 overflow-hidden rounded-lg border border-border sm:block">
              <Image src={course.thumbnail} alt="" fill sizes="128px" className="object-cover" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={course.status} />
                {category && <Badge variant="secondary">{category.name}</Badge>}
                <Badge variant="secondary">{LEVEL_LABELS[course.level]}</Badge>
              </div>
              <h1 className="font-display mt-2 truncate text-[22px] font-bold tracking-tight sm:text-2xl">
                {course.title}
              </h1>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                {course.price === 0 ? "Free" : formatPrice(course.price)} · updated {formatDate(course.lastUpdated)}
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/courses/${course.slug}`}>
              <Eye aria-hidden />
              Public preview
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* Left column — course content */}
        <div className="min-w-0 space-y-4">
          {/* Description */}
          <section className="rounded-xl border border-border bg-white p-5 shadow-card">
            <h2 className="font-display text-[15.5px] font-semibold">Overview</h2>
            <p className="mt-1 text-[13.5px] text-muted-foreground">{course.subtitle}</p>
            <div className="mt-3 space-y-2.5 text-[13.5px] leading-relaxed text-foreground/85">
              {course.longDescription.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </section>

          {/* Outcomes */}
          <section className="rounded-xl border border-border bg-white p-5 shadow-card">
            <h2 className="font-display text-[15.5px] font-semibold">Learning outcomes</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {course.whatYouLearn.map((o) => (
                <li key={o} className="flex items-start gap-2 text-[13px]">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                  {o}
                </li>
              ))}
            </ul>
          </section>

          {/* Curriculum */}
          <section className="rounded-xl border border-border bg-white p-5 shadow-card">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[15.5px] font-semibold">Curriculum</h2>
              <span className="text-[12px] text-muted-foreground">
                {course.curriculum.length} sections · {course.lessonsCount} lessons ·{" "}
                {course.downloadableResources} resources
              </span>
            </div>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Expand sections to preview lesson structure (free-preview lessons are tagged).
            </p>
            <div className="mt-4">
              {course.curriculum.length === 0 ? (
                <p className="rounded-lg border border-dashed border-zinc-300 bg-muted/40 px-4 py-8 text-center text-[13px] text-muted-foreground">
                  No curriculum yet — this course cannot be approved in its current state.
                </p>
              ) : (
                <Curriculum course={course} />
              )}
            </div>
          </section>

          {/* Review history */}
          <section className="rounded-xl border border-border bg-white p-5 shadow-card">
            <h2 className="font-display text-[15.5px] font-semibold">Review history</h2>
            <div className="mt-4">
              <ReviewTimeline events={course.reviewHistory} />
            </div>
          </section>
        </div>

        {/* Right rail — decision tools */}
        <div className="space-y-4">
          {/* Decisions */}
          <section className="rounded-xl border border-border bg-white p-5 shadow-card">
            <h2 className="font-display text-[15.5px] font-semibold">Moderation decision</h2>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
              Decisions update the shared mock store. The creator sees them instantly in their
              studio on this device.
            </p>
            <div className="mt-4 space-y-2">
              <ActionButton
                label="Approve & publish"
                icon={ClipboardCheck}
                className="w-full"
                disabled={!canDecide || okCount < checks.length - 1}
                confirmTitle={`Approve “${course.title}”?`}
                confirmBody="The course is published. If it's a community course, it appears in Explore on this device immediately."
                confirmLabel="Approve & publish"
                onAction={() => approveCourse(course.id)}
                toastText="Course approved and published (simulated)"
              />
              {course.status === "published" && (
                <ActionButton
                  label="Return to queue"
                  icon={RotateCcw}
                  variant="outline"
                  className="w-full"
                  confirmTitle="Return to review queue?"
                  confirmBody="The course moves back to Pending Review and leaves the public catalog if it's a community course."
                  confirmLabel="Return to queue"
                  onAction={() => returnToQueue(course.id)}
                  toastText="Course returned to the queue"
                />
              )}
            </div>

            {/* Request changes */}
            {canRequestChanges && (
              <div className="mt-4 rounded-xl border border-border bg-muted/40 p-3.5">
                <label className="flex items-center gap-1.5 text-[13px] font-semibold" htmlFor="changes-note">
                  <MessageSquareWarning className="size-4 text-sky-600" aria-hidden />
                  Request changes
                </label>
                <Textarea
                  id="changes-note"
                  value={changesNote}
                  onChange={(e) => setChangesNote(e.target.value)}
                  placeholder="e.g. Please add alt-text guidance to lesson 2.1 and a privacy note about screenshots…"
                  className="mt-2 min-h-20 bg-white text-[13px]"
                />
                <Button size="sm" className="mt-2 w-full" variant="outline" onClick={submitChanges}>
                  Send change request (note required)
                </Button>
              </div>
            )}

            {/* Reject */}
            {(course.status === "pending" || course.status === "changes_requested") && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50/60 p-3.5">
                <label className="flex items-center gap-1.5 text-[13px] font-semibold text-destructive" htmlFor="reject-note">
                  <Ban className="size-4" aria-hidden />
                  Reject submission
                </label>
                <Textarea
                  id="reject-note"
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="Required: explain why the course cannot be published…"
                  className="mt-2 min-h-20 bg-white text-[13px]"
                />
                <ActionButton
                  label="Reject with note"
                  icon={Ban}
                  variant="destructive"
                  size="sm"
                  className="mt-2 w-full"
                  disabled={rejectNote.trim().length < 12}
                  confirmTitle={`Reject “${course.title}”?`}
                  confirmBody="The creator is notified with your note. The course can be resubmitted after fixes."
                  confirmLabel="Reject submission"
                  onAction={submitReject}
                  toastText="Submission rejected with note (simulated)"
                />
              </div>
            )}
          </section>

          {/* Checklist */}
          <section className="rounded-xl border border-border bg-white p-5 shadow-card">
            <h2 className="font-display text-[15.5px] font-semibold">Quality checklist</h2>
            <ul className="mt-3 space-y-2.5">
              {checks.map((c) => (
                <li key={c.label} className="flex items-start gap-2.5">
                  {c.ok ? (
                    <span className="mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                      <Check className="size-3 text-emerald-600" strokeWidth={3} aria-hidden />
                    </span>
                  ) : (
                    <span className="mt-0.5 size-4.5 shrink-0 rounded-full border-2 border-amber-400" aria-hidden />
                  )}
                  <div>
                    <p className={cn("text-[13px] font-medium", !c.ok && "text-amber-700")}>{c.label}</p>
                    <p className="text-[11.5px] text-zinc-400">{c.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[12px] text-zinc-400">
              {okCount}/{checks.length} checks pass — approvals require at most one outstanding item.
            </p>
          </section>

          {/* Creator */}
          {instructor && (
            <section className="rounded-xl border border-border bg-white p-5 shadow-card">
              <h2 className="font-display text-[15.5px] font-semibold">Creator</h2>
              <div className="mt-3 flex items-center gap-3">
                <Avatar className="size-11">
                  <AvatarFallback className={cn("text-[12px]", instructor.avatarColor)}>
                    {instructor.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <Link href={`/instructors/${instructor.username}`} className="block truncate text-[14px] font-semibold hover:text-primary">
                    {instructor.name}
                  </Link>
                  <p className="truncate text-[12px] text-muted-foreground">{instructor.headline}</p>
                </div>
              </div>
              {stats && (
                <dl className="mt-4 grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg border border-border p-2.5">
                    <dd className="font-display text-[15px] font-bold tabular-nums">{stats.courses}</dd>
                    <dt className="text-[10.5px] text-muted-foreground">Courses</dt>
                  </div>
                  <div className="rounded-lg border border-border p-2.5">
                    <dd className="font-display text-[15px] font-bold tabular-nums">{stats.rating.toFixed(1)}</dd>
                    <dt className="text-[10.5px] text-muted-foreground">Rating</dt>
                  </div>
                </dl>
              )}
            </section>
          )}

          {/* Internal notes */}
          <section className="rounded-xl border border-border bg-white p-5 shadow-card">
            <h2 className="font-display text-[15.5px] font-semibold">Internal notes</h2>
            <p className="mt-1 flex items-start gap-1 text-[11.5px] text-zinc-400">
              <Info className="mt-0.5 size-3 shrink-0" aria-hidden />
              Visible to admins only (local demo).
            </p>
            <div className="mt-3 space-y-2.5">
              {notes.length === 0 ? (
                <p className="text-[12.5px] text-zinc-400">No notes yet for this course.</p>
              ) : (
                notes.slice(0, 4).map((n, i) => (
                  <div key={`${n.at}-${i}`} className="rounded-lg border border-border bg-muted/40 p-2.5">
                    <p className="text-[12.5px] leading-relaxed">{n.text}</p>
                    <p className="mt-1 text-[10.5px] text-zinc-400">
                      {n.author} · {formatDate(n.at)}
                    </p>
                  </div>
                ))
              )}
            </div>
            <div className="mt-3">
              <Textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Add an internal note…"
                className="min-h-16 text-[13px]"
                aria-label="Internal moderation note"
              />
              <Button size="sm" variant="outline" className="mt-2 w-full" onClick={saveNote}>
                <Send aria-hidden />
                Save note
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
