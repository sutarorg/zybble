"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { saveCourse } from "@/app/creator/actions";
import { CATEGORIES, TEACHING_LANGUAGES } from "@/lib/config/catalog";
import { rupeesToPaise } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface CourseDetailsInitial {
  id?: string;
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

const MAX_LIST_ITEMS = 20;

/**
 * Course details editor — wizard step 1.
 *
 * Price is typed in rupees for humans and converted to integer paise with exact
 * decimal arithmetic before it reaches the server. The server re-validates the
 * value, so the inline checks here are a convenience, not the authority. A
 * price of 0 keeps the course free.
 *
 * Saves go to the real course record through `saveCourse`; there is no separate
 * draft store. On create the wizard continues to the curriculum step; on edit
 * the form stays on this step so a creator can revisit earlier steps without
 * being yanked forward.
 */
export function CourseDetailsForm({
  initial,
  locked = false,
  submitLabel = "Save draft",
}: {
  initial?: CourseDetailsInitial;
  /** Published courses keep their existing editing restrictions: the form is read-only. */
  locked?: boolean;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [form, setForm] = React.useState<CourseDetailsInitial>(
    initial ?? {
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
    }
  );
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  const isCreate = !initial?.id;

  function update<K extends keyof CourseDetailsInitial>(key: K, value: CourseDetailsInitial[K]) {
    setSaved(false);
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      if (!current[key as string]) return current;
      const next = { ...current };
      delete next[key as string];
      return next;
    });
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const errors = validateDetails(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError("Check the highlighted fields and try again.");
      return;
    }

    setBusy(true);
    setError(null);
    setSaved(false);
    const result = await saveCourse({
      id: form.id,
      title: form.title,
      subtitle: form.subtitle,
      description: form.description,
      categorySlug: form.categorySlug,
      level: form.level,
      language: form.language,
      priceRupees: form.priceRupees,
      compareAtRupees: form.compareAtRupees || undefined,
      whatYouLearn: clean(form.whatYouLearn),
      requirements: clean(form.requirements),
      audience: clean(form.audience),
    })
      .then((value) => value)
      .catch(() => ({ ok: false, error: "Something went wrong. Please try again." }) as Awaited<ReturnType<typeof saveCourse>>);

    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Could not save the course");
      return;
    }

    if (isCreate) {
      // First save creates the record; the wizard unlocks and continues.
      router.push(`/creator/courses/${result.id}/curriculum`);
      router.refresh();
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} aria-busy={busy} className="rounded-xl border border-border bg-white p-5 shadow-card sm:p-6">
      <FormError message={error} />

      {/* ---------------------------------------------------------------- */}
      {/* Basics                                                            */}
      {/* ---------------------------------------------------------------- */}
      <section aria-labelledby="cd-basics-heading">
        <h2 id="cd-basics-heading" className="font-display text-[15px] font-semibold tracking-tight">
          About this course
        </h2>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          The title and description appear everywhere your course is listed.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FieldLabel htmlFor="cd-title" required>
              Course title
            </FieldLabel>
            <Input
              id="cd-title"
              required
              maxLength={140}
              disabled={locked}
              placeholder="e.g. Build AI agents with Python"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              aria-invalid={Boolean(fieldErrors.title)}
              aria-describedby={fieldErrors.title ? "cd-title-error" : "cd-title-help"}
            />
            <FieldHint
              id="cd-title-help"
              errorId="cd-title-error"
              error={fieldErrors.title}
              hint={`${form.title.trim().length}/140 characters · at least 3`}
            />
          </div>

          <div className="sm:col-span-2">
            <FieldLabel htmlFor="cd-subtitle">Subtitle</FieldLabel>
            <Input
              id="cd-subtitle"
              maxLength={180}
              disabled={locked}
              placeholder="One line that expands on the title"
              value={form.subtitle}
              onChange={(e) => update("subtitle", e.target.value)}
              aria-invalid={Boolean(fieldErrors.subtitle)}
              aria-describedby={fieldErrors.subtitle ? "cd-subtitle-error" : "cd-subtitle-help"}
            />
            <FieldHint
              id="cd-subtitle-help"
              errorId="cd-subtitle-error"
              error={fieldErrors.subtitle}
              hint={`Shown under the title in the catalog · ${form.subtitle.length}/180 characters`}
            />
          </div>

          <div className="sm:col-span-2">
            <FieldLabel htmlFor="cd-description" required hint="Required before you can submit for review">
              Description
            </FieldLabel>
            <Textarea
              id="cd-description"
              rows={6}
              maxLength={6000}
              disabled={locked}
              placeholder="What does the course cover, and who teaches it best?"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              aria-invalid={Boolean(fieldErrors.description)}
              aria-describedby={fieldErrors.description ? "cd-description-error" : "cd-description-help"}
            />
            <FieldHint
              id="cd-description-help"
              errorId="cd-description-error"
              error={fieldErrors.description}
              hint={`${form.description.length}/6,000 characters`}
            />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Classification                                                    */}
      {/* ---------------------------------------------------------------- */}
      <section aria-labelledby="cd-class-heading" className="mt-7 border-t border-border pt-6">
        <h2 id="cd-class-heading" className="font-display text-[15px] font-semibold tracking-tight">
          Category, level and language
        </h2>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          These decide where your course appears and who it is suggested to.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="cd-category" required>
              Category
            </FieldLabel>
            <select
              id="cd-category"
              required
              disabled={locked}
              aria-invalid={Boolean(fieldErrors.categorySlug)}
              aria-describedby={fieldErrors.categorySlug ? "cd-category-error" : undefined}
              className="h-9.5 w-full rounded-lg border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70"
              value={form.categorySlug}
              onChange={(e) => update("categorySlug", e.target.value)}
            >
              <option value="">Choose a category…</option>
              {CATEGORIES.map((category) => (
                <option key={category.slug} value={category.slug}>{category.name}</option>
              ))}
            </select>
            <FieldHint errorId="cd-category-error" error={fieldErrors.categorySlug} />
          </div>

          <div>
            <FieldLabel htmlFor="cd-level">Level</FieldLabel>
            <select
              id="cd-level"
              disabled={locked}
              className="h-9.5 w-full rounded-lg border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70"
              value={form.level}
              onChange={(e) => update("level", e.target.value as CourseDetailsInitial["level"])}
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>

          <div>
            <FieldLabel htmlFor="cd-language">Taught in</FieldLabel>
            <select
              id="cd-language"
              disabled={locked}
              className="h-9.5 w-full rounded-lg border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70"
              value={form.language}
              onChange={(e) => update("language", e.target.value)}
            >
              {TEACHING_LANGUAGES.map((language) => (
                <option key={language} value={language}>{language}</option>
              ))}
            </select>
            <FieldHint hint="The language you teach in. Learners filter by it." />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Outcomes                                                          */}
      {/* ---------------------------------------------------------------- */}
      <section aria-labelledby="cd-outcomes-heading" className="mt-7 border-t border-border pt-6">
        <h2 id="cd-outcomes-heading" className="font-display text-[15px] font-semibold tracking-tight">
          Outcomes and audience
        </h2>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          Concrete bullets sell a course far better than adjectives. Up to {MAX_LIST_ITEMS} items each.
        </p>

        <ListEditor
          title="What learners will be able to do"
          placeholder="e.g. Build and deploy an AI agent end to end"
          values={form.whatYouLearn}
          disabled={locked}
          onChange={(whatYouLearn) => update("whatYouLearn", whatYouLearn)}
        />
        <ListEditor
          title="Requirements"
          placeholder="e.g. Basic Python familiarity"
          values={form.requirements}
          disabled={locked}
          onChange={(requirements) => update("requirements", requirements)}
        />
        <ListEditor
          title="Who this course is for"
          placeholder="e.g. Developers who want to automate workflows"
          values={form.audience}
          disabled={locked}
          onChange={(audience) => update("audience", audience)}
        />
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Pricing                                                           */}
      {/* ---------------------------------------------------------------- */}
      <section aria-labelledby="cd-pricing-heading" className="mt-7 border-t border-border pt-6">
        <h2 id="cd-pricing-heading" className="font-display text-[15px] font-semibold tracking-tight">
          Pricing
        </h2>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          Zybble is INR-only. Prices are stored as exact integer paise; set 0 to keep the course free.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="cd-price" required>
              Price (₹)
            </FieldLabel>
            <Input
              id="cd-price"
              inputMode="decimal"
              required
              disabled={locked}
              placeholder="0"
              value={form.priceRupees}
              onChange={(e) => update("priceRupees", e.target.value)}
              aria-invalid={Boolean(fieldErrors.priceRupees)}
              aria-describedby={fieldErrors.priceRupees ? "cd-price-error" : "cd-price-help"}
            />
            <FieldHint
              id="cd-price-help"
              errorId="cd-price-error"
              error={fieldErrors.priceRupees}
              hint={`Stored as ${previewPaise(form.priceRupees)} paise. 0 makes the course free.`}
            />
          </div>

          <div>
            <FieldLabel htmlFor="cd-compare">Compare-at price (₹)</FieldLabel>
            <Input
              id="cd-compare"
              inputMode="decimal"
              disabled={locked}
              placeholder="Optional"
              value={form.compareAtRupees}
              onChange={(e) => update("compareAtRupees", e.target.value)}
              aria-invalid={Boolean(fieldErrors.compareAtRupees)}
              aria-describedby={fieldErrors.compareAtRupees ? "cd-compare-error" : "cd-compare-help"}
            />
            <FieldHint
              id="cd-compare-help"
              errorId="cd-compare-error"
              error={fieldErrors.compareAtRupees}
              hint="Shown struck through next to the price — use it only for a genuine earlier price."
            />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Actions                                                           */}
      {/* ---------------------------------------------------------------- */}
      <div className="mt-7 flex flex-wrap items-center gap-3 border-t border-border pt-5">
        <Button type="submit" disabled={busy || locked} loading={busy}>
          {busy ? "Saving…" : submitLabel}
        </Button>
        {locked ? (
          <p className="text-[12.5px] text-muted-foreground">
            This course is published, so its details are read-only.
          </p>
        ) : saved ? (
          <p role="status" className="text-[12.5px] text-emerald-700">
            Changes saved.
          </p>
        ) : null}
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Field helpers                                                               */
/* -------------------------------------------------------------------------- */

