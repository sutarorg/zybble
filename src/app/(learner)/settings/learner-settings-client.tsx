"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BadgeCheck,
  BellRing,
  Check,
  ChevronRight,
  Globe,
  LogOut,
  MailWarning,
  Save,
  ShieldAlert,
  Target,
  Trash2,
  UserRound,
} from "lucide-react";
import {
  requestAccountDeletion,
  resendVerificationEmail,
  updateLearnerPreferences,
  updateProfile,
} from "@/app/(learner)/actions";
import { signOutAction } from "@/app/(auth)/actions";
import { useApp } from "@/components/providers/app-providers";
import { LANGUAGES } from "@/lib/config/catalog";
import { getDictionary } from "@/lib/i18n";
import { AvatarUpload } from "@/components/creator/avatar-upload";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const GOALS = [15, 30, 45, 60, 90, 120];

/**
 * Optional email, keyed to the `learner_preferences` column it controls. Each
 * entry names what turning it on actually causes — see `EMAIL_CONSENT` in
 * `src/lib/server/email.ts` for the templates each key gates.
 */
const PREFS = [
  {
    key: "emailCourseUpdates",
    title: "Course updates",
    text: "New lessons and announcements from courses you are enrolled in.",
    on: "Course update emails turned on",
    off: "Course update emails turned off",
  },
  {
    key: "weeklyReport",
    title: "Weekly learning report",
    text: "Your progress summary, sent every Monday morning.",
    on: "Weekly learning report turned on",
    off: "Weekly learning report turned off",
  },
  {
    key: "studyReminders",
    title: "Study reminders",
    text: "A daily nudge on the days you have not completed a lesson.",
    on: "Study reminders turned on",
    off: "Study reminders turned off",
  },
  {
    key: "emailPromos",
    title: "Promotions",
    text: "Price drops and new launches in the catalog.",
    on: "Catalog promotion emails turned on",
    off: "Catalog promotion emails turned off",
  },
] as const;

type Preferences = {
  goalMinutesPerDay: number;
  emailCourseUpdates: boolean;
  emailPromos: boolean;
  weeklyReport: boolean;
  studyReminders: boolean;
};

