"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BellRing, BookOpenCheck, Save } from "lucide-react";
import { saveCreatorPreferences } from "@/app/creator/actions";
import type { CreatorStudioPreferences } from "@/lib/server/creator";
import { rupeesInputFromPaise } from "@/lib/creator";
import { TEACHING_LANGUAGES } from "@/lib/config/catalog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * What each alert switch actually controls. The copy names the events, because
 * "notifications" that nobody can map to something that happened are the reason
 * people turn them all off.
 */
const ALERTS = [
  {
    key: "emailNewEnrollment",
    title: "New enrollments",
    text: "A learner's payment is captured and your balance grows.",
    on: "Enrollment alerts turned on",
    off: "Enrollment alerts turned off",
  },
  {
    key: "emailNewReview",
    title: "New reviews",
    text: "A learner publishes a rating or written review of your course.",
    on: "Review alerts turned on",
    off: "Review alerts turned off",
  },
  {
    key: "emailModeration",
    title: "Moderation decisions",
    text: "Submissions, approvals, requested changes and rejections.",
    on: "Moderation emails turned on",
    off: "Moderation emails turned off",
  },
  {
    key: "emailPayoutUpdates",
    title: "Payout updates",
    text: "Requests, approvals, UTR references and failures.",
    on: "Payout emails turned on",
    off: "Payout emails turned off",
  },
] as const;

type AlertKey = (typeof ALERTS)[number]["key"];

const LEVELS: Array<{ value: CreatorStudioPreferences["defaultCourseLevel"]; label: string }> = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

const RUPEES = /^\d{1,9}(\.\d{1,2})?$/;

interface SavedState {
  alerts: {
    emailNewEnrollment: boolean;
    emailNewReview: boolean;
    emailModeration: boolean;
    emailPayoutUpdates: boolean;
    notifyInApp: boolean;
  };
  language: string;
  level: CreatorStudioPreferences["defaultCourseLevel"];
  priceRupees: string;
}

/** The form's view of one settings row, in the shape it submits. */
function snapshot(preferences: CreatorStudioPreferences): SavedState {
  return {
    alerts: {
      emailNewEnrollment: preferences.emailNewEnrollment,
      emailNewReview: preferences.emailNewReview,
      emailModeration: preferences.emailModeration,
      emailPayoutUpdates: preferences.emailPayoutUpdates,
      notifyInApp: preferences.notifyInApp,
    },
    language: preferences.defaultCourseLanguage,
    level: preferences.defaultCourseLevel,
    priceRupees: rupeesInputFromPaise(preferences.defaultPricePaise),
  };
}