function FieldLabel({
  htmlFor,
  required,
  hint,
  children,
}: {
  htmlFor: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <Label htmlFor={htmlFor} className="mb-1.5 block text-[13px]">
      {children}
      {required ? (
        <>
          <span className="ml-0.5 text-red-600" aria-hidden>
            *
          </span>
          <span className="sr-only"> (required)</span>
        </>
      ) : (
        <span className="ml-1.5 font-normal text-zinc-400">(optional)</span>
      )}
      {hint ? <span className="ml-1.5 font-normal text-zinc-400">— {hint}</span> : null}
    </Label>
  );
}

function FieldHint({
  id,
  errorId,
  error,
  hint,
}: {
  id?: string;
  errorId?: string;
  error?: string;
  hint?: string;
}) {
  if (error) {
    return (
      <p id={errorId} className="mt-1 text-[11.5px] font-medium text-red-600">
        {error}
      </p>
    );
  }
  return hint ? (
    <p id={id} className="mt-1 text-[11.5px] text-zinc-400">
      {hint}
    </p>
  ) : null;
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">
      {message}
    </p>
  );
}

/**
 * Inline validation mirroring the server rules in `courseSchema` /
 * `inrPriceInputSchema`. The server re-checks everything — this only moves the
 * error message next to the field that caused it.
 */
