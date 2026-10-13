"use client";

import { LocalizedText, useTranslate } from "@/components/providers/localized-text";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { BellRing, ChevronRight, Trash2 } from "lucide-react";
import { useCreator } from "@/components/providers/creator-provider";
import { useApp } from "@/components/providers/app-providers";
import { clearSessionNamespace, useLocalStorage } from "@/lib/hooks";
import { getDictionary } from "@/lib/i18n";
import { PLATFORM_COMMISSION, PAYOUT_THRESHOLD_USD, moneyExact } from "@/lib/creator";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const DEFAULTS = { newSale: true, newReview: true, reviewUpdates: true, weeklyDigest: false, productNews: false };

export default function CreatorSettingsPage() {
  const translateUi = useTranslate();
  const router = useRouter();
  const { payoutSettings, savePayoutSettings, profile } = useCreator();
  const { user, signIn, language } = useApp();
  const d = getDictionary(language);
  const prefs = useLocalStorage("zybble.creator.prefs.v1", DEFAULTS);
  const [threshold, setThreshold] = useState(payoutSettings?.threshold ?? PAYOUT_THRESHOLD_USD);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const items = [
    { key: "newSale" as const, title: d.notifNewSale, text: d.notifNewSaleDesc },
    { key: "newReview" as const, title: d.notifNewReview, text: d.notifNewReviewDesc },
    { key: "reviewUpdates" as const, title: d.notifReviewUpdates, text: d.notifReviewUpdatesDesc },
    { key: "weeklyDigest" as const, title: d.notifWeeklyDigest, text: d.notifWeeklyDigestDesc },
    { key: "productNews" as const, title: d.notifProductNews, text: d.notifProductNewsDesc },
  ];
  return <div className="mx-auto max-w-2xl space-y-6 pb-4">
    <header><p className="text-[11px] font-bold uppercase tracking-widest text-primary"><LocalizedText text={d.creatorStudio} /></p><h1 className="font-display mt-2 text-3xl font-bold"><LocalizedText text={d.settingsTitle} /></h1><p className="mt-2 text-sm text-muted-foreground"><LocalizedText text={"Manage your studio, notifications and creator account."} /></p></header>
    <section className="rounded-xl border border-border bg-white p-6 shadow-card"><h2 className="flex items-center gap-2 font-display font-semibold"><BellRing className="size-4.5 text-primary" /><LocalizedText text={d.emailNotifications} /></h2><ul className="mt-4 space-y-1">{items.map((item) => <li key={item.key}><label className="flex cursor-pointer items-start gap-3 rounded-lg p-2.5 hover:bg-muted/60"><Checkbox className="mt-0.5" checked={prefs.value[item.key]} onCheckedChange={(v) => prefs.set((prev) => ({ ...prev, [item.key]: v === true }))} /><span><span className="block text-sm font-medium"><LocalizedText text={item.title} /></span><span className="block text-xs text-muted-foreground"><LocalizedText text={item.text} /></span></span></label></li>)}</ul></section>
    <section className="rounded-xl border border-border bg-white p-6 shadow-card"><h2 className="font-display font-semibold"><LocalizedText text={d.marketplaceTerms} /></h2><dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-4 border-b border-border pb-3"><dt className="text-muted-foreground"><LocalizedText text={d.platformCommission} /></dt><dd className="font-semibold"><LocalizedText text={d.commissionValue(Math.round(PLATFORM_COMMISSION * 100))} /></dd></div><div className="flex flex-wrap items-center justify-between gap-3"><dt className="text-muted-foreground"><LocalizedText text={d.payoutThreshold} /></dt><dd className="flex items-center gap-2"><Input type="number" min={PAYOUT_THRESHOLD_USD} value={threshold} aria-label={translateUi(d.payoutThreshold)} onChange={(e) => setThreshold(Math.max(PAYOUT_THRESHOLD_USD, Number(e.target.value)))} className="w-24 text-right" /><Button variant="outline" size="sm" disabled={!payoutSettings || threshold === payoutSettings.threshold} onClick={() => { if (payoutSettings) { savePayoutSettings({ ...payoutSettings, threshold }); toast.success(d.thresholdSaved(moneyExact(threshold))); } }}><LocalizedText text={d.save} /></Button></dd></div></dl><Link href="/creator/payouts" className="mt-4 inline-flex items-center text-sm font-medium text-primary hover:underline"><LocalizedText text={d.managePayout} /><ChevronRight className="size-4" /></Link></section>
    <section className="rounded-xl border border-red-200 bg-white p-6"><h2 className="font-display font-semibold text-destructive"><LocalizedText text={d.dangerZone} /></h2><p className="mt-3 text-sm leading-relaxed text-muted-foreground"><LocalizedText text={d.deleteCreatorAccountDesc} /></p><Button variant="destructive" className="mt-5" onClick={() => setDeleteOpen(true)}><Trash2 /><LocalizedText text={d.deleteCreatorAccount} /></Button></section>
    <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}><DialogContent className="max-w-md"><DialogHeader><DialogTitle><LocalizedText text={d.deleteDialogTitle} /></DialogTitle><DialogDescription><LocalizedText text={d.deleteDialogBody} /></DialogDescription></DialogHeader><p className="rounded-lg bg-muted p-3 text-sm font-medium"><LocalizedText text={profile.displayName} /> · {user?.email}</p><DialogFooter><Button variant="outline" onClick={() => setDeleteOpen(false)}><LocalizedText text={d.cancel} /></Button><Button variant="destructive" onClick={() => { if (!user) return; clearSessionNamespace("zybble.creator."); signIn({ ...user, role: "learner" }); setDeleteOpen(false); toast.success(d.creatorDeleted); router.replace("/"); }}><LocalizedText text={d.deleteConfirm} /></Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
