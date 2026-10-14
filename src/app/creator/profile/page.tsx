"use client";

import { LocalizedText, useTranslate } from "@/components/providers/localized-text";
import * as React from "react";
import { useState } from "react";
import type { CreatorProfile } from "@/types";
import Link from "next/link";
import { toast } from "sonner";
import { Camera, Eye, Globe2, MapPin, Save } from "lucide-react";
import { useCreator } from "@/components/providers/creator-provider";
import { instructorStats } from "@/lib/courses";
import { formatCompact, initialsOf } from "@/lib/format";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CountryCombobox } from "@/components/ui/country-combobox";
import { ProfilePictureUpload } from "@/components/ui/profile-picture-upload";
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
  const translateUi = useTranslate();
  const { hydrated, profile, saveProfile, uploadCreatorAvatar } = useCreator();
  /* Derived draft: follows the stored creator profile until the creator edits it. */
  const [formDraft, setFormDraft] = useState<CreatorProfile | null>(null);
  const form = formDraft ?? profile;
  const setForm = (next: CreatorProfile | ((prev: CreatorProfile) => CreatorProfile)) =>
    setFormDraft((prev) => {
      const current = prev ?? profile;
      return typeof next === "function" ? next(current) : next;
    });
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

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold tracking-[0.14em] text-primary uppercase"><LocalizedText text={"Creator Studio"} /></p>
          <h1 className="font-display mt-1.5 text-[26px] font-bold tracking-tight sm:text-3xl"><LocalizedText text={"Instructor profile"} /></h1>
          <p className="mt-1.5 text-[14px] text-muted-foreground"><LocalizedText text={"How learners see you across Zybble. Changes stay in this browser."} /></p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/instructors/${profile.instructorId}`}>
              <Eye aria-hidden /><LocalizedText text={"View public profile"} /></Link>
          </Button>
          <Button onClick={save} loading={saving} disabled={!dirty}>
            <Save aria-hidden /><LocalizedText text={"Save changes"} /></Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Form */}
        <section className="space-y-4 rounded-xl border border-border bg-white p-5 shadow-card sm:p-6">
          <div className="flex flex-wrap items-center gap-5">
            {/* Clicking the picture opens the file picker and uploads instantly. */}
            <ProfilePictureUpload
              currentAvatar={form.avatar}
              initials={displayInitials}
              name={form.displayName || "Your name"}
              onUpload={uploadCreatorAvatar}
              showMeta={false}
              avatarClassName="size-20 ring-1 ring-border"
            />
            <div>
              <Label><LocalizedText text={"Profile picture & avatar color"} /></Label>
              <p className="mb-1.5 flex items-center gap-1 text-[11.5px] text-zinc-400">
                <Camera className="size-3" aria-hidden />
                <LocalizedText text={"Click the picture to upload a new one."} />
              </p>
              <div className="mt-1.5 flex gap-1.5">
                {AVATAR_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={translateUi(`Avatar theme ${c}`)}
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
              <Label htmlFor="p-name"><LocalizedText text={"Display name *"} /></Label>
              <Input id="p-name" value={form.displayName} onChange={(e) => update({ displayName: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-headline"><LocalizedText text={"Headline"} /></Label>
              <Input id="p-headline" value={form.headline} onChange={(e) => update({ headline: e.target.value })} placeholder={translateUi("e.g. AI Product Lead · ex-Google")} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="p-country"><LocalizedText text={"Country"} /></Label>
              <CountryCombobox
                id="p-country"
                value={form.country}
                onChange={(country) => update({ country })}
                placeholder="Search and choose a country…"
              />
              <p className="text-[11.5px] text-zinc-400">
                <LocalizedText text={"Pick from the list — or type a custom region."} />
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-languages"><LocalizedText text={"Languages"} /><span className="font-normal text-zinc-400"><LocalizedText text={"(comma-separated)"} /></span></Label>
              <Input
                id="p-languages"
                value={form.languages.join(", ")}
                onChange={(e) => update({ languages: e.target.value.split(",").map((l) => l.trim()).filter(Boolean) })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="p-website"><LocalizedText text={"Website"} /></Label>
            <Input id="p-website" value={form.website} onChange={(e) => update({ website: e.target.value })} placeholder={translateUi("https://…")} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="p-bio"><LocalizedText text={"Bio"} /></Label>
            <Textarea id="p-bio" value={form.bio} onChange={(e) => update({ bio: e.target.value })} className="min-h-32" />
            <p className="text-[11.5px] text-zinc-400">{form.bio.length}<LocalizedText text={"characters · shown on your public profile"} /></p>
          </div>

        </section>

        {/* Live preview */}
        <aside className="space-y-3">
          <p className="text-[11px] font-bold tracking-[0.1em] text-zinc-400 uppercase"><LocalizedText text={"Public preview"} /></p>
          <div className="rounded-xl border border-border bg-gradient-to-br from-muted/70 to-white p-5 shadow-card">
            <div className="flex items-center gap-3.5">
              <Avatar className="size-14 ring-2 ring-white shadow-sm">
                {form.avatar && <AvatarImage src={form.avatar} alt={translateUi(form.displayName)} />}
                <AvatarFallback className={cn("text-base font-bold", form.avatarColor)}>
                  <LocalizedText text={displayInitials} />
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-display text-[16px] font-bold tracking-tight"><LocalizedText text={form.displayName || "Your name"} /></p>
                <p className="text-[12.5px] text-muted-foreground"><LocalizedText text={form.headline || "Your headline"} /></p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
              {form.country && (
                <span className="flex items-center gap-1">
                  <MapPin className="size-3 text-zinc-400" aria-hidden />
                  <LocalizedText text={form.country} />
                </span>
              )}
              {form.languages.length > 0 && (
                <span className="flex items-center gap-1">
                  <Globe2 className="size-3 text-zinc-400" aria-hidden />
                  <LocalizedText text={form.languages.join(", ")} />
                </span>
              )}
            </div>
            <p className="mt-3 line-clamp-4 text-[12.5px] leading-relaxed text-muted-foreground">
              <LocalizedText text={form.bio || "Tell learners who you are and what you teach."} />
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[
                { label: "Rating", value: stats.rating.toFixed(1) },
                { label: "Students", value: formatCompact(stats.students) },
                { label: "Courses", value: String(stats.courses) },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-border bg-white px-2 py-2.5">
                  <p className="font-display text-[15px] font-bold tabular-nums"><LocalizedText text={s.value} /></p>
                  <p className="text-[10.5px] text-muted-foreground"><LocalizedText text={s.label} /></p>
                </div>
              ))}
            </div>
          </div>
          <p className="text-[11.5px] leading-relaxed text-zinc-400"><LocalizedText text={"Statistics come from the shared catalog data. In this preview, the public instructor page shows the seed profile; your edits are stored locally for the next phases."} /></p>
        </aside>
      </div>
    </div>
  );
}
