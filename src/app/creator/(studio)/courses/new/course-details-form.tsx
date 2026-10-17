"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Circle,
  Eye,
  Globe2,
  Image as ImageIcon,
  IndianRupee,
  Layers,
  Plus,
  Signal,
  Sparkles,
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

const LEVEL_LABELS: Record<CourseDetailsInitial["level"], string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
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
  const [pricingMode, setPricingMode] = React.useState<"free" | "paid">(() => {
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

  function handlePricingModeChange(mode: "free" | "paid") {
    if (locked) return;
    setPricingMode(mode);
    setSavedNotice(null);
    if (mode === "free") {
      set("priceRupees", "0");
      set("compareAtRupees", "");
    } else if (
      form.priceRupees === "0" ||
      form.priceRupees === "0.00" ||
      !form.priceRupees.trim()
    ) {
      set("priceRupees", "999");
    }
  }

  async function saveAndNavigate(goToCurriculumAfterSave: boolean) {
    if (locked) return;
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

      if (!form.id && result.id) {
        if (thumbnailFile.current) {
          const uploadRes = await uploadThumbnail(result.id, thumbnailFile.current);
          if (!uploadRes.ok) {
            router.push(`/creator/courses/${result.id}/edit`);
            return;
          }
        }
        router.push(`/creator/courses/${result.id}/curriculum`);
        return;
      }

      if (goToCurriculumAfterSave && form.id) {
        router.push(`/creator/courses/${form.id}/curriculum`);
        return;
      }

      setSavedNotice("Course details saved.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveAndNavigate(false);
  }

  const selectedCategory = CATEGORIES.find((cat) => cat.slug === form.categorySlug);
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

  const stepChecklist = [
    {
      label: "Course title (3+ characters)",
      done: form.title.trim().length >= 3,
    },
    {
      label: "Course description",
      done: form.description.trim().length > 0,
    },
    {
      label: "Category selected",
      done: Boolean(form.categorySlug.trim()),
    },
    {
      label: "16:9 cover thumbnail",
      done: Boolean(liveThumbnailUrl || form.thumbnailKey),
    },
  ];

  const avatarUrl = instructor?.avatarKey
    ? imagePath("avatars", instructor.avatarKey)
    : null;

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

          {/* Section 5: Course Pricing */}
          <section className="rounded-2xl border border-border bg-white p-5 shadow-card sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <SectionHeading
                icon={<IndianRupee className="size-4" aria-hidden="true" />}
                tint="bg-accent text-primary"
                title="Pricing"
                hint="Free or paid in ₹ — change it any time."
              />
              <Badge variant={pricingMode === "free" ? "emerald" : "violet"}>
                {pricingMode === "free" || parsedPricePaise === 0
                  ? "Free"
                  : formatInr(parsedPricePaise)}
              </Badge>
            </div>

            <div
              className="mt-4 grid gap-2.5 sm:grid-cols-2"
              role="radiogroup"
              aria-label="Course pricing model"
            >
              <button
                type="button"
                role="radio"
                disabled={locked}
                aria-checked={pricingMode === "free"}
                onClick={() => handlePricingModeChange("free")}
                className={cn(
                  "flex items-start justify-between rounded-xl border p-3.5 text-left transition-colors",
                  pricingMode === "free"
                    ? "border-primary bg-primary/[0.06] text-foreground"
                    : "border-border bg-white text-muted-foreground hover:bg-muted/40"
                )}
              >
                <div>
                  <p className="text-[13px] font-semibold text-foreground">
                    Free course (₹0)
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                    Open enrollment with one click.
                  </p>
                </div>
                <span
                  className={cn(
                    "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                    pricingMode === "free"
                      ? "border-primary bg-primary text-white"
                      : "border-zinc-300"
                  )}
                >
                  {pricingMode === "free" ? <Check className="size-2.5" /> : null}
                </span>
              </button>

              <button
                type="button"
                role="radio"
                disabled={locked}
                aria-checked={pricingMode === "paid"}
                onClick={() => handlePricingModeChange("paid")}
                className={cn(
                  "flex items-start justify-between rounded-xl border p-3.5 text-left transition-colors",
                  pricingMode === "paid"
                    ? "border-primary bg-primary/[0.06] text-foreground"
                    : "border-border bg-white text-muted-foreground hover:bg-muted/40"
                )}
              >
                <div>
                  <p className="text-[13px] font-semibold text-foreground">
                    Paid course (INR)
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                    UPI, cards & netbanking via Razorpay.
                  </p>
                </div>
                <span
                  className={cn(
                    "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                    pricingMode === "paid"
                      ? "border-primary bg-primary text-white"
                      : "border-zinc-300"
                  )}
                >
                  {pricingMode === "paid" ? <Check className="size-2.5" /> : null}
                </span>
              </button>
            </div>

            {pricingMode === "paid" ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field
                  id="cd-price"
                  label="Price (INR ₹)"
                  error={fieldErrors.priceRupees}
                  hint="e.g. 999 or 1499.50"
                >
                  <Input
                    id="cd-price"
                    disabled={locked}
                    inputMode="decimal"
                    value={form.priceRupees}
                    onChange={(e) => set("priceRupees", e.target.value)}
                    aria-invalid={Boolean(fieldErrors.priceRupees)}
                    placeholder="999"
                  />
                </Field>

                <Field
                  id="cd-compare-price"
                  label="Compare-at price (₹, optional)"
                  error={fieldErrors.compareAtRupees}
                  hint="Must be higher than the selling price"
                >
                  <Input
                    id="cd-compare-price"
                    disabled={locked}
                    inputMode="decimal"
                    value={form.compareAtRupees}
                    onChange={(e) => set("compareAtRupees", e.target.value)}
                    aria-invalid={Boolean(fieldErrors.compareAtRupees)}
                    placeholder="1999"
                  />
                </Field>
              </div>
            ) : null}
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

        {/* Right column: Sticky Live Catalog Card Preview & Checklist */}
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

            {/* Public CourseCard replica bound to live form state */}
            <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
              <div className="relative aspect-video w-full overflow-hidden border-b border-border bg-muted">
                {liveThumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={liveThumbnailUrl}
                    alt={form.title.trim() || "Course thumbnail preview"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-violet-600/10 via-fuchsia-500/5 to-sky-500/10 px-4 text-center">
                    <ImageIcon className="size-6 text-primary/60" aria-hidden="true" />
                    <p className="text-[11.5px] font-semibold text-foreground">
                      No thumbnail uploaded yet
                    </p>
                    <p className="text-[10.5px] text-muted-foreground">
                      16:9 cover image will appear here
                    </p>
                  </div>
                )}
                <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
                  <Badge variant="solid_white">
                    {selectedCategory?.name ?? "Choose category"}
                  </Badge>
                </div>
              </div>

              <div className="space-y-3 p-4">
                <div>
                  <h3
                    className={cn(
                      "line-clamp-2 font-display text-[14.5px] font-semibold leading-snug",
                      form.title.trim() ? "text-foreground" : "italic text-zinc-400"
                    )}
                  >
                    {form.title.trim() || "Untitled course — enter a title"}
                  </h3>
                  <p
                    className={cn(
                      "mt-1 line-clamp-2 text-[12px] leading-relaxed",
                      form.subtitle.trim() || form.description.trim()
                        ? "text-muted-foreground"
                        : "italic text-zinc-400"
                    )}
                  >
                    {form.subtitle.trim() ||
                      form.description.trim() ||
                      "Your short subtitle or description will appear here."}
                  </p>
                </div>

                {/* Real creator identity */}
                {instructor ? (
                  <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={avatarUrl}
                        alt={instructor.name}
                        className="size-5 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex size-5 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-primary">
                        {instructor.initials}
                      </span>
                    )}
                    <span className="truncate font-medium text-foreground">
                      {instructor.name}
                    </span>
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Signal className="size-3 text-zinc-400" aria-hidden="true" />
                    {LEVEL_LABELS[form.level]}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Globe2 className="size-3 text-zinc-400" aria-hidden="true" />
                    {form.language}
                  </span>
                  {form.whatYouLearn.filter((s) => s.trim()).length > 0 ? (
                    <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                      <Sparkles className="size-3" aria-hidden="true" />
                      {form.whatYouLearn.filter((s) => s.trim()).length} outcomes
                    </span>
                  ) : null}
                </div>

                <div className="flex items-baseline justify-between border-t border-border pt-3">
                  {parsedPricePaise === 0 ? (
                    <span className="font-display text-[14px] font-semibold text-emerald-700">
                      Free
                    </span>
                  ) : (
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-display text-[15px] font-bold text-foreground">
                        {formatInr(parsedPricePaise)}
                      </span>
                      {parsedComparePaise ? (
                        <span className="text-[11.5px] text-zinc-400 line-through">
                          {formatInr(parsedComparePaise)}
                        </span>
                      ) : null}
                    </div>
                  )}
                  <span className="text-[11px] font-medium text-primary">
                    View course →
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Readiness Checklist */}
          <div className="rounded-2xl border border-border bg-white p-4 shadow-card">
            <h3 className="text-[12.5px] font-semibold text-foreground">
              Before you continue
            </h3>
            <ul className="mt-2.5 space-y-2">
              {stepChecklist.map((item) => (
                <li key={item.label} className="flex items-center gap-2 text-[12px]">
                  {item.done ? (
                    <CheckCircle2
                      className="size-3.5 shrink-0 text-emerald-600"
                      aria-hidden="true"
                    />
                  ) : (
                    <Circle
                      className="size-3.5 shrink-0 text-zinc-300"
                      aria-hidden="true"
                    />
                  )}
                  <span
                    className={
                      item.done
                        ? "font-medium text-foreground"
                        : "text-muted-foreground"
                    }
                  >
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
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
