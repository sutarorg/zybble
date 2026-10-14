"use client";

import { LocalizedText, useTranslate } from "@/components/providers/localized-text";
import * as React from "react";
import { useState } from "react";
import Image from "next/image";
import { Check, GripVertical, ImageIcon, ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { CourseDraft } from "@/types";
import { CATEGORIES, COURSES } from "@/data/mock-data";
import { LEVEL_LABELS } from "@/lib/courses";
import { PLATFORM_COMMISSION, moneyExact } from "@/lib/creator";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { categoryIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";

type Errors = Record<string, string>;
type DraftSetter = (patch: Partial<CourseDraft>) => void;

export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-[12px] font-medium text-destructive">
      <LocalizedText text={message} />
    </p>
  );
}

/* ------------------------------- Basics ----------------------------------- */

export function BasicsForm({ draft, onChange, errors }: { draft: CourseDraft; onChange: DraftSetter; errors: Errors }) {
  const translateUi = useTranslate();
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="f-title"><LocalizedText text={"Course title *"} /></Label>
        <Input
          id="f-title"
          placeholder={translateUi("e.g. Advanced Prompt Systems")}
          value={draft.title}
          maxLength={80}
          onChange={(e) => onChange({ title: e.target.value })}
          aria-invalid={!!errors.title}
        />
        <div className="flex justify-between">
          <FieldError message={errors.title} />
          <p className="ml-auto text-[11px] text-zinc-400 tabular-nums">{draft.title.length}/80</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="f-subtitle"><LocalizedText text={"Subtitle *"} /></Label>
        <Input
          id="f-subtitle"
          placeholder={translateUi("One compelling sentence learners see on the course card")}
          value={draft.subtitle}
          maxLength={140}
          onChange={(e) => onChange({ subtitle: e.target.value })}
          aria-invalid={!!errors.subtitle}
        />
        <FieldError message={errors.subtitle} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="f-description"><LocalizedText text={"Description *"} /></Label>
        <Textarea
          id="f-description"
          placeholder={translateUi("What will learners build, and why is this course different? (min. 40 characters)")}
          value={draft.description}
          onChange={(e) => onChange({ description: e.target.value })}
          className="min-h-28"
          aria-invalid={!!errors.description}
        />
        <FieldError message={errors.description} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label><LocalizedText text={"Category *"} /></Label>
          <Select value={draft.category || undefined} onValueChange={(v) => onChange({ category: v as CourseDraft["category"] })}>
            <SelectTrigger aria-invalid={!!errors.category}>
              <SelectValue placeholder={translateUi("Choose…")} />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.slug} value={c.slug}>
                  <LocalizedText text={c.name} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError message={errors.category} />
        </div>
        <div className="space-y-1.5">
          <Label><LocalizedText text={"Level"} /></Label>
          <Select value={draft.level} onValueChange={(v) => onChange({ level: v as CourseDraft["level"] })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(LEVEL_LABELS).map(([k, label]) => (
                <SelectItem key={k} value={k}>
                  <LocalizedText text={label} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label><LocalizedText text={"Language"} /></Label>
          <Select value={draft.language} onValueChange={(v) => onChange({ language: v as CourseDraft["language"] })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["English", "Spanish", "Portuguese"].map((l) => (
                <SelectItem key={l} value={l}>
                  <LocalizedText text={l} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

/* --------------------------- String list editor ---------------------------- */

/**
 * Reorderable list of short strings (outcomes, prerequisites, audience).
 *
 * Rows can be dragged by the grip handle — the row only becomes draggable once
 * the handle is pressed, so text selection inside the inputs still works. The
 * up/down buttons give keyboard and touch users the same control.
 */
function StringListEditor({
  label,
  hint,
  items,
  onChange,
  placeholder,
  addLabel,
  error,
}: {
  label: string;
  hint?: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  addLabel: string;
  error?: string;
}) {
  const translateUi = useTranslate();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [armed, setArmed] = useState<number | null>(null);

  const update = (i: number, value: string) =>
    onChange(items.map((item, idx) => (idx === i ? value : item)));

  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));

  const move = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  const endDrag = () => {
    setDragIndex(null);
    setOverIndex(null);
    setArmed(null);
  };

  return (
    <fieldset className="space-y-2">
      <legend className="text-[13px] font-medium text-foreground">
        <LocalizedText text={label} />
        {hint && <span className="ml-2 font-normal text-zinc-400"><LocalizedText text={hint} /></span>}
      </legend>
      <div className="space-y-2">
        {items.map((item, i) => {
          const isDragging = dragIndex === i;
          const isDropTarget = overIndex === i && dragIndex !== null && dragIndex !== i;
          return (
            <div
              key={i}
              draggable={armed === i}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", String(i));
                setDragIndex(i);
              }}
              onDragEnter={() => setOverIndex(i)}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => {
                e.preventDefault();
                const from = dragIndex ?? Number(e.dataTransfer.getData("text/plain"));
                move(Number.isNaN(from) ? -1 : from, i);
                endDrag();
              }}
              onDragEnd={endDrag}
              className={cn(
                "flex items-center gap-2 rounded-lg border border-transparent transition-all",
                isDropTarget && "border-primary/50 bg-accent/70",
                isDragging && "border-dashed border-zinc-300 bg-muted opacity-60"
              )}
            >
              <button
                type="button"
                aria-label={translateUi(`Drag to reorder item ${i + 1}`)}
                title={translateUi("Drag to reorder")}
                onMouseDown={() => setArmed(i)}
                onMouseUp={() => setArmed(null)}
                className="flex size-7 shrink-0 cursor-grab items-center justify-center rounded-md text-zinc-300 transition-colors hover:bg-muted hover:text-zinc-500 active:cursor-grabbing"
              >
                <GripVertical className="size-4" aria-hidden />
              </button>
              <Input
                value={item}
                placeholder={translateUi(`${placeholder} ${items.length > 1 ? i + 1 : ""}`.trim())}
                onChange={(e) => update(i, e.target.value)}
              />
              <div className="flex shrink-0 items-center">
                <button
                  type="button"
                  aria-label={translateUi(`Move item ${i + 1} up`)}
                  disabled={i === 0}
                  onClick={() => move(i, i - 1)}
                  className="flex size-7 cursor-pointer items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-muted hover:text-foreground disabled:opacity-25"
                >
                  <ArrowUp className="size-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={translateUi(`Move item ${i + 1} down`)}
                  disabled={i === items.length - 1}
                  onClick={() => move(i, i + 1)}
                  className="flex size-7 cursor-pointer items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-muted hover:text-foreground disabled:opacity-25"
                >
                  <ArrowDown className="size-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  disabled={items.length <= 1}
                  aria-label={translateUi("Remove item")}
                  className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-red-50 hover:text-destructive disabled:opacity-30"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => onChange([...items, ""])}
        className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] font-medium text-primary transition-colors hover:bg-accent"
      >
        <Plus className="size-3.5" aria-hidden />
        <LocalizedText text={addLabel} />
      </button>
      <FieldError message={error} />
    </fieldset>
  );
}

export function OutcomesForm({ draft, onChange, errors }: { draft: CourseDraft; onChange: DraftSetter; errors: Errors }) {
  const translateUi = useTranslate();
  return (
    <div className="space-y-6">
      <StringListEditor
        label={translateUi("Learning outcomes *")}
        hint="What will learners be able to DO? (min. 2)"
        items={draft.outcomes}
        onChange={(outcomes) => onChange({ outcomes })}
        placeholder={translateUi("e.g. Build and deploy a working automation")}
        addLabel="Add outcome"
        error={errors.outcomes}
      />
      <StringListEditor
        label={translateUi("Prerequisites")}
        items={draft.requirements}
        onChange={(requirements) => onChange({ requirements })}
        placeholder={translateUi("e.g. No coding experience needed")}
        addLabel="Add requirement"
      />
      <StringListEditor
        label={translateUi("Target audience")}
        items={draft.audience}
        onChange={(audience) => onChange({ audience })}
        placeholder={translateUi("e.g. Founders automating their first workflows")}
        addLabel="Add audience"
      />
    </div>
  );
}

/* ------------------------------ Thumbnail ---------------------------------- */

const GALLERY = Array.from(new Set(COURSES.map((c) => c.thumbnail)));

export function ThumbnailPicker({ draft, onChange, errors }: { draft: CourseDraft; onChange: DraftSetter; errors: Errors }) {
  const translateUi = useTranslate();
  return (
    <div className="space-y-4">
      {/* Live 16:9 preview — exactly how it appears on course cards */}
      <div className="space-y-1.5">
        <Label><LocalizedText text={"Card preview (16:9)"} /></Label>
        <div className="relative aspect-video w-full max-w-md overflow-hidden rounded-xl border border-border bg-muted">
          {draft.thumbnail ? (
            <Image src={draft.thumbnail} alt={translateUi("Course thumbnail preview")} fill sizes="448px" className="object-cover" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-400">
              <ImageIcon className="size-6" aria-hidden />
              <p className="text-[12.5px]"><LocalizedText text={"Choose an image below"} /></p>
            </div>
          )}
        </div>
        <FieldError message={errors.thumbnail} />
      </div>

      <div className="space-y-1.5">
        <Label><LocalizedText text={"Choose from the Zybble gallery"} /></Label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {GALLERY.map((src) => {
            const selected = draft.thumbnail === src;
            return (
              <button
                key={src}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange({ thumbnail: src })}
                className={cn(
                  "group relative aspect-video cursor-pointer overflow-hidden rounded-lg border-2 bg-muted transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                  selected ? "border-primary shadow-md" : "border-transparent hover:border-zinc-300"
                )}
              >
                <Image src={src} alt={translateUi("")} fill sizes="160px" className="object-cover" />
                {selected && (
                  <span className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-white shadow">
                    <Check className="size-3" strokeWidth={3} aria-hidden />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/60 p-3 text-[12px] leading-relaxed text-muted-foreground">
        <p className="font-medium text-foreground"><LocalizedText text={"About custom uploads"} /></p>
        <p className="mt-0.5"><LocalizedText text={"Custom thumbnail upload isn't connected in this preview — pick any gallery image. Production courses require 1280×720 (16:9) artwork."} /></p>
      </div>
    </div>
  );
}

/* ------------------------------- Pricing ----------------------------------- */

export function PricingForm({ draft, onChange, errors }: { draft: CourseDraft; onChange: DraftSetter; errors: Errors }) {
  const translateUi = useTranslate();
  const commission = Math.round(draft.price * PLATFORM_COMMISSION * 100) / 100;
  const net = Math.round((draft.price - commission) * 100) / 100;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {([
          { id: "paid", title: "Paid course", text: "Set a price in USD. You keep 90% before fees and taxes." },
          { id: "free", title: "Free course", text: "Great for audience growth and lead-in to paid courses." },
        ] as const).map((opt) => {
          const active = (opt.id === "free") === draft.isFree;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange({ isFree: opt.id === "free" })}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-left transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring/25",
                active ? "border-primary bg-accent/60 shadow-xs" : "border-border bg-white hover:border-zinc-300"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                  active ? "border-primary" : "border-zinc-300"
                )}
                aria-hidden
              >
                {active && <span className="size-2 rounded-full bg-primary" />}
              </span>
              <span>
                <span className="block text-[14px] font-semibold">{opt.title}</span>
                <span className="mt-0.5 block text-[12.5px] leading-relaxed text-muted-foreground">{opt.text}</span>
              </span>
            </button>
          );
        })}
      </div>

      {!draft.isFree && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="f-price"><LocalizedText text={"Price (USD) *"} /></Label>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-zinc-400">$</span>
                <Input
                  id="f-price"
                  type="number"
                  min={4.99}
                  step={0.5}
                  value={draft.price}
                  onChange={(e) => onChange({ price: Number(e.target.value) })}
                  className="pl-7"
                  aria-invalid={!!errors.price}
                />
              </div>
              <FieldError message={errors.price} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-compare"><LocalizedText text={"Compare-at price"} /><span className="font-normal text-zinc-400"><LocalizedText text={"(optional)"} /></span>
              </Label>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-zinc-400">$</span>
                <Input
                  id="f-compare"
                  type="number"
                  min={0}
                  step={1}
                  placeholder={translateUi("—")}
                  value={draft.compareAtPrice ?? ""}
                  onChange={(e) =>
                    onChange({ compareAtPrice: e.target.value === "" ? null : Number(e.target.value) })
                  }
                  className="pl-7"
                  aria-invalid={!!errors.compareAtPrice}
                />
              </div>
              <FieldError message={errors.compareAtPrice} />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-muted/50 p-4">
            <p className="text-[13px] font-semibold"><LocalizedText text={"Per-sale breakdown (illustrative)"} /></p>
            <dl className="mt-3 space-y-1.5 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-muted-foreground"><LocalizedText text={"Learner pays"} /></dt>
                <dd className="font-medium tabular-nums"><LocalizedText text={moneyExact(draft.price || 0)} /></dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground"><LocalizedText text={"Zybble commission (10%)"} /></dt>
                <dd className="tabular-nums text-zinc-500">−<LocalizedText text={moneyExact(commission)} /></dd>
              </div>
              <div className="flex justify-between border-t border-border pt-1.5 font-semibold">
                <dt><LocalizedText text={"Your share"} /></dt>
                <dd className="tabular-nums text-success"><LocalizedText text={moneyExact(net)} /></dd>
              </div>
            </dl>
            <p className="mt-2.5 text-[11.5px] leading-relaxed text-zinc-400"><LocalizedText text={"Before payment fees, taxes, refunds or other adjustments. Figures are illustrative sample data."} /></p>
          </div>
        </>
      )}

    </div>
  );
}
