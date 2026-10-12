"use client";

import * as React from "react";
import { useState } from "react";
import { toast } from "sonner";
import { BellRing, ChevronRight, Info, RotateCcw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCreator } from "@/components/providers/creator-provider";
import { useLocalStorage } from "@/lib/hooks";
import { PLATFORM_COMMISSION, PAYOUT_THRESHOLD_USD, moneyExact } from "@/lib/creator";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const PREF_DEFAULTS = {
  newSale: true,
  newReview: true,
  reviewUpdates: true,
  weeklyDigest: false,
  productNews: false,
};

const PREF_ITEMS: { key: keyof typeof PREF_DEFAULTS; title: string; text: string }[] = [
  { key: "newSale", title: "New sale", text: "Every time a learner enrolls in a paid course." },
  { key: "newReview", title: "New review", text: "When a student leaves a rating on your course." },
  { key: "reviewUpdates", title: "Review queue updates", text: "Status changes on courses you submitted." },
  { key: "weeklyDigest", title: "Weekly digest", text: "A Monday summary of students, revenue and ratings." },
  { key: "productNews", title: "Product news", text: "Occasional updates about creator features." },
];

export default function CreatorSettingsPage() {
  const { hydrated, payoutSettings, savePayoutSettings, resetCreatorData, profile } = useCreator();
  const prefs = useLocalStorage<typeof PREF_DEFAULTS>("zybble.creator.prefs.v1", PREF_DEFAULTS);
  const [thresholdDraft, setThresholdDraft] = useState<number | null>(null);
  const threshold = thresholdDraft ?? payoutSettings?.threshold ?? PAYOUT_THRESHOLD_USD;
  const setThreshold = setThresholdDraft;
  const [resetOpen, setResetOpen] = useState(false);

  if (!hydrated) {
    return (
      <div aria-busy>
        <Skeleton className="h-9 w-56" />
        <Skeleton className="mt-6 h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-4">
      <div>
        <p className="text-[11px] font-bold tracking-[0.14em] text-primary uppercase">Creator Studio</p>
        <h1 className="font-display mt-1.5 text-[26px] font-bold tracking-tight sm:text-3xl">Settings</h1>
        <p className="mt-1.5 text-[14px] text-muted-foreground">
          Studio preferences — stored locally for {profile.displayName}.
        </p>
      </div>

      {/* Notifications */}
      <section className="rounded-xl border border-border bg-white p-5 shadow-card sm:p-6">
        <h2 className="flex items-center gap-2 font-display text-[15.5px] font-semibold">
          <BellRing className="size-4.5 text-primary" aria-hidden />
          Email notifications
        </h2>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          Illustrative preferences — no emails are sent in this demo.
        </p>
        <ul className="mt-4 space-y-1">
          {PREF_ITEMS.map((item) => (
            <li key={item.key}>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60">
                <Checkbox
                  className="mt-0.5"
                  checked={prefs.value[item.key]}
                  onCheckedChange={(v) => prefs.set((p) => ({ ...p, [item.key]: v === true }))}
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

      {/* Marketplace terms */}
      <section className="rounded-xl border border-border bg-white p-5 shadow-card sm:p-6">
        <h2 className="font-display text-[15.5px] font-semibold">Marketplace terms</h2>
        <dl className="mt-3 space-y-2.5 text-[13.5px]">
          <div className="flex items-center justify-between border-b border-border pb-2.5">
            <dt className="text-muted-foreground">Platform commission</dt>
            <dd className="font-semibold tabular-nums">{Math.round(PLATFORM_COMMISSION * 100)}% of gross sales</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">Payout threshold (USD)</dt>
            <dd className="flex items-center gap-2">
              <Input
                type="number"
                min={PAYOUT_THRESHOLD_USD}
                step={10}
                value={threshold}
                aria-label="Payout threshold"
                onChange={(e) => setThreshold(Math.max(PAYOUT_THRESHOLD_USD, Number(e.target.value)))}
                className="h-8.5 w-24 text-right tabular-nums"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!payoutSettings || payoutSettings.threshold === threshold}
                onClick={() => {
                  if (payoutSettings) {
                    savePayoutSettings({ ...payoutSettings, threshold });
                    toast.success(`Threshold updated to ${moneyExact(threshold)} (demo)`);
                  }
                }}
              >
                Save
              </Button>
            </dd>
          </div>
        </dl>
        <Link
          href="/creator/payouts"
          className="mt-3 flex w-fit items-center gap-0.5 text-[13px] font-medium text-primary hover:underline"
        >
          Manage payout method
          <ChevronRight className="size-3.5" aria-hidden />
        </Link>
      </section>

      {/* Demo info */}
      <section className="rounded-xl border border-violet-200 bg-accent p-5">
        <p className="flex items-start gap-2 text-[13px] leading-relaxed text-violet-950/75">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <span>
            <span className="font-semibold text-violet-950">About this demo studio.</span> Courses,
            finances and settings persist in your browser&apos;s localStorage. Published courses you
            create appear publicly in Explore on this device; drafts and pending courses stay private
            to the studio.
          </span>
        </p>
      </section>

      {/* Danger zone */}
      <section className="rounded-xl border border-red-200 bg-white p-5 shadow-card sm:p-6">
        <h2 className="font-display text-[15.5px] font-semibold text-destructive">Danger zone</h2>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-sm text-[13px] text-muted-foreground">
            Reset the creator studio to its original demo seed: removes your courses, drafts,
            replies, payout data and settings. Learner data (wishlist, enrollments) is untouched.
          </p>
          <Button
            variant="outline"
            className={cn("border-red-200 text-destructive hover:bg-red-50 hover:text-destructive")}
            onClick={() => setResetOpen(true)}
          >
            <RotateCcw aria-hidden />
            Reset studio data
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-red-100 pt-4">
          <p className="max-w-sm text-[13px] text-muted-foreground">
            Nuke everything: clears all Zybble keys (creator and learner) and reloads the app from a
            clean slate.
          </p>
          <Button
            variant="destructive"
            onClick={() => {
              Object.keys(window.localStorage)
                .filter((k) => k.startsWith("zybble."))
                .forEach((k) => window.localStorage.removeItem(k));
              window.location.href = "/explore";
            }}
          >
            <Trash2 aria-hidden />
            Reset all demo data
          </Button>
        </div>
      </section>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset creator studio?</DialogTitle>
            <DialogDescription>
              Your local courses, drafts, replies and payout records will be replaced with the
              original demo seed. This only affects this browser.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                resetCreatorData();
                setResetOpen(false);
                toast.success("Creator studio reset to demo seed");
              }}
            >
              Reset studio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
