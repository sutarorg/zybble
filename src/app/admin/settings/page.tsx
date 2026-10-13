"use client";

import { LocalizedText, useTranslate } from "@/components/providers/localized-text";
import * as React from "react";
import { useState } from "react";
import type { AdminSettings } from "@/types";
import { toast } from "sonner";
import {
  BadgePercent,
  Banknote,
  Globe,
  Info,
  LayoutGrid,
  RotateCcw,
  Save,
  Settings2,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { CATEGORIES } from "@/data/mock-data";
import { useAdmin } from "@/components/providers/admin-provider";
import { DEFAULT_COMMISSION_RATE } from "@/lib/admin";
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

export default function AdminSettingsPage() {
  const translateUi = useTranslate();
  const { hydrated, settings, saveSettings, categories, resetAdminData } = useAdmin();
  /* Derived draft: follows the persisted settings until the operator edits a field. */
  const [formDraft, setFormDraft] = useState<AdminSettings | null>(null);
  const form = formDraft ?? settings;
  const setForm = (next: AdminSettings) => setFormDraft(next);
  const [saving, setSaving] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  if (!hydrated) return <Skeleton className="h-96 rounded-xl" />;

  const dirty = JSON.stringify(form) !== JSON.stringify(settings);

  const save = () => {
    if (form.marketplaceName.trim().length < 2) {
      toast.error("Marketplace name is required.");
      return;
    }
    if (form.commissionRate < 0 || form.commissionRate > 0.5) {
      toast.error("Commission must be between 0% and 50%.");
      return;
    }
    setSaving(true);
    window.setTimeout(() => {
      saveSettings(form);
      setSaving(false);
      toast.success("Platform settings saved (local preview)");
    }, 500);
  };

  const percent = Math.round((form.commissionRate || DEFAULT_COMMISSION_RATE) * 1000) / 10;

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold tracking-[0.14em] text-primary uppercase"><LocalizedText text={"Admin Portal"} /></p>
          <h1 className="font-display mt-1.5 text-[26px] font-bold tracking-tight sm:text-3xl"><LocalizedText text={"Platform settings"} /></h1>
          <p className="mt-1.5 text-[14px] text-muted-foreground"><LocalizedText text={"Marketplace configuration for the preview. Stored locally — never sent anywhere."} /></p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={!dirty} onClick={() => setForm(settings)}><LocalizedText text={"Discard"} /></Button>
          <Button onClick={save} loading={saving} disabled={!dirty}>
            <Save aria-hidden /><LocalizedText text={"Save settings"} /></Button>
        </div>
      </div>

      {/* Marketplace */}
      <section className="rounded-xl border border-border bg-white p-5 shadow-card sm:p-6">
        <h2 className="flex items-center gap-2 font-display text-[15.5px] font-semibold">
          <Globe className="size-4.5 text-primary" aria-hidden /><LocalizedText text={"Marketplace"} /></h2>
        <div className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="set-name"><LocalizedText text={"Marketplace name"} /></Label>
            <Input
              id="set-name"
              value={form.marketplaceName}
              onChange={(e) => setForm({ ...form, marketplaceName: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="set-desc"><LocalizedText text={"Marketplace description"} /></Label>
            <Input
              id="set-desc"
              value={form.marketplaceDescription}
              onChange={(e) => setForm({ ...form, marketplaceDescription: e.target.value })}
            />
            <p className="text-[11.5px] text-zinc-400"><LocalizedText text={"Shown in metadata and marketing copy (display-only in this preview)."} /></p>
          </div>
          <div className="max-w-56 space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Banknote className="size-4 text-zinc-400" aria-hidden /><LocalizedText text={"Display currency"} /></Label>
            <Select
              value={form.currency}
              onValueChange={(v) => setForm({ ...form, currency: v as typeof form.currency })}
            >
              <SelectTrigger aria-label={translateUi("Display currency")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD"><LocalizedText text={"USD — US Dollar"} /></SelectItem>
                <SelectItem value="EUR"><LocalizedText text={"EUR — Euro"} /></SelectItem>
                <SelectItem value="GBP"><LocalizedText text={"GBP — British Pound"} /></SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11.5px] text-zinc-400"><LocalizedText text={"Display preference only — all sample data is seeded in USD."} /></p>
          </div>
        </div>
      </section>

      {/* Commission */}
      <section className="rounded-xl border border-border bg-white p-5 shadow-card sm:p-6">
        <h2 className="flex items-center gap-2 font-display text-[15.5px] font-semibold">
          <BadgePercent className="size-4.5 text-primary" aria-hidden /><LocalizedText text={"Marketplace commission"} /></h2>
        <div className="mt-4 max-w-56 space-y-1.5">
          <Label htmlFor="set-commission"><LocalizedText text={"Commission rate (% of gross sales)"} /></Label>
          <div className="relative">
            <Input
              id="set-commission"
              type="number"
              min={0}
              max={50}
              step={0.5}
              value={Math.round(form.commissionRate * 1000) / 10}
              onChange={(e) => setForm({ ...form, commissionRate: Math.min(0.5, Math.max(0, Number(e.target.value) / 100)) })}
              className="pr-7"
            />
            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-zinc-400">%</span>
          </div>
        </div>
        <div className="mt-3 rounded-lg border border-violet-200 bg-accent p-3.5 text-[12.5px] leading-relaxed text-violet-950/75"><LocalizedText text={"Example with current rate: on a $20.00 sale, Zybble keeps"} /><LocalizedText text={" "} />
          <strong>$<LocalizedText text={(20 * form.commissionRate).toFixed(2)} /></strong><LocalizedText text={"and the creator earns"} /><LocalizedText text={" "} />
          <strong>$<LocalizedText text={(20 * (1 - form.commissionRate)).toFixed(2)} /></strong><LocalizedText text={"before payment fees, taxes, refunds or adjustments. Orders & analytics recompute from this value."} /></div>
      </section>

      {/* Moderation preferences */}
      <section className="rounded-xl border border-border bg-white p-5 shadow-card sm:p-6">
        <h2 className="flex items-center gap-2 font-display text-[15.5px] font-semibold">
          <ShieldCheck className="size-4.5 text-primary" aria-hidden /><LocalizedText text={"Moderation preferences"} /></h2>
        <ul className="mt-4 space-y-1">
          {(
            [
              { key: "autoApproveFreeCourses", title: "Auto-approve free courses", text: "Free submissions skip the review queue (simulated rule)." },
              { key: "autoApproveReturningCreators", title: "Fast-track returning creators", text: "Creators with 2+ published courses get priority review." },
              { key: "emailReviewDecisions", title: "Email creators on decisions", text: "Approve / changes / rejected by email. No emails really send." },
              { key: "requirePayoutApproval", title: "Manual payout approval", text: "Every payout needs an admin decision (recommended)." },
            ] as const
          ).map((item) => (
            <li key={item.key}>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60">
                <Checkbox
                  className="mt-0.5"
                  checked={Boolean(form[item.key])}
                  onCheckedChange={(v) => setForm({ ...form, [item.key]: v === true })}
                />
                <span>
                  <span className="block text-[13.5px] font-medium"><LocalizedText text={item.title} /></span>
                  <span className="block text-[12px] text-muted-foreground"><LocalizedText text={item.text} /></span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      {/* Category visibility */}
      <section className="rounded-xl border border-border bg-white p-5 shadow-card sm:p-6">
        <h2 className="flex items-center gap-2 font-display text-[15.5px] font-semibold">
          <LayoutGrid className="size-4.5 text-primary" aria-hidden /><LocalizedText text={"Supported categories"} /></h2>
        <p className="mt-1 text-[12.5px] text-muted-foreground"><LocalizedText text={"Toggle which categories are advertised in the store chrome (portal summary — local)."} /></p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {CATEGORIES.map((cat) => {
            const hidden = form.hiddenCategorySlugs.includes(cat.slug);
            const adminCat = categories.find((c) => c.slug === cat.slug);
            return (
              <label
                key={cat.slug}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors",
                  hidden ? "border-border bg-muted/40 opacity-70" : "border-border bg-muted/30 hover:border-zinc-300"
                )}
              >
                <Checkbox
                  checked={!hidden}
                  onCheckedChange={(v) =>
                    setForm({
                      ...form,
                      hiddenCategorySlugs: v === true
                        ? form.hiddenCategorySlugs.filter((s) => s !== cat.slug)
                        : [...form.hiddenCategorySlugs, cat.slug],
                    })
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium"><LocalizedText text={cat.name} /></span>
                  <span className="block text-[11px] text-zinc-400">
                    {adminCat?.courseCount ?? 0}<LocalizedText text={"courses"} />{adminCat && !adminCat.visible ? "· hidden in portal too" : ""}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </section>

      {/* Config summary */}
      <section className="rounded-xl border border-border bg-muted/40 p-5">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold">
          <Settings2 className="size-4 text-zinc-400" aria-hidden /><LocalizedText text={"Configuration summary (display-only)"} /></h2>
        <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-[12.5px] sm:grid-cols-2">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground"><LocalizedText text={"Environment"} /></dt>
            <dd className="font-medium"><LocalizedText text={"Preview (localStorage)"} /></dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground"><LocalizedText text={"Commission"} /></dt>
            <dd className="font-medium tabular-nums">{percent}%</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground"><LocalizedText text={"Visible categories"} /></dt>
            <dd className="font-medium tabular-nums">{CATEGORIES.length - settings.hiddenCategorySlugs.length}/{CATEGORIES.length}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground"><LocalizedText text={"Payout workflow"} /></dt>
            <dd className="font-medium">{settings.requirePayoutApproval ? "Manual approval" : "Auto-approve"}</dd>
          </div>
        </dl>
        <p className="mt-3 flex items-start gap-1.5 text-[11.5px] text-zinc-400">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden /><LocalizedText text={"No secrets, credentials or payment tokens exist anywhere in this portal — settings are UI state only."} /></p>
      </section>

      {/* Danger zone */}
      <section className="rounded-xl border border-red-200 bg-white p-5 shadow-card sm:p-6">
        <h2 className="font-display text-[15.5px] font-semibold text-destructive"><LocalizedText text={"Danger zone"} /></h2>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-sm text-[13px] text-muted-foreground"><LocalizedText text={"Reset admin data: users, payouts, categories, reports, hidden reviews, notes, activity and settings back to initial states."} /></p>
          <Button
            variant="outline"
            className="border-red-200 text-destructive hover:bg-red-50 hover:text-destructive"
            onClick={() => setResetOpen(true)}
          >
            <RotateCcw aria-hidden /><LocalizedText text={"Reset admin data"} /></Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-red-100 pt-4">
          <p className="max-w-sm text-[13px] text-muted-foreground"><LocalizedText text={"Nuke everything: clears all Zybble keys (admin, creator and learner) and reloads from a clean slate."} /></p>
          <Button
            variant="destructive"
            onClick={() => {
              Object.keys(window.localStorage)
                .filter((k) => k.startsWith("zybble."))
                .forEach((k) => window.localStorage.removeItem(k));
              window.location.href = "/";
            }}
          >
            <Trash2 aria-hidden /><LocalizedText text={"Reset all sample data"} /></Button>
        </div>
      </section>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle><LocalizedText text={"Reset admin portal data?"} /></DialogTitle>
            <DialogDescription><LocalizedText text={"All admin-local changes revert to the initial states. Your creator studio and learner data are untouched."} /></DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}><LocalizedText text={"Cancel"} /></Button>
            <Button
              variant="destructive"
              onClick={() => {
                resetAdminData();
                setResetOpen(false);
                toast.success("Admin data reset to seeds");
              }}
            ><LocalizedText text={"Reset admin data"} /></Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
