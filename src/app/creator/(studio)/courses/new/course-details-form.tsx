"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Check,
  Eye,
  Image as ImageIcon,
  Layers,
  Plus,
  Target,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CATEGORIES, TEACHING_LANGUAGES } from "@/lib/config/catalog";
import { saveCourse } from "@/app/creator/actions";
import { inrPriceInputSchema, formatInr } from "@/lib/money";
import { ThumbnailUpload, uploadThumbnail } from "@/components/creator/thumbnail-upload";
import { imagePath } from "@/lib/image-path";
import { CourseCard } from "@/components/courses/course-card";
import type { Course } from "@/types";
import { cn } from "@/lib/utils";

export interface CourseDetailsInitial {
  id?: string;
  thumbnailKey?: string | null;
  title: string;
  subtitle: string;
  description: string;
  categorySlug: string;
  level: "beginner" | "intermediate" | "advanced";
  language: string;
  priceRupees: string;
  compareAtRupees: string;
  whatYouLearn: string[];
  requirements: string[];
  audience: string[];
}

export interface CreatorPreviewIdentity {
  name: string;
  initials: string;
  headline?: string | null;
  avatarKey?: string | null;
}

interface CourseDetailsFormProps {
  initial?: CourseDetailsInitial;
  locked?: boolean;
  submitLabel?: string;
  instructor?: CreatorPreviewIdentity;
}

const EMPTY_INITIAL: CourseDetailsInitial = {
  title: "",
  subtitle: "",
  description: "",
  categorySlug: "",
  level: "beginner",
  language: "English",
  priceRupees: "0",
  compareAtRupees: "",
  whatYouLearn: [""],
  requirements: [""],
  audience: [""],
  thumbnailKey: null,
};

