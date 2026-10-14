"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { saveCreatorPreferences } from "@/app/creator/actions";
import { Button } from "@/components/ui/button";

const DEFAULT_PREFS = {
  goalMinutesPerDay: 30,
  emailCourseUpdates: true,
  emailPromos: false,
  weeklyReport: true,
  studyReminders: false,
};

export function CreatorSettingsForm() {
  const router = useRouter();
  const [prefs, setPrefs] = React.useState(DEFAULT_PREFS);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    const result = await saveCreatorPreferences(prefs)
      .then((value) => value)
      .catch(() => ({ ok: false, error: "Could not save" }) as Awaited<ReturnType<typeof saveCreatorPreferences>>);
    setBusy(false);
    if (!result.ok) setError(result.error ?? "Could not save your preferences");
    else {
      setMessage(result.message ?? "Saved");
      router.refresh();
    }
  }

  const toggles = [
    { key: "emailCourseUpdates", label: "Email me about updates to courses I bought" },
    { key: "emailPromos", label: "Send me occasional Zybble news" },
    { key: "weeklyReport", label: "Weekly learner activity summary" },
    { key: "studyReminders", label: "Study reminders" },
  ] as const;

  return (
    <section className="rounded-xl border border-border bg-white p-5 shadow-card">
      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <label htmlFor="goal" className="mb-1.5 block text-[13px] font-medium">
            Daily learning goal
          </label>
          <div className="flex items-center gap-3">
            <input
              id="goal"
              type="range"
              min={5}
              max={180}
              step={5}
              value={prefs.goalMinutesPerDay}
              onChange={(event) => setPrefs({ ...prefs, goalMinutesPerDay: Number(event.target.value) })}
              className="w-64 accent-[var(--primary)]"
            />
            <span className="text-[13px] tabular-nums">{prefs.goalMinutesPerDay} min / day</span>
          </div>
        </div>

        <fieldset className="space-y-2.5">
          <legend className="mb-2 text-[13px] font-medium">Email</legend>
          {toggles.map((toggle) => (
            <label key={toggle.key} className="flex cursor-pointer items-center gap-2.5 text-[13px]">
              <input
                type="checkbox"
                checked={prefs[toggle.key]}
                onChange={(event) => setPrefs({ ...prefs, [toggle.key]: event.target.checked })}
                className="size-4 accent-[var(--primary)]"
              />
              {toggle.label}
            </label>
          ))}
        </fieldset>

        <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save preferences"}</Button>
        {error ? <p className="text-[13px] text-red-600">{error}</p> : null}
        {message ? <p className="text-[13px] text-emerald-700">{message}</p> : null}
      </form>
    </section>
  );
}