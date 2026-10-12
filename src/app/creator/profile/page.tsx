"use client";

import * as React from "react";
import { useState } from "react";
import type { CreatorProfile } from "@/types";
import Link from "next/link";
import { toast } from "sonner";
import { Eye, Globe2, MapPin, Plus, Save, X } from "lucide-react";
import { useCreator } from "@/components/providers/creator-provider";
import { instructorStats } from "@/lib/courses";
import { formatCompact, initialsOf } from "@/lib/format";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const AVATAR_COLORS = [
  "bg-violet-100 text-violet-700",
  "bg-sky-100 text-sky-700",
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",
  "bg-emerald-100 text-emerald-700",
  "bg-indigo-100 text-indigo-700",
];

export default function CreatorProfilePage() {
  const { hydrated, profile, saveProfile } = useCreator();
  /* Derived draft: follows the stored creator profile until the creator edits it. */
  const [formDraft, setFormDraft] = useState<CreatorProfile | null>(null);
  const form = formDraft ?? profile;
  const setForm = (next: CreatorProfile | ((prev: CreatorProfile) => CreatorProfile)) =>
    setFormDraft((prev) => {
      const current = prev ?? profile;
      return typeof next === "function" ? next(current) : next;
    });
  const [topicInput, setTopicInput] = useState("");
  const [saving, setSaving] = useState(false);

  if (!hydrated) {
    return (
      <div aria-busy>
        <Skeleton className="h-9 w-56" />
        <Skeleton className="mt-6 h-96 rounded-xl" />
      </div>
    );
  }

  const dirty = JSON.stringify(form) !== JSON.stringify(profile);
  const stats = instructorStats(profile.instructorId);
  const displayInitials = form.initials || initialsOf(form.displayName || "Z C");

  const update = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const save = () => {
    if (form.displayName.trim().length < 2) {
      toast.error("Display name is required.");
      return;
    }
    setSaving(true);
    window.setTimeout(() => {
      saveProfile({ ...form, initials: initialsOf(form.displayName) });
      setSaving(false);
      toast.success("Instructor profile saved (locally)");
    }, 500);
  };

  const addTopic = () => {
    const t = topicInput.trim().toLowerCase();
    if (!t || form.topics.includes(t)) return;
    update({ topics: [...form.topics, t] });
    setTopicInput("");
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold tracking-[0.14em] text-primary uppercase">Creator Studio</p>
          <h1 className="font-display mt-1.5 text-[26px] font-bold tracking-tight sm:text-3xl">
            Instructor profile
          </h1>
          <p className="mt-1.5 text-[14px] text-muted-foreground">
            How learners see you across Zybble. Changes stay in this browser.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/instructors/maya-lindqvist">
              <Eye aria-hidden />
              View public profile
            </Link>
          </Button>
          <Button onClick={save} loading={saving} disabled={!dirty}>
            <Save aria-hidden />
            Save changes
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Form */}
        <section className="space-y-4 rounded-xl border border-border bg-white p-5 shadow-card sm:p-6">
          <div className="flex items-center gap-4">
            <Avatar className="size-16 ring-1 ring-border">
              <AvatarFallback className={cn("text-lg font-bold", form.avatarColor)}>
                {displayInitials}
              </AvatarFallback>
            </Avatar>
            <div>
              <Label>Avatar color</Label>
              <div className="mt-1.5 flex gap-1.5">
                {AVATAR_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Avatar theme ${c}`}
                    aria-pressed={form.avatarColor === c}
                    onClick={() => update({ avatarColor: c })}
                    className={cn(
                      "size-7 cursor-pointer rounded-full border-2 transition-transform hover:scale-110",
                      c.split(" ")[0],
                      form.avatarColor === c ? "border-primary" : "border-transparent"
                    )}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="p-name">Display name *</Label>
              <Input id="p-name" value={form.displayName} onChange={(e) => update({ displayName: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-headline">Headline</Label>
              <Input id="p-headline" value={form.headline} onChange={(e) => update({ headline: e.target.value })} placeholder="e.g. AI Product Lead · ex-Google" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="p-country">Country</Label>
              <Input id="p-country" value={form.country} onChange={(e) => update({ country: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-languages">Languages <span className="font-normal text-zinc-400">(comma-separated)</span></Label>
              <Input
                id="p-languages"
                value={form.languages.join(", ")}
                onChange={(e) => update({ languages: e.target.value.split(",").map((l) => l.trim()).filter(Boolean) })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="p-website">Website</Label>
            <Input id="p-website" value={form.website} onChange={(e) => update({ website: e.target.value })} placeholder="https://…" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="p-bio">Bio</Label>
            <Textarea id="p-bio" value={form.bio} onChange={(e) => update({ bio: e.target.value })} className="min-h-32" />
            <p className="text-[11.5px] text-zinc-400">{form.bio.length} characters · shown on your public profile</p>
          </div>

          <div className="space-y-1.5">
            <Label>Teaching topics</Label>
            <div className="flex flex-wrap items-center gap-1.5">
              {form.topics.map((t) => (
                <span key={t} className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[12px] font-medium">
                  {t}
                  <button
                    type="button"
                    aria-label={`Remove topic ${t}`}
                    onClick={() => update({ topics: form.topics.filter((x) => x !== t) })}
                    className="cursor-pointer text-zinc-400 hover:text-destructive"
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                </span>
              ))}
              <div className="flex items-center gap-1.5">
                <Input
                  value={topicInput}
                  onChange={(e) => setTopicInput(e.target.value)}
                  placeholder="Add topic…"
                  className="h-8 w-32 text-[12.5px]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTopic();
                    }
                  }}
                />
                <Button type="button" variant="outline" size="icon-sm" onClick={addTopic} aria-label="Add topic">
                  <Plus aria-hidden />
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Live preview */}
        <aside className="space-y-3">
          <p className="text-[11px] font-bold tracking-[0.1em] text-zinc-400 uppercase">
            Public preview
          </p>
          <div className="rounded-xl border border-border bg-gradient-to-br from-muted/70 to-white p-5 shadow-card">
            <div className="flex items-center gap-3.5">
              <Avatar className="size-14 ring-2 ring-white shadow-sm">
                <AvatarFallback className={cn("text-base font-bold", form.avatarColor)}>
                  {displayInitials}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-display text-[16px] font-bold tracking-tight">{form.displayName || "Your name"}</p>
                <p className="text-[12.5px] text-muted-foreground">{form.headline || "Your headline"}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
              {form.country && (
                <span className="flex items-center gap-1">
                  <MapPin className="size-3 text-zinc-400" aria-hidden />
                  {form.country}
                </span>
              )}
              {form.languages.length > 0 && (
                <span className="flex items-center gap-1">
                  <Globe2 className="size-3 text-zinc-400" aria-hidden />
                  {form.languages.join(", ")}
                </span>
              )}
            </div>
            <p className="mt-3 line-clamp-4 text-[12.5px] leading-relaxed text-muted-foreground">
              {form.bio || "Tell learners who you are and what you teach."}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[
                { label: "Rating", value: stats.rating.toFixed(1) },
                { label: "Students", value: formatCompact(stats.students) },
                { label: "Courses", value: String(stats.courses) },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-border bg-white px-2 py-2.5">
                  <p className="font-display text-[15px] font-bold tabular-nums">{s.value}</p>
                  <p className="text-[10.5px] text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
          <p className="text-[11.5px] leading-relaxed text-zinc-400">
            Statistics come from the shared catalog data. In this demo, the public instructor page
            shows the seed profile; your edits are stored locally for the next phases.
          </p>
        </aside>
      </div>
    </div>
  );
}
