"use client";

import { LocalizedText, useTranslate } from "@/components/providers/localized-text";
import * as React from "react";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Info,
  LayoutGrid,
  Pencil,
  Plus,
} from "lucide-react";
import type { AdminCategory } from "@/types";
import { useAdmin } from "@/components/providers/admin-provider";
import { categoryIcon } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { slugify } from "@/lib/creator";
import { cn } from "@/lib/utils";

export default function AdminCategoriesPage() {
  const translateUi = useTranslate();
  const { hydrated, categories, addCategory, updateCategory, reorderCategories, toggleCategoryVisible } =
    useAdmin();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminCategory | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState("");

  const sorted = [...categories].sort((a, b) => a.order - b.order);

  const openAdd = () => {
    setEditing(null);
    setName("");
    setSlug("");
    setDescription("");
    setSlugEdited(false);
    setError("");
    setDialogOpen(true);
  };

  const openEdit = (cat: AdminCategory) => {
    setEditing(cat);
    setName(cat.name);
    setSlug(cat.slug);
    setDescription(cat.description);
    setSlugEdited(true);
    setError("");
    setDialogOpen(true);
  };

  const validateSlug = (value: string, excludeId?: string): string | null => {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) return "Use lowercase letters, numbers and hyphens only.";
    if (categories.some((c) => c.slug === value && c.id !== excludeId)) return "That slug is already taken — slugs must be unique.";
    return null;
  };

  const save = () => {
    if (name.trim().length < 3) {
      setError("Category name needs at least 3 characters.");
      return;
    }
    const finalSlug = (slugEdited ? slug : slug || slugify(name)) || slugify(name);
    const err = validateSlug(finalSlug, editing?.id);
    if (err) {
      setError(err);
      return;
    }
    if (editing) {
      updateCategory(editing.id, { name: name.trim(), slug: finalSlug, description: description.trim() });
      toast.success(`Category “${name.trim()}” updated (local)`);
    } else {
      addCategory({
        name: name.trim(),
        slug: finalSlug,
        description: description.trim() || "Custom marketplace category .",
        order: sorted.length + 1,
        visible: true,
      });
      toast.success(`Category “${name.trim()}” added (local)`);
    }
    setDialogOpen(false);
  };

  if (!hydrated) return <Skeleton className="h-96 rounded-xl" />;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold tracking-[0.14em] text-primary uppercase"><LocalizedText text={"Marketplace"} /></p>
          <h1 className="font-display mt-1.5 text-[26px] font-bold tracking-tight sm:text-3xl"><LocalizedText text={"Categories"} /></h1>
          <p className="mt-1.5 max-w-xl text-[14px] text-muted-foreground"><LocalizedText text={"The 8 official Zybble categories plus any local additions. Changes persist in this browser only."} /></p>
        </div>
        <Button onClick={openAdd}>
          <Plus aria-hidden /><LocalizedText text={"Add category"} /></Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-card">
        <ul className="divide-y divide-border">
          {sorted.map((cat, i) => {
            const Icon = categoryIcon(cat.slug);
            return (
              <li key={cat.id} className={cn("flex items-center gap-3 px-4 py-3.5 sm:px-5", !cat.visible && "opacity-55")}>
                <span className="flex w-7 shrink-0 justify-center font-display text-[13px] font-bold text-zinc-300 tabular-nums">
                  {i + 1}
                </span>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                  <Icon className="size-4.5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[13.5px] font-semibold"><LocalizedText text={cat.name} /></p>
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10.5px] text-zinc-500"><LocalizedText text={cat.slug} /></span>
                    {!cat.visible && <Badge variant="secondary"><LocalizedText text={"Hidden"} /></Badge>}
                  </div>
                  <p className="truncate text-[12px] text-muted-foreground">
                    <LocalizedText text={cat.description} /> · {cat.courseCount} {cat.courseCount === 1 ? "course" : "courses"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    aria-label={translateUi(`Move ${cat.name} up`)}
                    disabled={i === 0}
                    onClick={() => {
                      reorderCategories(i, i - 1);
                      toast("Display order updated (local)");
                    }}
                    className="cursor-pointer rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-muted hover:text-foreground disabled:opacity-25"
                  >
                    <ArrowUp className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label={translateUi(`Move ${cat.name} down`)}
                    disabled={i === sorted.length - 1}
                    onClick={() => {
                      reorderCategories(i, i + 1);
                      toast("Display order updated (local)");
                    }}
                    className="cursor-pointer rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-muted hover:text-foreground disabled:opacity-25"
                  >
                    <ArrowDown className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label={translateUi(`Edit ${cat.name}`)}
                    onClick={() => openEdit(cat)}
                    className="cursor-pointer rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Pencil className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label={translateUi(cat.visible ? `Hide ${cat.name}` : `Show ${cat.name}`)}
                    aria-pressed={!cat.visible}
                    onClick={() => {
                      toggleCategoryVisible(cat.id);
                      toast.success(cat.visible ? `“${cat.name}” hidden (local)` : `“${cat.name}” visible again (local)`);
                    }}
                    className={cn(
                      "cursor-pointer rounded-md p-1.5 transition-colors hover:bg-muted",
                      cat.visible ? "text-zinc-400 hover:text-foreground" : "text-amber-600 hover:text-amber-700"
                    )}
                  >
                    {cat.visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="flex items-start gap-1.5 text-[12px] leading-relaxed text-zinc-400">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden /><LocalizedText text={"Category edits, ordering and visibility are persisted locally for the portal preview. The public storefront keeps its curated catalog structure."} /></p>

      {/* Add / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit category" : "Add category"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update the label, slug or blurb." : "Give the category a name — the slug is generated automatically unless you override it."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <LayoutGrid className="size-4 text-primary" aria-hidden />
                <Label htmlFor="cat-name"><LocalizedText text={"Name *"} /></Label>
              </div>
              <Input
                id="cat-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slugEdited) setSlug(slugify(e.target.value));
                }}
                placeholder={translateUi("e.g. AI for Healthcare")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-slug"><LocalizedText text={"Slug * (must be unique)"} /></Label>
              <Input
                id="cat-slug"
                value={slug}
                onChange={(e) => {
                  setSlugEdited(true);
                  setSlug(e.target.value.toLowerCase());
                }}
                placeholder={translateUi("ai-healthcare")}
                className="font-mono text-[13px]"
                aria-invalid={!!error}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-desc"><LocalizedText text={"Description"} /></Label>
              <Textarea
                id="cat-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={translateUi("One line describing what belongs here.")}
                className="min-h-16"
              />
            </div>
            {error && <p className="text-[12px] font-medium text-destructive"><LocalizedText text={error} /></p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}><LocalizedText text={"Cancel"} /></Button>
            <Button onClick={save}>{editing ? "Save changes" : "Add category"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