export function LearnerSettingsClient({
  accountName,
  accountEmail,
  emailVerified,
  avatarKey,
  preferences,
  shortcuts,
}: {
  accountName: string;
  accountEmail: string;
  emailVerified: boolean;
  avatarKey: string | null;
  preferences: Preferences;
  shortcuts: Array<{ href: string; label: string; text: string }>;
}) {
  const router = useRouter();
  const { language, setLanguage } = useApp();

  const [name, setName] = React.useState(accountName);
  const [savedName, setSavedName] = React.useState(accountName);
  const [savingProfile, setSavingProfile] = React.useState(false);
  const [prefs, setPrefs] = React.useState(preferences);
  const [savingPrefs, setSavingPrefs] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [resending, setResending] = React.useState(false);

  // The last value the server accepted. A failed save rolls back to this rather
  // than to the original props, so one rejected toggle cannot undo an earlier
  // change that did persist. State, not a ref: the rollback has to render.
  const [savedPrefs, setSavedPrefs] = React.useState(preferences);

  const nameDirty = name.trim() !== savedName.trim();

  const persistPrefs = React.useCallback(
    (next: Preferences, message: string) => {
      setSavingPrefs(true);
      void updateLearnerPreferences(next)
        .then((result) => {
          if (!result.ok) {
            setPrefs(savedPrefs);
            toast.error(result.error ?? "Could not save your preferences");
            return;
          }
          setSavedPrefs(next);
          toast.success(result.message ?? message);
        })
        .finally(() => setSavingPrefs(false));
    },
    [savedPrefs]
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-7 pb-12 sm:px-6 sm:py-9 lg:px-8">
      <div>
        <p className="text-[11px] font-bold tracking-[0.14em] text-primary uppercase">Settings</p>
        <h1 className="font-display mt-1.5 text-[26px] font-bold tracking-tight sm:text-3xl">Learner preferences</h1>
        <p className="mt-1.5 text-[14px] text-muted-foreground">
          Your profile and preferences live in your Zybble account, not in this browser.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-white p-5 shadow-card sm:p-6">
        <h2 className="flex items-center gap-2 font-display text-[15.5px] font-semibold">
          <UserRound className="size-4.5 text-primary" aria-hidden /> Profile
        </h2>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <AvatarUpload avatarKey={avatarKey} name={name} onUploaded={() => router.refresh()} />

          <div className="min-w-0">
            <p className="text-[12.5px] leading-relaxed text-muted-foreground">
              Signed in as <span className="font-medium text-foreground break-anywhere">{accountEmail}</span>
            </p>
            <p className="mt-1 text-[11.5px] text-zinc-400">
              Click your photo to change it · JPEG, PNG or WebP up to 5 MB
            </p>
            {emailVerified ? (
              <p className="mt-1.5 inline-flex items-center gap-1.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-medium text-emerald-800">
                <BadgeCheck className="size-3" aria-hidden /> Email verified
              </p>
            ) : (
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <p className="inline-flex items-center gap-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
                  <ShieldAlert className="size-3" aria-hidden /> Email not verified yet
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  loading={resending}
                  onClick={() => {
                    setResending(true);
                    void resendVerificationEmail()
                      .then((result) => {
                        if (!result.ok) {
                          toast.error(result.error ?? "Could not send the verification email");
                          return;
                        }
                        toast.success(result.message ?? "Verification email sent", {
                          description: result.message ? undefined : `Check ${accountEmail}`,
                        });
                        router.refresh();
                      })
                      .finally(() => setResending(false));
                  }}
                >
                  <MailWarning aria-hidden /> Resend verification email
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="ls-name">Display name</Label>
            <Input id="ls-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
          </div>
          <div className="flex items-end">
            <Button
              loading={savingProfile}
              disabled={!nameDirty}
              onClick={() => {
                setSavingProfile(true);
                void updateProfile({ fullName: name.trim() })
                  .then((result) => {
                    if (!result.ok) {
                      toast.error(result.error ?? "Could not save your profile");
                      return;
                    }
                    setSavedName(name.trim());
                    toast.success(result.message ?? "Profile saved");
                    router.refresh();
                  })
                  .finally(() => setSavingProfile(false));
              }}
            >
              <Save aria-hidden /> Save
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-white p-5 shadow-card sm:p-6">
        <h2 className="flex items-center gap-2 font-display text-[15.5px] font-semibold">
          <Target className="size-4.5 text-primary" aria-hidden /> Daily learning goal
        </h2>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          Shown in your sidebar and used to pace your study reminders.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {GOALS.map((goal) => (
            <button
              key={goal}
              type="button"
              aria-pressed={prefs.goalMinutesPerDay === goal}
              disabled={savingPrefs}
              onClick={() => {
                if (prefs.goalMinutesPerDay === goal) return;
                const next = { ...prefs, goalMinutesPerDay: goal };
                setPrefs(next);
                persistPrefs(next, `Daily goal set to ${goal} minutes`);
              }}
              className={cn(
                "flex h-11 items-center gap-1.5 rounded-full border px-4 text-[13px] font-medium transition-all sm:h-10",
                savingPrefs ? "cursor-wait" : "cursor-pointer",
                prefs.goalMinutesPerDay === goal
                  ? "border-primary bg-primary text-white shadow-sm"
                  : "border-border bg-white text-muted-foreground hover:border-zinc-300 hover:text-foreground"
              )}
            >
              {prefs.goalMinutesPerDay === goal ? <Check className="size-3.5" aria-hidden /> : null}
              {goal} min
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-white p-5 shadow-card sm:p-6">
        <h2 className="flex items-center gap-2 font-display text-[15.5px] font-semibold">
          <Globe className="size-4.5 text-primary" aria-hidden />
          {getDictionary(language).interfaceLanguage}
        </h2>
        <div className="mt-4 max-w-xs">
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger aria-label="Interface language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((entry) => (
                <SelectItem key={entry.code} value={entry.code}>
                  {entry.native} ({entry.label})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="mt-2 text-[12px] text-zinc-400">
          Interface language only. Course content stays in the language its creator taught it in, and every price is
          always shown in rupees.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-white p-5 shadow-card sm:p-6">
        <h2 className="flex items-center gap-2 font-display text-[15.5px] font-semibold">
          <BellRing className="size-4.5 text-primary" aria-hidden /> Email preferences
        </h2>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          Transactional email such as receipts, certificates and moderation decisions is always sent. These control
          the optional messages, and each change is saved as soon as you make it.
        </p>
        <ul className="mt-3 space-y-1">
          {PREFS.map((item) => (
            <li key={item.key}>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60">
                <Checkbox
                  className="mt-0.5"
                  checked={prefs[item.key]}
                  disabled={savingPrefs}
                  onCheckedChange={(value) => {
                    const enabled = value === true;
                    const next = { ...prefs, [item.key]: enabled } as Preferences;
                    setPrefs(next);
                    persistPrefs(next, enabled ? item.on : item.off);
                  }}
                />
                <span>
                  <span className="block text-[13.5px] font-medium">{item.title}</span>
                  <span className="block text-[12px] text-muted-foreground">{item.text}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12px] text-zinc-400" role="status" aria-live="polite">
          {savingPrefs ? "Saving…" : ""}
        </p>
      </section>

      <section className="rounded-xl border border-border bg-white p-2 shadow-card">
        {shortcuts.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center justify-between rounded-lg px-3 py-3 transition-colors hover:bg-muted"
          >
            <span>
              <span className="block text-[13.5px] font-medium">{link.label}</span>
              <span className="block text-[12px] text-muted-foreground">{link.text}</span>
            </span>
            <ChevronRight className="size-4 text-zinc-300" aria-hidden />
          </Link>
        ))}
      </section>

      <section className="rounded-xl border border-border bg-white p-5 shadow-card sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-[15.5px] font-semibold">Sign out</h2>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              Your courses, orders and progress stay on your account.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              void signOutAction().then(() => {
                router.push("/");
                router.refresh();
              });
            }}
          >
            <LogOut aria-hidden /> Sign out
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-red-200 bg-white p-5 shadow-card sm:p-6">
        <h2 className="font-display text-[15.5px] font-semibold text-destructive">Close your account</h2>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-sm text-[13px] text-muted-foreground">
            Your profile is deactivated, access is revoked and every session ends. Order and payment records are
            retained because Indian accounting rules require it.
          </p>
          <Button
            variant="outline"
            className="border-red-200 text-destructive hover:bg-red-50 hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 aria-hidden /> Close account
          </Button>
        </div>
      </section>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Close your Zybble account?</DialogTitle>
            <DialogDescription>
              This revokes your course access and signs you out everywhere. Financial records for orders you placed
              are retained for accounting. This cannot be undone from the browser.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() => {
                setDeleting(true);
                void requestAccountDeletion().then((result) => {
                  setDeleting(false);
                  if (!result.ok) {
                    toast.error(result.error ?? "Could not close your account");
                    setDeleteOpen(false);
                    return;
                  }
                  toast.success("Your account has been closed");
                  router.push("/");
                });
              }}
            >
              {deleting ? "Closing…" : "Close my account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