export function validateDetails(form: CourseDetailsInitial): Record<string, string> {
  const errors: Record<string, string> = {};
  const title = form.title.trim();
  if (title.length < 3) errors.title = "Add a course title with at least 3 characters.";
  else if (title.length > 140) errors.title = "Keep the title under 140 characters.";
  if (form.subtitle.trim().length > 180) errors.subtitle = "Keep the subtitle under 180 characters.";
  if (form.description.trim().length > 6000) errors.description = "Keep the description under 6,000 characters.";
  if (!form.categorySlug) errors.categorySlug = "Choose a category.";
  try {
    rupeesToPaise(form.priceRupees || "");
  } catch {
    errors.priceRupees = "Enter a valid price in rupees (for example 0 or 499.50).";
  }
  if (form.compareAtRupees.trim()) {
    try {
      rupeesToPaise(form.compareAtRupees);
    } catch {
      errors.compareAtRupees = "Enter a valid comparison price in rupees.";
    }
  }
  for (const [key, values] of Object.entries({
    whatYouLearn: form.whatYouLearn,
    requirements: form.requirements,
    audience: form.audience,
  })) {
    const filled = values.map((value) => value.trim()).filter(Boolean);
    if (filled.length > MAX_LIST_ITEMS) errors[key] = `Use at most ${MAX_LIST_ITEMS} items.`;
    if (filled.some((value) => value.length > 400)) errors[key] = "Keep each item under 400 characters.";
  }
  return errors;
}

function previewPaise(value: string): string {
  try {
    return rupeesToPaise(value || "").toLocaleString("en-IN");
  } catch {
    return "—";
  }
}

function clean(values: string[]): string[] {
  return values.map((value) => value.trim()).filter(Boolean);
}

function ListEditor({
  title,
  placeholder,
  values,
  disabled,
  onChange,
}: {
  title: string;
  placeholder?: string;
  values: string[];
  disabled?: boolean;
  onChange: (values: string[]) => void;
}) {
  return (
    <fieldset className="mt-5" disabled={disabled}>
      <legend className="mb-2 text-[13px] font-medium">{title}</legend>
      <div className="space-y-2">
        {values.map((value, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              aria-label={`${title} item ${index + 1}`}
              maxLength={400}
              placeholder={placeholder}
              value={value}
              onChange={(event) => {
                const next = [...values];
                next[index] = event.target.value;
                onChange(next);
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`Remove ${title.toLowerCase()} item ${index + 1}`}
              disabled={values.length <= 1}
              onClick={() => onChange(values.filter((_, i) => i !== index))}
            >
              Remove
            </Button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-2"
        disabled={values.length >= MAX_LIST_ITEMS}
        onClick={() => onChange([...values, ""])}
      >
        Add item
      </Button>
    </fieldset>
  );
}