export function CourseDetailsForm({
  initial,
  locked = false,
  submitLabel = "Save course",
  instructor,
}: CourseDetailsFormProps) {
  const router = useRouter();
  const [form, setForm] = React.useState<CourseDetailsInitial>(
    () => initial ?? EMPTY_INITIAL
  );
  const [pricingMode] = React.useState<"free" | "paid">(() => {
    const parsed = inrPriceInputSchema.safeParse(
      (initial?.priceRupees ?? "0").trim() || "0"
    );
    return parsed.success && parsed.data > 0 ? "paid" : "free";
  });
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [savedNotice, setSavedNotice] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const thumbnailFile = React.useRef<File | null>(null);
  const [liveThumbnailUrl, setLiveThumbnailUrl] = React.useState<string | null>(() =>
    initial?.thumbnailKey ? imagePath("thumbnails", initial.thumbnailKey) : null
  );

  function set<K extends keyof CourseDetailsInitial>(key: K, value: CourseDetailsInitial[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSavedNotice(null);
    if (fieldErrors[key as string]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key as string];
        return next;
      });
    }
  }

  async function saveAndNavigate(goToCurriculumAfterSave: boolean) {
    if (locked || busy) return;
    setError(null);
    setSavedNotice(null);

    const payloadToValidate: CourseDetailsInitial = {
      ...form,
      priceRupees: pricingMode === "free" ? "0" : form.priceRupees,
      compareAtRupees: pricingMode === "free" ? "" : form.compareAtRupees,
    };

    const errors = validateDetails(payloadToValidate);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError("Please review the highlighted fields before saving.");
      document.getElementById(`cd-${Object.keys(errors)[0] === "categorySlug" ? "category" : Object.keys(errors)[0]}`)?.focus();
      return;
    }

    setBusy(true);
    try {
      const result = await saveCourse({
        id: form.id,
        title: form.title,
        subtitle: form.subtitle,
        description: form.description,
        categorySlug: form.categorySlug,
        level: form.level,
        language: form.language,
        priceRupees: pricingMode === "free" ? "0" : form.priceRupees,
        compareAtRupees:
          pricingMode === "paid" && form.compareAtRupees.trim()
            ? form.compareAtRupees.trim()
            : undefined,
        whatYouLearn: form.whatYouLearn.map((s) => s.trim()).filter(Boolean),
        requirements: form.requirements.map((s) => s.trim()).filter(Boolean),
        audience: form.audience.map((s) => s.trim()).filter(Boolean),
      });

      if (!result.ok) {
        setError(result.error ?? "Could not save course");
        return;
      }

      const courseId = result.id ?? form.id;
      if (!courseId) {
        setError("The course could not be opened. Please try saving again.");
        return;
      }

      // Keep the saved draft ID even if the optional cover upload fails, so a
      // retry updates this draft rather than creating a second course.
      setForm((previous) => ({ ...previous, id: courseId }));
      if (thumbnailFile.current) {
        try {
          const upload = await uploadThumbnail(courseId, thumbnailFile.current);
          if (upload.ok) thumbnailFile.current = null;
          else toast.warning("Course saved. Add your thumbnail again in Details.");
        } catch {
          toast.warning("Course saved. Add your thumbnail again in Details.");
        }
      }

      if (goToCurriculumAfterSave || !initial?.id) {
        router.push(`/creator/courses/${courseId}/curriculum`);
        return;
      }

      setSavedNotice("Course details saved.");
      router.refresh();
    } catch {
      setError("Could not save the course. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveAndNavigate(false);
  }

  const parsedPricePaise = React.useMemo(() => {
    if (pricingMode === "free") return 0;
    const res = inrPriceInputSchema.safeParse(form.priceRupees.trim() || "0");
    return res.success ? res.data : 0;
  }, [pricingMode, form.priceRupees]);

  const parsedComparePaise = React.useMemo(() => {
    if (pricingMode === "free" || !form.compareAtRupees.trim()) return null;
    const res = inrPriceInputSchema.safeParse(form.compareAtRupees.trim());
    return res.success && res.data > parsedPricePaise ? res.data : null;
  }, [pricingMode, form.compareAtRupees, parsedPricePaise]);

  const previewCourse: Course = {
    id: form.id ?? "draft-preview",
    slug: "draft-preview",
    title: form.title.trim() || "Your course title",
    subtitle: form.subtitle.trim() || "Your short course description",
    description: form.description,
    longDescription: [],
    category: (form.categorySlug || "development") as Course["category"],
    instructorId: "preview-instructor",
    instructor: {
      id: "preview-instructor", username: "creator",
      name: instructor?.name || "Your name",
      initials: instructor?.initials || "CR",
      headline: instructor?.headline || "", bio: "",
      avatarColor: "bg-violet-100 text-violet-700",
      country: "IN", languages: [form.language],
    },
    thumbnail: liveThumbnailUrl || "/images/courses/course-placeholder.svg",
    pricePaise: parsedPricePaise,
    compareAtPaise: parsedComparePaise,
    rating: 0, ratingsCount: 0, studentsCount: 0,
    level: form.level, language: form.language as Course["language"],
    captions: [], durationMinutes: 0, lessonsCount: 0,
    downloadableResources: 0, lastUpdated: "", createdAt: "",
    whatYouLearn: form.whatYouLearn.filter((item) => item.trim()),
    curriculum: [], requirements: form.requirements, audience: form.audience, tags: [],
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-600" aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      {savedNotice ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-800"
        >
          <span className="inline-flex items-center gap-2 font-medium">
            <Check className="size-4 text-emerald-600" aria-hidden="true" />
            {savedNotice}
          </span>
          {form.id ? (
            <Link
              href={`/creator/courses/${form.id}/curriculum`}
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary underline-offset-4 hover:underline"
            >
              Continue to Curriculum
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1fr_340px] xl:items-start">
        {/* Left column: form sections */}
        <div className="space-y-5">
          {/* Section 1: About this course */}
          <section className="rounded-2xl border border-border bg-white p-5 shadow-card sm:p-6">
            <SectionHeading
              icon={<BookOpen className="size-4" aria-hidden="true" />}
              tint="bg-accent text-primary"
              title="About this course"
            />

            <div className="mt-5 space-y-4">
              <Field
                id="cd-title"
                label="Course title"
                required
                error={fieldErrors.title}
                hint={`${form.title.length}/140`}
              >
                <Input
                  id="cd-title"
                  required
                  disabled={locked}
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  maxLength={140}
                  aria-invalid={Boolean(fieldErrors.title)}
                  aria-describedby={fieldErrors.title ? "cd-title-error" : "cd-title-help"}
                  placeholder="e.g. Production AI Agents with LangGraph"
                />
              </Field>

              <Field
                id="cd-subtitle"
                label="Short description"
                error={fieldErrors.subtitle}
                hint={`${form.subtitle.length}/180`}
              >
                <Input
                  id="cd-subtitle"
                  disabled={locked}
                  value={form.subtitle}
                  onChange={(e) => set("subtitle", e.target.value)}
                  maxLength={180}
                  aria-invalid={Boolean(fieldErrors.subtitle)}
                  placeholder="A one-line summary of the outcome learners get"
                />
              </Field>

              <Field
                id="cd-description"
                label="Full description"
                required
                error={fieldErrors.description}
                hint={`${form.description.length}/6,000`}
              >
                <Textarea
                  id="cd-description"
                  rows={4}
                  disabled={locked}
                  maxLength={6000}
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  aria-invalid={Boolean(fieldErrors.description)}
                  aria-describedby={
                    fieldErrors.description ? "cd-description-error" : "cd-description-help"
                  }
                  placeholder="What will learners build, and how is the curriculum structured?"
                />
              </Field>
            </div>
          </section>

          {/* Section 2: Category, level and language */}
          <section className="rounded-2xl border border-border bg-white p-5 shadow-card sm:p-6">
            <SectionHeading
              icon={<Layers className="size-4" aria-hidden="true" />}
              tint="bg-sky-50 text-sky-700"
              title="Category, level & language"
            />

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <Field
                id="cd-category"
                label="Category"
                required
                error={fieldErrors.categorySlug}
              >
                <select
                  id="cd-category"
                  disabled={locked}
                  value={form.categorySlug}
                  onChange={(e) => set("categorySlug", e.target.value)}
                  aria-invalid={Boolean(fieldErrors.categorySlug)}
                  className="flex h-10 w-full rounded-lg border border-input bg-white px-3 text-[13.5px] text-foreground shadow-2xs outline-none focus:border-primary focus:ring-2 focus:ring-ring/20"
                >
                  <option value="">Choose…</option>
                  {CATEGORIES.map((category) => (
                    <option key={category.slug} value={category.slug}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field id="cd-level" label="Difficulty" required>
                <select
                  id="cd-level"
                  disabled={locked}
                  value={form.level}
                  onChange={(e) =>
                    set("level", e.target.value as CourseDetailsInitial["level"])
                  }
                  className="flex h-10 w-full rounded-lg border border-input bg-white px-3 text-[13.5px] text-foreground shadow-2xs outline-none focus:border-primary focus:ring-2 focus:ring-ring/20"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </Field>

              <Field
                id="cd-language"
                label="Taught in"
                required
                error={fieldErrors.language}
              >
                <select
                  id="cd-language"
                  disabled={locked}
                  value={form.language}
                  onChange={(e) => set("language", e.target.value)}
                  aria-invalid={Boolean(fieldErrors.language)}
                  className="flex h-10 w-full rounded-lg border border-input bg-white px-3 text-[13.5px] text-foreground shadow-2xs outline-none focus:border-primary focus:ring-2 focus:ring-ring/20"
                >
                  {TEACHING_LANGUAGES.map((language) => (
                    <option key={language} value={language}>
                      {language}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </section>

          {/* Section 3: Course Thumbnail */}
          <section className="rounded-2xl border border-border bg-white p-5 shadow-card sm:p-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <SectionHeading
                icon={<ImageIcon className="size-4" aria-hidden="true" />}
                tint="bg-amber-50 text-amber-700"
                title="Course thumbnail"
                hint="A 16:9 cover image for your catalog card."
              />
              {liveThumbnailUrl ? (
                <Badge variant="emerald">Uploaded</Badge>
              ) : (
                <Badge variant="amber">Required for review</Badge>
              )}
            </div>

            <ThumbnailUpload
              courseId={form.id}
              thumbnailKey={form.thumbnailKey ?? null}
              disabled={locked}
              onFile={(file) => {
                thumbnailFile.current = file;
              }}
              onPreviewChange={(url) => setLiveThumbnailUrl(url)}
            />
          </section>

          {/* Section 4: Learning outcomes, requirements & audience */}
          <section className="rounded-2xl border border-border bg-white p-5 shadow-card sm:p-6">
            <SectionHeading
              icon={<Target className="size-4" aria-hidden="true" />}
              tint="bg-emerald-50 text-emerald-700"
              title="Outcomes & audience"
              hint="Shown on your public course page."
            />

            <div className="mt-5 space-y-6">
              <ListEditor
                label="What learners will be able to do"
                items={form.whatYouLearn}
                disabled={locked}
                onChange={(items) => set("whatYouLearn", items)}
                placeholder="e.g. Build and deploy a multi-agent AI workflow"
                addLabel="Add outcome"
              />

              <div className="border-t border-border pt-5">
                <ListEditor
                  label="Prerequisites"
                  items={form.requirements}
                  disabled={locked}
                  onChange={(items) => set("requirements", items)}
                  placeholder="e.g. Basic familiarity with JavaScript"
                  addLabel="Add prerequisite"
                />
              </div>

              <div className="border-t border-border pt-5">
                <ListEditor
                  label="Who this course is for"
                  items={form.audience}
                  disabled={locked}
                  onChange={(items) => set("audience", items)}
                  placeholder="e.g. Engineers shipping AI features"
                  addLabel="Add learner"
                />
              </div>
            </div>
          </section>

          {/* Form Action Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white px-5 py-4 shadow-card">
            <p className="text-[12.5px] text-muted-foreground">
              {form.id
                ? "Changes are saved to your course draft."
                : "You'll add lessons, quizzes and resources next."}
            </p>
            <div className="flex flex-wrap items-center gap-2.5">
              {form.id ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || locked}
                  onClick={() => void saveAndNavigate(true)}
                >
                  Save &amp; continue to Curriculum
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Button>
              ) : null}
              <Button type="submit" disabled={busy || locked} loading={busy}>
                {submitLabel}
                {!form.id ? <ArrowRight className="size-3.5" aria-hidden="true" /> : null}
              </Button>
            </div>
          </div>
        </div>

        {/* Right column: Sticky Live Catalog Card Preview */}
        <aside className="space-y-5 xl:sticky xl:top-20">
          {/* Live Public Catalog Card Preview */}
          <div className="rounded-2xl border border-border bg-white p-4 shadow-card">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-foreground">
                <Eye className="size-3.5 text-primary" aria-hidden="true" />
                Catalog card preview
              </div>
              <span className="rounded-md bg-muted px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">
                Updates as you type
              </span>
            </div>

            <CourseCard course={previewCourse} preview />
          </div>
        </aside>
      </div>
    </form>
  );
}

/** Shared section header so every form section aligns identically. */
function SectionHeading({
  icon,
  tint,
  title,
  hint,
}: {
  icon: React.ReactNode;
  tint: string;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", tint)}>
        {icon}
      </span>
      <div>
        <h2 className="font-display text-[15px] font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {hint ? (
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">{hint}</p>
        ) : null}
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  required,
  hint,
  error,
  children,
}: {
  id?: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-[13px] font-medium text-foreground">
          {label}
          {required ? <span className="ml-0.5 text-primary">*</span> : null}
        </label>
        {hint ? (
          <span
            id={id ? `${id}-help` : undefined}
            className="text-[11px] text-zinc-400"
          >
            {hint}
          </span>
        ) : null}
      </div>
      {children}
      {error ? (
        <p
          id={id ? `${id}-error` : undefined}
          className="text-[12px] text-red-600"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ListEditor({
  label,
  items,
  disabled,
  onChange,
  placeholder,
  addLabel = "Add item",
}: {
  label: string;
  items: string[];
  disabled?: boolean;
  onChange: (items: string[]) => void;
  placeholder?: string;
  addLabel?: string;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[13px] font-medium text-foreground">{label}</p>
        <span className="text-[11px] text-zinc-400">{items.length}/20</span>
      </div>

      {items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40 font-mono text-[11px] text-muted-foreground">
                {index + 1}
              </span>
              <Input
                value={item}
                disabled={disabled}
                maxLength={400}
                onChange={(e) => {
                  const next = [...items];
                  next[index] = e.target.value;
                  onChange(next);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && items.length < 20 && !disabled) {
                    e.preventDefault();
                    onChange([...items, ""]);
                  }
                }}
                placeholder={placeholder}
                aria-label={`${label} item ${index + 1}`}
              />
              {!disabled ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${label} item ${index + 1}`}
                  onClick={() => onChange(items.filter((_, i) => i !== index))}
                  className="text-muted-foreground hover:text-red-600"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 px-3.5 py-2.5 text-[12px] text-muted-foreground">
          Nothing added yet — use <strong className="font-medium text-foreground">{addLabel}</strong>.
        </div>
      )}

      {items.length < 20 && !disabled ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...items, ""])}
          className="gap-1.5"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          {addLabel}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Client-side field validation mirroring `courseSchema` on the server so the
 * creator gets immediate per-field feedback before the network round-trip.
 */
export function validateDetails(form: CourseDetailsInitial): Record<string, string> {
  const errors: Record<string, string> = {};
  if (form.title.trim().length < 3)
    errors.title = "Enter a course title (at least 3 characters).";
  if (form.title.trim().length > 140)
    errors.title = "Keep the title under 140 characters.";
  if (form.subtitle.trim().length > 180)
    errors.subtitle = "Keep the subtitle under 180 characters.";
  if (form.description.trim().length > 6000)
    errors.description = "Keep the description under 6,000 characters.";
  if (!form.categorySlug.trim()) errors.categorySlug = "Choose a category.";
  if (!form.language.trim()) errors.language = "Enter the teaching language.";

  const price = inrPriceInputSchema.safeParse(form.priceRupees.trim() || "0");
  if (!price.success) {
    errors.priceRupees =
      price.error.issues[0]?.message ?? "Enter a valid INR amount (e.g. 999 or 999.50).";
  }

  if (form.compareAtRupees.trim()) {
    const compare = inrPriceInputSchema.safeParse(form.compareAtRupees.trim());
    if (!compare.success) {
      errors.compareAtRupees =
        compare.error.issues[0]?.message ?? "Enter a valid compare-at price.";
    } else if (price.success && compare.data <= price.data) {
      errors.compareAtRupees =
        "Compare-at price must be higher than the course price.";
    }
  }
  return errors;
}
