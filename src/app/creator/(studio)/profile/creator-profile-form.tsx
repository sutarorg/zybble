"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveCreatorProfile } from "@/app/creator/actions";
import { UsernameField } from "@/components/creator/username-field";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  accountEmail: string;
  avatarKey: string | null;
  initial: {
    username: string;
    displayName: string;
    headline: string;
    bio: string;
    languages: string[];
    topics: string[];
    website: string;
  };
}

export function CreatorProfileForm({ accountEmail, initial }: Props) {
  const router = useRouter();
  const [form, setForm] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    const result = await saveCreatorProfile({
      ...form,
      languages: splitList(form.languages),
      topics: splitList(form.topics),
    })
      .then((value) => value)
      .catch(() => ({ ok: false, error: "Something went wrong. Please try again." }) as Awaited<ReturnType<typeof saveCreatorProfile>>);

    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Could not save your profile");
      toast.error(result.error ?? "Could not save your profile");
      return;
    }
    setMessage("Profile saved.");
    toast.success(result.message ?? "Profile saved");
    router.refresh();
  }

  return (
    <section className="rounded-2xl border border-border bg-white p-5 shadow-card">
      <h2 className="font-display text-[15px] font-semibold tracking-tight">Edit your profile</h2>
      <p className="mt-1 text-[12.5px] text-muted-foreground">
        Signed in as <span className="font-medium text-foreground">{accountEmail}</span>. Your learner account and
        enrollments are unaffected by these changes.
      </p>

      <form onSubmit={onSubmit} className="mt-5 grid gap-4 sm:grid-cols-2">
        <UsernameField
          id="cp-username"
          label="Username"
          value={form.username}
          onChange={(username) => setForm((current) => ({ ...current, username }))}
        />
        <div>
          <Label htmlFor="cp-display-name" className="mb-1.5 block text-[13px]">Display name</Label>
          <Input
            id="cp-display-name"
            required
            value={form.displayName}
            onChange={(event) => setForm({ ...form, displayName: event.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="cp-headline" className="mb-1.5 block text-[13px]">Headline</Label>
          <Input
            id="cp-headline"
            maxLength={140}
            placeholder="Automation engineer teaching n8n and AI agents"
            value={form.headline}
            onChange={(event) => setForm({ ...form, headline: event.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="cp-bio" className="mb-1.5 block text-[13px]">About</Label>
          <Textarea
            id="cp-bio"
            rows={6}
            maxLength={2000}
            value={form.bio}
            onChange={(event) => setForm({ ...form, bio: event.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="cp-languages" className="mb-1.5 block text-[13px]">Languages you teach in</Label>
          <Input
            id="cp-languages"
            placeholder="English, Hindi"
            value={form.languages.join(", ")}
            onChange={(event) => setForm({ ...form, languages: splitList(event.target.value) })}
          />
        </div>
        <div>
          <Label htmlFor="cp-topics" className="mb-1.5 block text-[13px]">Topics</Label>
          <Input
            id="cp-topics"
            placeholder="Automation, AI agents, APIs"
            value={form.topics.join(", ")}
            onChange={(event) => setForm({ ...form, topics: splitList(event.target.value) })}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="cp-website" className="mb-1.5 block text-[13px]">Website (optional)</Label>
          <Input
            id="cp-website"
            type="url"
            placeholder="https://example.com"
            value={form.website}
            onChange={(event) => setForm({ ...form, website: event.target.value })}
          />
        </div>

        <div className="sm:col-span-2">
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save profile"}</Button>
        </div>
        {error ? <p className="text-[13px] text-red-600 sm:col-span-2">{error}</p> : null}
        {message ? <p className="text-[13px] text-emerald-700 sm:col-span-2">{message}</p> : null}
      </form>
    </section>
  );
}

function splitList(value: string | string[]): string[] {
  if (Array.isArray(value)) return value.map((item) => item.trim()).filter(Boolean);
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}