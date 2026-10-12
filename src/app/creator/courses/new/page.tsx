"use client";

import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleCheck,
  Eraser,
  FileDown,
  Info,
  PartyPopper,
  Save,
  Send,
} from "lucide-react";
import type { CourseDraft } from "@/types";
import { useCreator } from "@/components/providers/creator-provider";
import {
  CREATOR_STEPS,
  PLATFORM_COMMISSION,
  emptyCourseDraft,
  moneyExact,
  validateDraftStep,
} from "@/lib/creator";
import { getCategoryBySlug, LEVEL_LABELS } from "@/lib/courses";
import { formatPrice } from "@/lib/format";
import { BasicsForm, OutcomesForm, PricingForm, ThumbnailPicker } from "@/components/creator/course-forms";
import { WizardStepper } from "@/components/creator/wizard-stepper";
import { CurriculumEditor } from "@/components/creator/curriculum-editor";
import { ResourceManager, UploadSlot } from "@/components/creator/resource-manager";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const STEP_HELP: { title: string; text: string }[] = [
  { title: "Course basics", text: "The title and subtitle appear on course cards — make them specific and outcome-focused." },
  { title: "Outcomes & prerequisites", text: "Great outcomes start with verbs: build, automate, deploy, analyze." },
  { title: "Thumbnail", text: "A clean 16:9 image. Cards everywhere use the exact preview below." },
  { title: "Pricing", text: "Paid or free — you can change this any time before publishing." },
  { title: "Curriculum", text: "Sections group lessons into milestones. 4–6 sections is a proven structure." },
  { title: "Course content", text: "Attach videos and downloadable resources. Local preview only in this demo." },
  { title: "Course preview", text: "Review everything as learners will see it before submitting." },
  { title: "Submit for review", text: "Simulated submission — transitions this course to Pending Review." },
];

