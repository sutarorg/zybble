"use client";

import { LocalizedText, useTranslate } from "@/components/providers/localized-text";
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
  CirclePlay,
  Eraser,
  Eye,
  FileDown,
  FileText,
  LayoutGrid,
  ListChecks,
  Layers3,
  PartyPopper,
  Save,
  Send,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import type { CourseDraft } from "@/types";
import { useCreator } from "@/components/providers/creator-provider";
import {
  CREATOR_STEPS,
  PLATFORM_COMMISSION,
  countResourceLessons,
  emptyCourseDraft,
  moneyExact,
  validateDraftStep,
} from "@/lib/creator";
import { getCategoryBySlug, LEVEL_LABELS } from "@/lib/courses";
import { formatDuration, formatPrice } from "@/lib/format";
import { lessonDurationLabel } from "@/lib/learn";
import { BasicsForm, OutcomesForm, PricingForm, ThumbnailPicker } from "@/components/creator/course-forms";
import { WizardStepper } from "@/components/creator/wizard-stepper";
import { CurriculumEditor } from "@/components/creator/curriculum-editor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const STEP_HELP: { title: string; text: string }[] = [
  { title: "Course basics", text: "The title and subtitle appear on course cards — make them specific and outcome-focused." },
  { title: "Outcomes & prerequisites", text: "Great outcomes start with verbs: build, automate, deploy, analyze." },
  { title: "Thumbnail", text: "A clean 16:9 image. Cards everywhere use the exact preview below." },
  { title: "Pricing", text: "Paid or free — you can change this any time before publishing." },
  { title: "Content", text: "Sections group lessons into milestones. Videos, quizzes and resource files live here." },
  { title: "Course preview", text: "Review everything exactly as learners will see it before submitting." },
  { title: "Submit for review", text: "Simulated submission — transitions this course to Pending Review." },
];