export function CreatorSettingsForm({ preferences }: { preferences: CreatorStudioPreferences }) {
  const router = useRouter();
  const [alerts, setAlerts] = React.useState({
    emailNewEnrollment: preferences.emailNewEnrollment,
    emailNewReview: preferences.emailNewReview,
    emailModeration: preferences.emailModeration,
    emailPayoutUpdates: preferences.emailPayoutUpdates,
    notifyInApp: preferences.notifyInApp,
  });
  const [language, setLanguage] = React.useState(preferences.defaultCourseLanguage);
  const [level, setLevel] = React.useState<CreatorStudioPreferences["defaultCourseLevel"]>(
    preferences.defaultCourseLevel
  );
  const [priceRupees, setPriceRupees] = React.useState(rupeesInputFromPaise(preferences.defaultPricePaise));
  const [saving, setSaving] = React.useState<"alerts" | "defaults" | null>(null);

  // The last state the server accepted. A failed save rolls back to it, so the
  // form can never show a setting the database does not hold. This is state
  // rather than a ref because the rollback and the dirty check both render.
  const [saved, setSaved] = React.useState(() => snapshot(preferences));

  const priceValid = RUPEES.test(priceRupees.trim());
  const defaultsDirty =
    language !== saved.language || level !== saved.level || priceRupees.trim() !== saved.priceRupees;

  /**
   * Writes the whole settings row. Each group sends the *saved* value of the
   * other group, so a half-typed price cannot block an alert toggle and vice
   * versa.
   */
  const persist = React.useCallback(
    async (
      group: "alerts" | "defaults",
      next: SavedState,
      message: string
    ) => {
      setSaving(group);
      try {
        const result = await saveCreatorPreferences({
          ...next.alerts,
          defaultCourseLanguage: next.language,
          defaultCourseLevel: next.level,
          defaultPriceRupees: next.priceRupees,
        });
        if (!result.ok) {
          // Roll the UI back to what the server actually holds.
          setAlerts(saved.alerts);
          setLanguage(saved.language);
          setLevel(saved.level);
          setPriceRupees(saved.priceRupees);
          toast.error(result.error ?? "Could not save your studio settings");
          return;
        }
        setSaved(next);
        toast.success(result.message ?? message);
        router.refresh();
      } catch {
        toast.error("Could not save your studio settings");
      } finally {
        setSaving(null);
      }
    },
    [router, saved]
  );

  const toggleAlert = (key: AlertKey | "notifyInApp", next: boolean, message: string) => {
    const nextAlerts = { ...alerts, [key]: next };
    setAlerts(nextAlerts);
    void persist("alerts", { ...saved, alerts: nextAlerts }, message);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-white p-5 shadow-card sm:p-6">
        <h2 className="flex items-center gap-2 font-display text-[15.5px] font-semibold">
          <BellRing className="size-4.5 text-primary" aria-hidden /> Studio alerts
        </h2>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          What Zybble tells you about, and where. Turning email off never hides the record — payouts stay on the
          Payouts page and reviews stay in Reviews.
        </p>

        <ul className="mt-3 space-y-1">
          {ALERTS.map((item) => (
            <li key={item.key}>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60">
                <Checkbox
                  className="mt-0.5"
                  checked={alerts[item.key]}
                  disabled={saving !== null}
                  onCheckedChange={(value) => toggleAlert(item.key, value === true, value === true ? item.on : item.off)}
                />
                <span>
                  <span className="block text-[13.5px] font-medium">{item.title}</span>
                  <span className="block text-[12px] text-muted-foreground">{item.text}</span>
                </span>
                <span className="ml-auto self-center text-[11px] text-zinc-400">Email</span>
              </label>
            </li>
          ))}

          <li className="border-t border-border pt-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60">
              <Checkbox
                className="mt-0.5"
                checked={alerts.notifyInApp}
                disabled={saving !== null}
                onCheckedChange={(value) =>
                  toggleAlert(
                    "notifyInApp",
                    value === true,
                    value === true ? "In-app notifications turned on" : "In-app notifications turned off"
                  )
                }
              />
              <span>
                <span className="block text-[13.5px] font-medium">In-app notifications</span>
                <span className="block text-[12px] text-muted-foreground">
                  The same events in the studio bell, whether or not email is on.
                </span>
              </span>
              <span className="ml-auto self-center text-[11px] text-zinc-400">Bell</span>
            </label>
          </li>
        </ul>

        <p className="mt-2 text-[12px] text-zinc-400" role="status" aria-live="polite">
          {saving === "alerts" ? "Saving…" : ""}
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-white p-5 shadow-card sm:p-6">
        <h2 className="flex items-center gap-2 font-display text-[15.5px] font-semibold">
          <BookOpenCheck className="size-4.5 text-primary" aria-hidden /> Defaults for new courses
        </h2>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          Prefilled every time you start a course. Each field stays editable on the course itself, and an existing
          course is never rewritten by a change here.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cs-language">Taught in</Label>
            <select
              id="cs-language"
              value={language}
              disabled={saving !== null}
              onChange={(event) => {
                const next = event.target.value;
                setLanguage(next);
                void persist("defaults", { ...saved, language: next }, "New-course defaults saved");
              }}
              className="h-9 w-full cursor-pointer rounded-md border border-input bg-white px-3 text-[13px] focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:outline-none"
            >
              {TEACHING_LANGUAGES.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
              {/* A language saved before this list existed must still be shown, not silently dropped. */}
              {!(TEACHING_LANGUAGES as readonly string[]).includes(language) ? (
                <option value={language}>{language}</option>
              ) : null}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cs-level">Level</Label>
            <select
              id="cs-level"
              value={level}
              disabled={saving !== null}
              onChange={(event) => {
                const next = event.target.value as CreatorStudioPreferences["defaultCourseLevel"];
                setLevel(next);
                void persist("defaults", { ...saved, level: next }, "New-course defaults saved");
              }}
              className="h-9 w-full cursor-pointer rounded-md border border-input bg-white px-3 text-[13px] focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:outline-none"
            >
              {LEVELS.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="cs-price">Default price (₹)</Label>
            <div className="flex flex-wrap items-end gap-3">
              <Input
                id="cs-price"
                inputMode="decimal"
                className="max-w-[180px]"
                value={priceRupees}
                disabled={saving !== null}
                onChange={(event) => setPriceRupees(event.target.value)}
                onBlur={() => {
                  if (!priceValid || !defaultsDirty) return;
                  void persist(
                    "defaults",
                    { ...saved, language, level, priceRupees: priceRupees.trim() },
                    "New-course defaults saved"
                  );
                }}
                aria-invalid={!priceValid}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                loading={saving === "defaults"}
                disabled={!defaultsDirty || !priceValid || saving !== null}
                onClick={() =>
                  void persist(
                    "defaults",
                    { ...saved, language, level, priceRupees: priceRupees.trim() },
                    "New-course defaults saved"
                  )
                }
              >
                <Save aria-hidden /> Save defaults
              </Button>
            </div>
            <p
              className={cn(
                "text-[11.5px] leading-relaxed",
                priceValid ? "text-zinc-400" : "text-red-600"
              )}
            >
              {priceValid
                ? "Rupees and paise, for example 1499 or 1499.00. Use 0 for a free course."
                : "Enter an amount in rupees with at most two decimals."}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