export default function NewCoursePage() {
  const router = useRouter();
  const { hydrated, draft: savedDraft, saveDraft, addCourse, submitForReview } = useCreator();

  const [draft, setDraft] = useState<CourseDraft>(emptyCourseDraft());
  const [resumed, setResumed] = useState(false);
  const [step, setStep] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [dirty, setDirty] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  /* Restore wizard draft from storage */
  useEffect(() => {
    if (hydrated && savedDraft && !resumed) {
      setDraft(savedDraft);
      setResumed(true);
      toast.info("Resumed your saved draft — autosave is on.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  /* Autosave (debounced) */
  useEffect(() => {
    if (!dirty || submittedId) return;
    const t = setTimeout(() => {
      saveDraft(draft);
      setLastSaved(new Date());
      setDirty(false);
    }, 900);
    return () => clearTimeout(t);
  }, [draft, dirty, saveDraft, submittedId]);

  /* Warn about leaving with unsaved changes */
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const update = (patch: Partial<CourseDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setDirty(true);
  };

  const stepValid = (i: number) => Object.keys(validateDraftStep(i, draft)).length === 0;

  const goContinue = () => {
    const errs = validateDraftStep(step, draft);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Please fix the highlighted fields.");
      return;
    }
    saveDraft(draft);
    setLastSaved(new Date());
    setDirty(false);
    const next = Math.min(step + 1, CREATOR_STEPS.length - 1);
    setStep(next);
    setMaxReached((m) => Math.max(m, next));
    setErrors({});
  };

  const goBack = () => {
    setErrors({});
    setStep((s) => Math.max(0, s - 1));
  };

  const startFresh = () => {
    setDraft(emptyCourseDraft());
    saveDraft(null);
    setStep(0);
    setMaxReached(0);
    setErrors({});
    toast.success("Started a fresh draft.");
  };

  const submit = () => {
    const course = addCourse(draft);
    submitForReview(course.id);
    saveDraft(null);
    setSubmittedId(course.id);
  };

  const lessonsCount = draft.sections.reduce((n, s) => n + s.lessons.length, 0);
  const category = draft.category ? getCategoryBySlug(draft.category) : undefined;

  if (!hydrated) {
    return (
      <div aria-busy>
        <Skeleton className="h-9 w-64" />
        <Skeleton className="mt-6 h-96 rounded-xl" />
      </div>
    );
  }

  /* ------------------------------ Success screen ----------------------------- */
  if (submittedId) {
    return (
      <div className="mx-auto max-w-xl py-10 text-center">
        <span className="relative mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-100">
          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-200/60" aria-hidden />
          <PartyPopper className="relative size-7 text-emerald-600" aria-hidden />
        </span>
        <h1 className="font-display mt-5 text-2xl font-bold tracking-tight">Submitted for review</h1>
        <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-muted-foreground">
          “{draft.title}” is now <span className="font-medium text-foreground">Pending Review</span> in
          this local simulation. Track its status and mock review notes from the publish page.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-2 sm:flex-row">
          <Button asChild size="lg">
            <Link href={`/creator/courses/${submittedId}/publish`}>
              <Send aria-hidden />
              Open publish page
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/creator/courses">Back to My Courses</Link>
          </Button>
        </div>
        <button
          type="button"
          onClick={startFresh}
          className="mt-5 cursor-pointer text-[13px] font-medium text-primary hover:underline"
        >
          Create another course
        </button>
      </div>
    );
  }

  /* --------------------------------- Wizard --------------------------------- */
  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href="/creator/courses">
              <ArrowLeft aria-hidden />
              My Courses
            </Link>
          </Button>
          <h1 className="font-display mt-1 text-[24px] font-bold tracking-tight">Create course</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Drafts autosave to this browser. Nothing is published until you submit.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirty ? (
            <span className="flex items-center gap-1.5 text-[12px] font-medium text-amber-600">
              <Save className="size-3.5" aria-hidden />
              Unsaved changes
            </span>
          ) : lastSaved ? (
            <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <CircleCheck className="size-3.5 text-emerald-500" aria-hidden />
              Draft saved{" "}
              {lastSaved.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
            </span>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => { saveDraft(draft); setLastSaved(new Date()); setDirty(false); toast.success("Draft saved"); }}>
            <Save aria-hidden />
            Save draft
          </Button>
          <Button variant="ghost" size="sm" onClick={startFresh}>
            <Eraser aria-hidden />
            Start fresh
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* Stepper */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-xl border border-border bg-white p-2 shadow-card">
            <WizardStepper
              current={step}
              maxReached={maxReached}
              onJump={(i) => {
                setErrors({});
                setStep(i);
              }}
              stepValid={stepValid}
            />
          </div>
        </aside>

        {/* Step content */}
        <section className="min-w-0">
          <div className="rounded-xl border border-border bg-white shadow-card">
            <div className="border-b border-border px-5 py-4 sm:px-6">
              <h2 className="font-display text-[16px] font-semibold">
                {step + 1}. {STEP_HELP[step].title}
              </h2>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">{STEP_HELP[step].text}</p>
            </div>

            <div className="p-5 sm:p-6">
              {step === 0 && <BasicsForm draft={draft} onChange={update} errors={errors} />}
              {step === 1 && <OutcomesForm draft={draft} onChange={update} errors={errors} />}
              {step === 2 && <ThumbnailPicker draft={draft} onChange={update} errors={errors} />}
              {step === 3 && <PricingForm draft={draft} onChange={update} errors={errors} />}
              {step === 4 && (
                <div>
                  <CurriculumEditor
                    sections={draft.sections}
                    onChange={(sections) => update({ sections })}
                  />
                  {errors.sections && (
                    <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] font-medium text-destructive">
                      {errors.sections}
                    </p>
                  )}
                </div>
              )}
              {step === 5 && (
                <ContentStep draft={draft} update={update} />
              )}
              {step === 6 && (
                <PreviewStep draft={draft} category={category?.name} lessonsCount={lessonsCount} />
              )}
              {step === 7 && (
                <SubmitStep draft={draft} lessonsCount={lessonsCount} />
              )}
            </div>
          </div>

          {/* Footer controls */}
          <div className="mt-4 flex items-center justify-between">
            <Button variant="outline" onClick={goBack} disabled={step === 0}>
              <ArrowLeft aria-hidden />
              Back
            </Button>
            {step < CREATOR_STEPS.length - 1 ? (
              <Button onClick={goContinue}>
                Continue
                <ArrowRight aria-hidden />
              </Button>
            ) : (
              <Button onClick={submit} size="lg">
                <Send aria-hidden />
                Submit for review
              </Button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

/* --------------------------------- Step 6 ---------------------------------- */

function ContentStep({ draft, update }: { draft: CourseDraft; update: (p: Partial<CourseDraft>) => void }) {
  const [uploads, setUploads] = useState<{ fileName: string; fileSize: number; kind: "video" | "resource" }[]>([]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 text-[13.5px] font-semibold">Lesson videos</h3>
        <UploadSlot
          title="Select lesson videos"
          uploads={uploads}
          onChange={setUploads}
        />
        <p className="mt-2 flex items-start gap-1.5 text-[12px] leading-relaxed text-zinc-400">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Files stay on this device and are only listed here. Persistent upload and transcoding
          are not connected in this demo.
        </p>
      </div>
      <div>
        <h3 className="mb-2 text-[13.5px] font-semibold">Downloadable resources</h3>
        <ResourceManager
          resources={draft.draftResources}
          onChange={(draftResources) => update({ draftResources })}
        />
      </div>
    </div>
  );
}

/* --------------------------------- Step 7 ---------------------------------- */

function PreviewStep({
  draft,
  category,
  lessonsCount,
}: {
  draft: CourseDraft;
  category?: string;
  lessonsCount: number;
}) {
  const outcomes = draft.outcomes.map((o) => o.trim()).filter(Boolean);
  return (
    <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
      {/* Card preview */}
      <div>
        <p className="mb-2 text-[11px] font-bold tracking-[0.1em] text-zinc-400 uppercase">
          Course card (16:9)
        </p>
        <div className="overflow-hidden rounded-xl border border-border bg-white shadow-card">
          <div className="relative aspect-video w-full bg-muted">
            {draft.thumbnail && (
              <Image src={draft.thumbnail} alt="" fill sizes="300px" className="object-cover" />
            )}
          </div>
          <div className="p-3.5">
            {category && <Badge variant="solid_white" className="mb-2 border">{category}</Badge>}
            <p className="font-display line-clamp-2 text-[14px] font-semibold tracking-tight">
              {draft.title || "Untitled course"}
            </p>
            <p className="mt-1 line-clamp-2 text-[12px] text-muted-foreground">{draft.subtitle}</p>
            <p className="mt-2 font-display text-[14px] font-bold">
              {draft.isFree ? <span className="text-success">Free</span> : formatPrice(draft.price)}
            </p>
          </div>
        </div>
      </div>

      {/* Detail summary */}
      <dl className="space-y-3">
        {[
          { label: "Level & language", value: `${LEVEL_LABELS[draft.level]} · ${draft.language}` },
          { label: "Curriculum", value: `${draft.sections.length} sections · ${lessonsCount} lessons` },
          { label: "Resources", value: `${draft.draftResources.length} downloadable files` },
          {
            label: "Pricing",
            value: draft.isFree
              ? "Free"
              : `${formatPrice(draft.price)}${draft.compareAtPrice ? ` (compare at ${formatPrice(draft.compareAtPrice)})` : ""} — you keep ${moneyExact(Math.round(draft.price * (1 - PLATFORM_COMMISSION) * 100) / 100)}`,
          },
          { label: "AI Tutor", value: draft.hasAiTutor ? "Included" : "Not included" },
        ].map((row) => (
          <div key={row.label} className="flex flex-col gap-0.5 rounded-lg border border-border bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <dt className="text-[12px] font-semibold tracking-wide text-zinc-400 uppercase">{row.label}</dt>
            <dd className="text-[13.5px] font-medium">{row.value}</dd>
          </div>
        ))}
        {outcomes.length > 0 && (
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
            <dt className="text-[12px] font-semibold tracking-wide text-zinc-400 uppercase">Outcomes</dt>
            <dd className="mt-2 space-y-1.5">
              {outcomes.map((o) => (
                <p key={o} className="flex items-start gap-2 text-[13px]">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                  {o}
                </p>
              ))}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

/* --------------------------------- Step 8 ---------------------------------- */

function SubmitStep({ draft, lessonsCount }: { draft: CourseDraft; lessonsCount: number }) {
  const checks = [
    { label: "Title, subtitle and description", ok: draft.title.trim().length >= 4 && draft.subtitle.trim().length > 0 && draft.description.trim().length >= 40 },
    { label: "Category selected", ok: !!draft.category },
    { label: "At least 2 learning outcomes", ok: draft.outcomes.filter((o) => o.trim()).length >= 2 },
    { label: "Thumbnail chosen", ok: !!draft.thumbnail },
    { label: draft.isFree ? "Free course" : "Valid price", ok: draft.isFree || draft.price >= 4.99 },
    { label: "Curriculum has content", ok: lessonsCount > 0 },
  ];
  const allOk = checks.every((c) => c.ok);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-muted/40 p-5">
        <h3 className="flex items-center gap-2 text-[14px] font-semibold">
          <FileDown className="size-4 text-primary" aria-hidden />
          Pre-submission checklist
        </h3>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {checks.map((c) => (
            <li key={c.label} className="flex items-center gap-2 text-[13px]">
              {c.ok ? (
                <CircleCheck className="size-4 shrink-0 text-emerald-500" aria-hidden />
              ) : (
                <span className="size-4 shrink-0 rounded-full border-2 border-amber-400" aria-hidden />
              )}
              <span className={cn(!c.ok && "text-amber-700")}>{c.label}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-xl border border-violet-200 bg-accent p-5 text-[13px] leading-relaxed text-violet-950/70">
        <p className="font-semibold text-violet-950">What happens next (simulated)</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Your course moves to <strong>Pending Review</strong> in the review queue.</li>
          <li>A mock review history appears on the publish page.</li>
          <li>You can withdraw the submission any time to keep editing.</li>
          <li>No real Zybble administrator reviews anything — this is a local demo.</li>
        </ul>
        {!allOk && (
          <p className="mt-3 font-medium text-amber-700">
            Some checklist items are incomplete — you can still submit, but fix them for a smooth review.
          </p>
        )}
      </div>
    </div>
  );
}