export default function NewCoursePage() {
  const router = useRouter();
  const { hydrated, draft: savedDraft, saveDraft, addCourse, submitForReview } = useCreator();

  /* Derived draft: the autosaved draft from storage (once hydrated), else a fresh one. */
  const freshDraft = React.useMemo(() => emptyCourseDraft(), []);
  const restoredDraft = hydrated ? savedDraft : null;
  const [draftOverride, setDraftOverride] = useState<CourseDraft | null>(null);
  const draft = draftOverride ?? restoredDraft ?? freshDraft;
  const setDraft = (next: CourseDraft | ((prev: CourseDraft) => CourseDraft)) =>
    setDraftOverride((prev) => {
      const current = prev ?? restoredDraft ?? freshDraft;
      return typeof next === "function" ? next(current) : next;
    });
  const [step, setStep] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [dirty, setDirty] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const restoredNotice = React.useRef(false);

  /* Tell the creator once that the stored draft was restored (no state change). */
  useEffect(() => {
    if (hydrated && savedDraft && !restoredNotice.current) {
      restoredNotice.current = true;
      toast.info("Resumed your saved draft — autosave is on.");
    }
  }, [hydrated, savedDraft]);

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
        <h1 className="font-display mt-5 text-2xl font-bold tracking-tight"><LocalizedText text={"Submitted for review"} /></h1>
        <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-muted-foreground">
          “<LocalizedText text={draft.title} /><LocalizedText text={"” is now"} /><span className="font-medium text-foreground"><LocalizedText text={"Pending Review"} /></span><LocalizedText text={"in this local simulation. Track its status and mock review notes from the publish page."} /></p>
        <div className="mt-7 flex flex-col justify-center gap-2 sm:flex-row">
          <Button asChild size="lg">
            <Link href={`/creator/courses/${submittedId}/publish`}>
              <Send aria-hidden /><LocalizedText text={"Open publish page"} /></Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/creator/courses"><LocalizedText text={"Back to My Courses"} /></Link>
          </Button>
        </div>
        <button
          type="button"
          onClick={startFresh}
          className="mt-5 cursor-pointer text-[13px] font-medium text-primary hover:underline"
        ><LocalizedText text={"Create another course"} /></button>
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
              <ArrowLeft aria-hidden /><LocalizedText text={"My Courses"} /></Link>
          </Button>
          <h1 className="font-display mt-1 text-[24px] font-bold tracking-tight"><LocalizedText text={"Create course"} /></h1>
          <p className="mt-1 text-[13px] text-muted-foreground"><LocalizedText text={"Drafts autosave to this browser. Nothing is published until you submit."} /></p>
        </div>
        <div className="flex items-center gap-2">
          {dirty ? (
            <span className="flex items-center gap-1.5 text-[12px] font-medium text-amber-600">
              <Save className="size-3.5" aria-hidden /><LocalizedText text={"Unsaved changes"} /></span>
          ) : lastSaved ? (
            <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <CircleCheck className="size-3.5 text-emerald-500" aria-hidden /><LocalizedText text={"Draft saved"} /><LocalizedText text={" "} />
              <LocalizedText text={lastSaved.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })} />
            </span>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => { saveDraft(draft); setLastSaved(new Date()); setDirty(false); toast.success("Draft saved"); }}>
            <Save aria-hidden /><LocalizedText text={"Save draft"} /></Button>
          <Button variant="ghost" size="sm" onClick={startFresh}>
            <Eraser aria-hidden /><LocalizedText text={"Start fresh"} /></Button>
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
                {step + 1}. <LocalizedText text={STEP_HELP[step].title} />
              </h2>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground"><LocalizedText text={STEP_HELP[step].text} /></p>
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
                      <LocalizedText text={errors.sections} />
                    </p>
                  )}
                </div>
              )}
              {step === 5 && (
                <PreviewStep draft={draft} category={category?.name} lessonsCount={lessonsCount} />
              )}
              {step === 6 && (
                <SubmitStep draft={draft} lessonsCount={lessonsCount} />
              )}
            </div>
          </div>

          {/* Footer controls */}
          <div className="mt-4 flex items-center justify-between">
            <Button variant="outline" onClick={goBack} disabled={step === 0}>
              <ArrowLeft aria-hidden /><LocalizedText text={"Back"} /></Button>
            {step < CREATOR_STEPS.length - 1 ? (
              <Button onClick={goContinue}><LocalizedText text={"Continue"} /><ArrowRight aria-hidden />
              </Button>
            ) : (
              <Button onClick={submit} size="lg">
                <Send aria-hidden /><LocalizedText text={"Submit for review"} /></Button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

/* --------------------------------- Step 6 ---------------------------------- */

const PREVIEW_TABS = [
  { id: "landing", label: "Landing page", icon: LayoutGrid },
  { id: "curriculum", label: "Curriculum", icon: Layers3 },
  { id: "card", label: "Course card", icon: Eye },
] as const;

const LESSON_PREVIEW_ICON = { video: CirclePlay, reading: FileText, quiz: ListChecks, resource: FileDown } as const;

/**
 * Live preview of the finished course. Three views — the marketplace card, the
 * public landing page and the curriculum — all rendered from the same draft,
 * so creators can sanity-check copy, pricing and structure before submitting.
 */
function PreviewStep({
  draft,
  category,
  lessonsCount,
}: {
  draft: CourseDraft;
  category?: string;
  lessonsCount: number;
}) {
  const translateUi = useTranslate();
  const [view, setView] = useState<(typeof PREVIEW_TABS)[number]["id"]>("landing");
  const outcomes = draft.outcomes.map((o) => o.trim()).filter(Boolean);
  const requirements = draft.requirements.map((r) => r.trim()).filter(Boolean);
  const resourceCount = countResourceLessons(draft.sections);
  const totalMinutes = draft.sections.reduce(
    (n, s) => n + s.lessons.reduce((m, l) => m + l.durationMinutes, 0),
    0
  );
  const priceLabel = draft.isFree ? "Free" : formatPrice(draft.price);
  const netPerSale = moneyExact(Math.round(draft.price * (1 - PLATFORM_COMMISSION) * 100) / 100);

  const stats = [
    { icon: Layers3, label: "Sections", value: String(draft.sections.length) },
    { icon: CirclePlay, label: "Lessons", value: String(lessonsCount) },
    { icon: FileDown, label: "Resources", value: String(resourceCount) },
    { icon: Star, label: "Price", value: priceLabel },
  ];

  return (
    <div className="space-y-4">
      {/* View switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-border bg-muted/50 p-1">
          {PREVIEW_TABS.map((tab) => {
            const active = view === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-pressed={active}
                onClick={() => setView(tab.id)}
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-all",
                  active ? "bg-white text-primary shadow-card" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <tab.icon className="size-3.5" aria-hidden />
                <LocalizedText text={tab.label} />
              </button>
            );
          })}
        </div>
        <p className="flex items-center gap-1.5 text-[12px] text-zinc-500">
          <Sparkles className="size-3.5 text-primary" aria-hidden />
          <LocalizedText text={"This is exactly what learners will see."} />
        </p>
      </div>

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_290px]">
        {/* ------------------------------ Preview canvas ----------------------------- */}
        <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-white shadow-card">
          {/* Browser-ish chrome so the preview reads as a real page */}
          <div className="flex items-center gap-2 border-b border-border bg-muted/60 px-4 py-2.5">
            <span className="flex gap-1.5" aria-hidden>
              <span className="size-2.5 rounded-full bg-red-300" />
              <span className="size-2.5 rounded-full bg-amber-300" />
              <span className="size-2.5 rounded-full bg-emerald-300" />
            </span>
            <span className="mx-auto flex items-center gap-1.5 rounded-md bg-white px-3 py-1 text-[11px] text-zinc-400 ring-1 ring-border">
              zybble.com/courses/<LocalizedText text={draft.title ? draft.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) : "your-course"} />
            </span>
          </div>

          {view === "card" ? (
            <div className="flex items-center justify-center bg-gradient-to-br from-muted/60 to-white p-8">
              <div className="w-full max-w-xs overflow-hidden rounded-xl border border-border bg-white shadow-card-hover">
                <div className="relative aspect-video w-full bg-muted">
                  {draft.thumbnail && (
                    <Image src={draft.thumbnail} alt={translateUi("Course thumbnail preview")} fill sizes="320px" className="object-cover" />
                  )}
                </div>
                <div className="p-3.5">
                  {category && <Badge variant="violet" className="mb-2"><LocalizedText text={category} /></Badge>}
                  <p className="font-display line-clamp-2 text-[14px] font-semibold tracking-tight">
                    <LocalizedText text={draft.title || "Untitled course"} />
                  </p>
                  <p className="mt-1 line-clamp-2 text-[12px] text-muted-foreground"><LocalizedText text={draft.subtitle} /></p>
                  <p className="mt-2 font-display text-[14px] font-bold">
                    {draft.isFree ? <span className="text-success"><LocalizedText text={"Free"} /></span> : priceLabel}
                  </p>
                </div>
              </div>
            </div>
          ) : view === "curriculum" ? (
            <div className="max-h-[540px] overflow-y-auto scrollbar-thin p-5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted-foreground">
                <span><span className="font-semibold text-foreground">{draft.sections.length}</span><LocalizedText text={" sections"} /></span>
                <span aria-hidden>·</span>
                <span><span className="font-semibold text-foreground">{lessonsCount}</span><LocalizedText text={" lessons"} /></span>
                <span aria-hidden>·</span>
                <span><span className="font-semibold text-foreground">{formatDuration(totalMinutes)}</span><LocalizedText text={" of video"} /></span>
              </div>
              <ol className="mt-4 space-y-2.5">
                {draft.sections.length === 0 && (
                  <li className="rounded-xl border border-dashed border-zinc-300 bg-muted/40 px-4 py-8 text-center text-[13px] text-muted-foreground">
                    <LocalizedText text={"No sections yet — add them in the Content step."} />
                  </li>
                )}
                {draft.sections.map((section, si) => (
                  <li key={section.id} className="overflow-hidden rounded-xl border border-border">
                    <div className="flex items-center justify-between gap-3 bg-muted/50 px-3.5 py-2.5">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span className="text-[11px] font-bold text-zinc-400 tabular-nums">
                          <LocalizedText text={String(si + 1).padStart(2, "0")} />
                        </span>
                        <span className="truncate text-[13px] font-semibold"><LocalizedText text={section.title} /></span>
                      </span>
                      <span className="shrink-0 text-[11.5px] text-zinc-400">
                        {section.lessons.length}<LocalizedText text={" lessons"} />
                      </span>
                    </div>
                    {section.lessons.length > 0 && (
                      <ul className="divide-y divide-border">
                        {section.lessons.map((lesson) => {
                          const Icon = LESSON_PREVIEW_ICON[lesson.type];
                          return (
                            <li key={lesson.id} className="flex items-center gap-3 px-3.5 py-2.5">
                              <Icon className="size-4 shrink-0 text-zinc-400" aria-hidden />
                              <span className="min-w-0 flex-1 truncate text-[13px]"><LocalizedText text={lesson.title} /></span>
                              <span className="shrink-0 text-[11.5px] text-zinc-400"><LocalizedText text={lessonDurationLabel(lesson)} /></span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            /* ---------------------------- Landing page view --------------------------- */
            <div className="max-h-[540px] overflow-y-auto scrollbar-thin">
              <div className="relative">
                <div className="relative h-40 w-full bg-muted">
                  {draft.thumbnail && (
                    <Image src={draft.thumbnail} alt={translateUi("Course thumbnail preview")} fill sizes="800px" className="object-cover" />
                  )}
                  <span className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-zinc-950/30 to-transparent" aria-hidden />
                  <div className="absolute inset-x-0 bottom-0 p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      {category && <Badge variant="violet"><LocalizedText text={category} /></Badge>}
                      <Badge variant="emerald"><LocalizedText text={LEVEL_LABELS[draft.level]} /></Badge>
                    </div>
                    <h3 className="font-display mt-2 line-clamp-2 text-[20px] leading-tight font-bold tracking-tight text-white">
                      <LocalizedText text={draft.title || "Untitled course"} />
                    </h3>
                  </div>
                </div>

                <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_220px]">
                  <div className="min-w-0">
                    <p className="text-[14px] leading-relaxed text-muted-foreground">
                      <LocalizedText text={draft.subtitle || "Add a subtitle to summarize the course in one line."} />
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-muted-foreground">
                      <span className="flex items-center gap-1.5"><Star className="size-3.5 fill-star text-star" aria-hidden /><LocalizedText text={"New · no ratings yet"} /></span>
                      <span className="flex items-center gap-1.5"><CirclePlay className="size-3.5" aria-hidden />{lessonsCount}<LocalizedText text={" lessons"} /></span>
                      <span className="flex items-center gap-1.5"><FileDown className="size-3.5" aria-hidden />{resourceCount}<LocalizedText text={" downloads"} /></span>
                      <span className="flex items-center gap-1.5"><Users className="size-3.5" aria-hidden />{draft.language}</span>
                    </div>

                    {outcomes.length > 0 && (
                      <section className="mt-5">
                        <h4 className="font-display text-[14px] font-semibold"><LocalizedText text={"What you'll learn"} /></h4>
                        <ul className="mt-2.5 grid gap-2 sm:grid-cols-2">
                          {outcomes.map((o) => (
                            <li key={o} className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-[12.5px]">
                              <Check className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                              <LocalizedText text={o} />
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}

                    <section className="mt-5">
                      <h4 className="font-display text-[14px] font-semibold"><LocalizedText text={"Course content"} /></h4>
                      <ul className="mt-2.5 space-y-1.5">
                        {draft.sections.map((section, si) => (
                          <li key={section.id} className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2 text-[12.5px]">
                            <span className="truncate"><span className="mr-2 text-zinc-400 tabular-nums"><LocalizedText text={String(si + 1).padStart(2, "0")} /></span><LocalizedText text={section.title} /></span>
                            <span className="shrink-0 text-zinc-400">{section.lessons.length}<LocalizedText text={" lessons"} /></span>
                          </li>
                        ))}
                      </ul>
                    </section>

                    {requirements.length > 0 && (
                      <section className="mt-5">
                        <h4 className="font-display text-[14px] font-semibold"><LocalizedText text={"Requirements"} /></h4>
                        <ul className="mt-2.5 list-disc space-y-1 pl-5 text-[12.5px] text-muted-foreground">
                          {requirements.map((r) => (
                            <li key={r}><LocalizedText text={r} /></li>
                          ))}
                        </ul>
                      </section>
                    )}
                  </div>

                  {/* Enroll card mock */}
                  <aside className="lg:sticky lg:top-0 lg:self-start">
                    <div className="rounded-xl border border-border bg-white p-4 shadow-card-hover">
                      <p className="font-display text-[22px] font-bold">{priceLabel}</p>
                      {!draft.isFree && draft.compareAtPrice ? (
                        <p className="text-[12.5px] text-zinc-400 line-through">{formatPrice(draft.compareAtPrice)}</p>
                      ) : null}
                      <button type="button" disabled className="mt-3 w-full cursor-default rounded-lg bg-primary py-2.5 text-[13px] font-semibold text-white opacity-90">
                        <LocalizedText text={"Enroll now"} />
                      </button>
                      <p className="mt-2 text-center text-[11px] text-zinc-400"><LocalizedText text={"Preview button — nothing happens here."} /></p>
                      <ul className="mt-3 space-y-1.5 border-t border-border pt-3 text-[11.5px] text-muted-foreground">
                        <li><LocalizedText text={`${lessonsCount} lessons · ${formatDuration(totalMinutes)}`} /></li>
                        <li><LocalizedText text={`${draft.sections.length} sections · ${resourceCount} downloadable resources`} /></li>
                        <li><LocalizedText text={`${draft.language} · lifetime access`} /></li>
                      </ul>
                    </div>
                  </aside>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* -------------------------------- Summary rail -------------------------------- */}
        <aside className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-xl border border-border bg-white p-3 shadow-card">
                <stat.icon className="size-4 text-primary" aria-hidden />
                <p className="font-display mt-2 text-[17px] font-bold tracking-tight">{stat.value}</p>
                <p className="text-[11px] text-muted-foreground"><LocalizedText text={stat.label} /></p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-border bg-white p-4 shadow-card">
            <p className="text-[11px] font-bold tracking-[0.1em] text-zinc-400 uppercase"><LocalizedText text={"At a glance"} /></p>
            <dl className="mt-2.5 space-y-2 text-[12.5px]">
              {[
                { label: "Level", value: LEVEL_LABELS[draft.level] },
                { label: "Language", value: draft.language },
                { label: "Video length", value: formatDuration(totalMinutes) },
                { label: "Audience", value: draft.audience.filter((a) => a.trim()).length ? `${draft.audience.filter((a) => a.trim()).length} groups` : "—" },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground"><LocalizedText text={row.label} /></dt>
                  <dd className="font-medium"><LocalizedText text={row.value} /></dd>
                </div>
              ))}
            </dl>
          </div>

          {!draft.isFree && (
            <div className="rounded-xl border border-violet-200 bg-accent p-4">
              <p className="text-[11px] font-bold tracking-[0.1em] text-accent-foreground uppercase"><LocalizedText text={"You keep per sale"} /></p>
              <p className="font-display mt-1.5 text-[20px] font-bold text-violet-950">{netPerSale}</p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-violet-950/60">
                <LocalizedText text={"After the 10% Zybble commission. Before fees and taxes."} />
              </p>
            </div>
          )}

          <div className="rounded-xl border border-border bg-muted/40 p-4 text-[11.5px] leading-relaxed text-zinc-500">
            <LocalizedText text={"Everything on this page is a live preview of your draft. Nothing is published until you submit for review."} />
          </div>
        </aside>
      </div>
    </div>
  );
}

/* --------------------------------- Step 7 ---------------------------------- */

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
          <FileDown className="size-4 text-primary" aria-hidden /><LocalizedText text={"Pre-submission checklist"} /></h3>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
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
      </div>
      <div className="rounded-xl border border-violet-200 bg-accent p-5 text-[13px] leading-relaxed text-violet-950/70">
        <p className="font-semibold text-violet-950"><LocalizedText text={"What happens next (simulated)"} /></p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li><LocalizedText text={"Your course moves to"} /><strong><LocalizedText text={"Pending Review"} /></strong><LocalizedText text={"in the review queue."} /></li>
          <li><LocalizedText text={"A mock review history appears on the publish page."} /></li>
          <li><LocalizedText text={"You can withdraw the submission any time to keep editing."} /></li>
          <li><LocalizedText text={"No real Zybble administrator reviews anything — this is a local preview."} /></li>
        </ul>
        {!allOk && (
          <p className="mt-3 font-medium text-amber-700"><LocalizedText text={"Some checklist items are incomplete — you can still submit, but fix them for a smooth review."} /></p>
        )}
      </div>
    </div>
  );
}
