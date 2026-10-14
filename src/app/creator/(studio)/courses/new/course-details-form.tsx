"use client";

import * as React from "react";
import Link from "next/link";
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

/**
 * Course details editor.
 *
 * Price is typed in rupees for humans and converted to integer paise with exact
 * decimal arithmetic before it reaches the server. The server re-validates the
 * value, so this component is a convenience, not the authority.
 */
export function CourseDetailsForm({
  initial,
  routeActive,
  lockPrice,
  submitLabel = "Save draft",
}: {
  initial?: CourseDetailsInitial;
  routeActive: boolean;
  lockPrice?: boolean;
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

  const priceDisabled = lockPrice || !routeActive;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await saveCourse({
      id: form.id,
      title: form.title,
      subtitle: form.subtitle,
      description: form.description,
      categorySlug: form.categorySlug,
      level: form.level,
      language: form.language,
      priceRupees: priceDisabled ? "0" : form.priceRupees,
      compareAtRupees: priceDisabled ? undefined : form.compareAtRupees || undefined,
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
    router.push(`/creator/courses/${result.id}/curriculum`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-border bg-white p-5 shadow-card">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="cd-title" className="mb-1.5 block text-[13px]">Title</Label>
          <Input id="cd-title" required maxLength={140} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="cd-subtitle" className="mb-1.5 block text-[13px]">Subtitle</Label>
          <Input id="cd-subtitle" maxLength={180} value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="cd-description" className="mb-1.5 block text-[13px]">Description</Label>
          <Textarea id="cd-description" rows={6} maxLength={6000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>

        <div>
          <Label htmlFor="cd-category" className="mb-1.5 block text-[13px]">Category</Label>
          <select
            id="cd-category"
            required
            className="h-9.5 w-full rounded-lg border border-input bg-background px-3 text-sm"
            value={form.categorySlug}
            onChange={(e) => setForm({ ...form, categorySlug: e.target.value })}
          >
            <option value="">Choose a category…</option>
            {CATEGORIES.map((category) => (
              <option key={category.slug} value={category.slug}>{category.name}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="cd-level" className="mb-1.5 block text-[13px]">Level</Label>
          <select
            id="cd-level"
            className="h-9.5 w-full rounded-lg border border-input bg-background px-3 text-sm"
            value={form.level}
            onChange={(e) => setForm({ ...form, level: e.target.value as CourseDetailsInitial["level"] })}
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>

        <div>
          <Label htmlFor="cd-language" className="mb-1.5 block text-[13px]">Taught in</Label>
          <select
            id="cd-language"
            className="h-9.5 w-full rounded-lg border border-input bg-background px-3 text-sm"
            value={form.language}
            onChange={(e) => setForm({ ...form, language: e.target.value })}
          >
            {TEACHING_LANGUAGES.map((language) => (
              <option key={language} value={language}>{language}</option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="cd-price" className="mb-1.5 block text-[13px]">Price (₹)</Label>
          <Input
            id="cd-price"
            inputMode="decimal"
            disabled={priceDisabled}
            value={priceDisabled ? "0" : form.priceRupees}
            onChange={(e) => setForm({ ...form, priceRupees: e.target.value })}
          />
          <p className="mt-1 text-[11.5px] text-zinc-400">
            {priceDisabled
              ? "Locked at Free until Razorpay Route is active."
              : `Stored as ${previewPaise(form.priceRupees)} paise. Free courses can be published immediately.`}
          </p>
        </div>

        <div>
          <Label htmlFor="cd-compare" className="mb-1.5 block text-[13px]">Compare-at price (₹, optional)</Label>
          <Input
            id="cd-compare"
            inputMode="decimal"
            disabled={priceDisabled}
            value={form.compareAtRupees}
            onChange={(e) => setForm({ ...form, compareAtRupees: e.target.value })}
          />
        </div>
      </div>

      <ListEditor
        title="What learners will be able to do"
        values={form.whatYouLearn}
        onChange={(whatYouLearn) => setForm({ ...form, whatYouLearn })}
      />
      <ListEditor
        title="Requirements"
        values={form.requirements}
        onChange={(requirements) => setForm({ ...form, requirements })}
      />
      <ListEditor
        title="Who this course is for"
        values={form.audience}
        onChange={(audience) => setForm({ ...form, audience })}
      />

      <div className="mt-5 flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : submitLabel}</Button>
        {initial?.id ? (
          <Button asChild type="button" variant="ghost">
            <Link href={`/creator/courses/${initial.id}/curriculum`}>Back to curriculum</Link>
          </Button>
        ) : null}
      </div>
      {error ? <p className="mt-3 text-[13px] text-red-600">{error}</p> : null}
    </form>
  );
}

function previewPaise(value: string): string {
  try {
    return rupeesToPaise(value).toLocaleString("en-IN");
  } catch {
    return "—";
  }
}

function clean(values: string[]): string[] {
  return values.map((value) => value.trim()).filter(Boolean);
}

function ListEditor({
  title,
  values,
  onChange,
}: {
  title: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <fieldset className="mt-5">
      <legend className="mb-2 text-[13px] font-medium">{title}</legend>
      <div className="space-y-2">
        {values.map((value, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              aria-label={`${title} item ${index + 1}`}
              maxLength={400}
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
              onClick={() => onChange(values.filter((_, i) => i !== index))}
            >
              Remove
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => onChange([...values, ""])}>
        Add item
      </Button>
    </fieldset>
  );
}