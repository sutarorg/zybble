"use client";

import * as React from "react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BellRing,
  Check,
  ChevronRight,
  Globe,
  LogOut,
  RotateCcw,
  Save,
  Target,
  Trash2,
  UserRound,
} from "lucide-react";
import { useApp } from "@/components/providers/app-providers";
import { LANGUAGES } from "@/data/mock-data";
import { getDictionary } from "@/lib/i18n";
import { initialsOf } from "@/lib/format";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
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

export default function LearnerSettingsPage() {
  const router = useRouter();
  const {
    hydrated,
    user,
    signIn,
    signOut,
    learnerPrefs,
    setLearnerPrefs,
    language,
    setLanguage,
    resetLearnerData,
  } = useApp();

  /* `null` = untouched, so the field follows the stored profile without an
     effect once hydration completes. */
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const name = nameDraft ?? user?.name ?? "";

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8" aria-busy>
        <Skeleton className="h-9 w-56" />
        <Skeleton className="mt-6 h-96 rounded-xl" />
      </div>
    );
  }

  const nameDirty = user ? name.trim() !== user.name : false;

  const saveProfile = () => {
    if (name.trim().length < 2) {
      toast.error("Please enter your name.");
      return;
    }
    setSavingProfile(true);
    window.setTimeout(() => {
      const email = user?.email ?? `${name.trim().split(" ")[0].toLowerCase()}@zybble.demo`;
      signIn({ id: user?.id ?? `usr_${Date.now()}`, name: name.trim(), email, initials: initialsOf(name.trim()) });
      setSavingProfile(false);
      toast.success("Profile saved (locally)");
    }, 400);
  };

  const prefs: { key: keyof typeof learnerPrefs; title: string; text: string }[] = [
    { key: "emailCourseUpdates", title: "Course updates", text: "New lessons and announcements from your courses." },
    { key: "weeklyReport", title: "Weekly learning report", text: "Your progress summary every Monday morning." },
    { key: "studyReminders", title: "Study reminders", text: "Gentle nudges to keep your streak alive." },
    { key: "emailPromos", title: "Promotions", text: "Price drops and launches in the catalog." },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-7 pb-12 sm:px-6 sm:py-9 lg:px-8">
      <div>
        <p className="text-[11px] font-bold tracking-[0.14em] text-primary uppercase">Settings</p>
        <h1 className="font-display mt-1.5 text-[26px] font-bold tracking-tight sm:text-3xl">
          Learner preferences
        </h1>
        <p className="mt-1.5 text-[14px] text-muted-foreground">
          Profile, goals and notifications — all stored locally on this device.
        </p>
      </div>

      {/* Profile */}
      <section className="rounded-xl border border-border bg-white p-5 shadow-card sm:p-6">
        <h2 className="flex items-center gap-2 font-display text-[15.5px] font-semibold">
          <UserRound className="size-4.5 text-primary" aria-hidden />
          Profile
        </h2>
        <div className="mt-4 flex items-center gap-4">
          <Avatar className="size-14 ring-1 ring-border">
            <AvatarFallback className="bg-primary text-sm text-white">
              {initialsOf(name || "Z L")}
            </AvatarFallback>
          </Avatar>
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">
            Your learner identity for this demo. Signed in as{" "}
            <span className="font-medium text-foreground">{user?.email ?? "guest (demo)"}</span>.
          </p>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="ls-name">Display name</Label>
            <Input
              id="ls-name"
              value={name}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
            />
          </div>
          <div className="flex items-end">
            <Button onClick={saveProfile} loading={savingProfile} disabled={!nameDirty}>
              <Save aria-hidden />
              Save
            </Button>
          </div>
        </div>
      </section>

      {/* Learning goal */}
      <section className="rounded-xl border border-border bg-white p-5 shadow-card sm:p-6">
        <h2 className="flex items-center gap-2 font-display text-[15.5px] font-semibold">
          <Target className="size-4.5 text-primary" aria-hidden />
          Daily learning goal
        </h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {GOALS.map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={learnerPrefs.goalMinutesPerDay === g}
              onClick={() => {
                setLearnerPrefs({ goalMinutesPerDay: g });
                toast.success(`Daily goal set to ${g} minutes`);
              }}
              className={cn(
                "flex h-11 cursor-pointer items-center gap-1.5 rounded-full border px-4 text-[13px] font-medium transition-all sm:h-10",
                learnerPrefs.goalMinutesPerDay === g
                  ? "border-primary bg-primary text-white shadow-sm"
                  : "border-border bg-white text-muted-foreground hover:border-zinc-300 hover:text-foreground"
              )}
            >
              {learnerPrefs.goalMinutesPerDay === g && <Check className="size-3.5" aria-hidden />}
              {g} min
            </button>
          ))}
        </div>
        <p className="mt-2 text-[12px] text-zinc-400">Shown as the streak panel in your sidebar (simulated).</p>
      </section>

      {/* Language */}
      <section className="rounded-xl border border-border bg-white p-5 shadow-card sm:p-6">
        <h2 className="flex items-center gap-2 font-display text-[15.5px] font-semibold">
          <Globe className="size-4.5 text-primary" aria-hidden />
          {getDictionary(language).interfaceLanguage}
        </h2>
        <div className="mt-4 max-w-xs">
          <Select
            value={language}
            onValueChange={(v) => {
              setLanguage(v);
              toast.success(getDictionary(v).languageChanged(LANGUAGES.find((l) => l.code === v)?.label ?? v));
            }}
          >
            <SelectTrigger aria-label={getDictionary(language).interfaceLanguage}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => (
                <SelectItem key={l.code} value={l.code}>
                  {l.native} ({l.label})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* Notifications */}
      <section className="rounded-xl border border-border bg-white p-5 shadow-card sm:p-6">
        <h2 className="flex items-center gap-2 font-display text-[15.5px] font-semibold">
          <BellRing className="size-4.5 text-primary" aria-hidden />
          Email preferences
        </h2>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          Illustrative — no emails are ever sent from this demo.
        </p>
        <ul className="mt-3 space-y-1">
          {prefs.map((item) => (
            <li key={item.key}>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60">
                <Checkbox
                  className="mt-0.5"
                  checked={Boolean(learnerPrefs[item.key])}
                  onCheckedChange={(v) => setLearnerPrefs({ [item.key]: v === true })}
                />
                <span>
                  <span className="block text-[13.5px] font-medium">{item.title}</span>
                  <span className="block text-[12px] text-muted-foreground">{item.text}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      {/* Shortcuts */}
      <section className="rounded-xl border border-border bg-white p-2 shadow-card">
        {[
          { href: "/orders", label: "Order history", text: "Receipts and simulated purchases" },
          { href: "/help", label: "Help Center", text: "FAQs and support" },
        ].map((link) => (
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

      {/* Account actions */}
      <section className="rounded-xl border border-border bg-white p-5 shadow-card sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-[15.5px] font-semibold">Sign out</h2>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">Your data stays on this device.</p>
          </div>
          {user ? (
            <Button
              variant="outline"
              onClick={() => {
                signOut();
                toast.success("Signed out");
                router.push("/");
              }}
            >
              <LogOut aria-hidden />
              Sign out
            </Button>
          ) : (
            <Button asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          )}
        </div>
      </section>

      {/* Danger zone */}
      <section className="rounded-xl border border-red-200 bg-white p-5 shadow-card sm:p-6">
        <h2 className="font-display text-[15.5px] font-semibold text-destructive">Danger zone</h2>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-sm text-[13px] text-muted-foreground">
            Clears your enrollments, progress, orders, notes, certificates, wishlist and preferences.
            Creator studio data is untouched.
          </p>
          <Button
            variant="outline"
            className="border-red-200 text-destructive hover:bg-red-50 hover:text-destructive"
            onClick={() => setResetOpen(true)}
          >
            <Trash2 aria-hidden />
            Reset learner data
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-red-100 pt-4">
          <p className="max-w-sm text-[13px] text-muted-foreground">
            Nuke everything: clears all Zybble keys (learner and creator) and reloads from a clean
            slate.
          </p>
          <Button
            variant="destructive"
            onClick={() => {
              Object.keys(window.localStorage)
                .filter((k) => k.startsWith("zybble."))
                .forEach((k) => window.localStorage.removeItem(k));
              window.location.href = "/";
            }}
          >
            <RotateCcw aria-hidden />
            Reset all demo data
          </Button>
        </div>
      </section>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset learner data?</DialogTitle>
            <DialogDescription>
              Your courses-in-progress, orders and notes will be removed from this browser. You can
              re-enroll any time — this only affects the demo state.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                resetLearnerData();
                setResetOpen(false);
                toast.success("Learner data cleared");
                router.push("/");
              }}
            >
              Reset learner data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
