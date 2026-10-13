"use client";

import { LocalizedText, useTranslate } from "@/components/providers/localized-text";
import * as React from "react";
import { useState } from "react";
import { toast } from "sonner";
import {
  BadgeCheck,
  Building,
  CircleAlert,
  Clock3,
  Landmark,
  Pencil,
  Wallet,
} from "lucide-react";
import { useCreator } from "@/components/providers/creator-provider";
import { moneyExact, PAYOUT_THRESHOLD_USD } from "@/lib/creator";
import { formatDate } from "@/lib/format";
import { StatCard } from "@/components/creator/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { PayoutSettings } from "@/types";
import { cn } from "@/lib/utils";

export default function PayoutsPage() {
  const translateUi = useTranslate();
  const { hydrated, payouts, payoutSettings, savePayoutSettings, requestPayout, finances, profile } =
    useCreator();

  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  /* settings form state */
  const [method, setMethod] = useState<PayoutSettings["method"]>("bank");
  const [accountName, setAccountName] = useState("");
  const [details, setDetails] = useState("");
  const [threshold, setThreshold] = useState(PAYOUT_THRESHOLD_USD);

  const openEdit = () => {
    setMethod(payoutSettings?.method ?? "bank");
    setAccountName(payoutSettings?.accountName ?? profile.displayName);
    setDetails(payoutSettings?.details ?? "");
    setThreshold(payoutSettings?.threshold ?? PAYOUT_THRESHOLD_USD);
    setEditOpen(true);
  };

  const saveSettings = () => {
    if (accountName.trim().length < 2 || details.trim().length < 4) {
      toast.error("Please complete the payout account details.");
      return;
    }
    savePayoutSettings({ method, accountName: accountName.trim(), details: details.trim(), threshold });
    setEditOpen(false);
    toast.success("Payout settings saved ");
  };

  const canRequest =
    !!payoutSettings && finances.availableBalance >= (payoutSettings.threshold || PAYOUT_THRESHOLD_USD);
  const blockReason = !payoutSettings
    ? "Add a payout method first"
    : finances.availableBalance < (payoutSettings.threshold || PAYOUT_THRESHOLD_USD)
      ? `Available balance is below your ${moneyExact(payoutSettings.threshold || PAYOUT_THRESHOLD_USD)} threshold`
      : null;

  const doRequest = () => {
    setBusy(true);
    window.setTimeout(() => {
      const record = requestPayout(finances.availableBalance);
      setBusy(false);
      setConfirmOpen(false);
      toast.success(`Payout of ${moneyExact(record.amount)} requested — now “processing” (simulated)`);
    }, 900);
  };

  if (!hydrated) {
    return (
      <div aria-busy>
        <Skeleton className="h-9 w-56" />
        <Skeleton className="mt-6 h-96 rounded-xl" />
      </div>
    );
  }

  const lastPaid = payouts.find((p) => p.status === "paid");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold tracking-[0.14em] text-primary uppercase"><LocalizedText text={"Creator Studio"} /></p>
        <h1 className="font-display mt-1.5 text-[26px] font-bold tracking-tight sm:text-3xl"><LocalizedText text={"Payouts"} /></h1>
        <p className="mt-1.5 max-w-xl text-[14px] text-muted-foreground"><LocalizedText text={"Payout requests are simulated UI states — no real money can move in this preview."} /></p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={Wallet} label={translateUi("Available balance")} value={moneyExact(finances.availableBalance)} hint="ready to withdraw" />
        <StatCard icon={Clock3} label={translateUi("Processing")} value={moneyExact(finances.processingPayouts)} hint="1–3 business days" />
        <StatCard
          icon={BadgeCheck}
          label={translateUi("Last payout")}
          value={lastPaid ? moneyExact(lastPaid.amount) : "—"}
          hint={lastPaid ? lastPaid.period : "no payouts yet"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Payout method */}
        <section className="rounded-xl border border-border bg-white p-5 shadow-card lg:col-span-2">
          <div className="flex items-start justify-between">
            <h2 className="font-display text-[15.5px] font-semibold"><LocalizedText text={"Payout method"} /></h2>
            <Button variant="outline" size="sm" onClick={openEdit}>
              <Pencil aria-hidden />
              {payoutSettings ? "Edit" : "Set up"}
            </Button>
          </div>
          {payoutSettings ? (
            <div className="mt-4 rounded-xl border border-border bg-muted/40 p-4">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-white text-primary shadow-card">
                  {payoutSettings.method === "bank" ? (
                    <Building className="size-5" aria-hidden />
                  ) : (
                    <Landmark className="size-5" aria-hidden />
                  )}
                </span>
                <div>
                  <p className="text-[14px] font-semibold"><LocalizedText text={payoutSettings.accountName} /></p>
                  <p className="text-[12.5px] text-muted-foreground"><LocalizedText text={payoutSettings.details} /></p>
                </div>
              </div>
              <dl className="mt-4 space-y-1.5 border-t border-border pt-3 text-[12.5px]">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground"><LocalizedText text={"Method"} /></dt>
                  <dd className="font-medium capitalize">{payoutSettings.method === "bank" ? "Bank transfer" : "PayPal"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground"><LocalizedText text={"Payout threshold"} /></dt>
                  <dd className="font-medium tabular-nums"><LocalizedText text={moneyExact(payoutSettings.threshold)} /></dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground"><LocalizedText text={"Schedule"} /></dt>
                  <dd className="font-medium"><LocalizedText text={"Manual "} /></dd>
                </div>
              </dl>
            </div>
          ) : (
            <p className="mt-4 rounded-lg border border-dashed border-zinc-300 bg-muted/40 px-4 py-6 text-center text-[13px] text-muted-foreground"><LocalizedText text={"No payout method configured yet."} /></p>
          )}

          <Button className="mt-4 w-full" size="lg" disabled={!canRequest} onClick={() => setConfirmOpen(true)}><LocalizedText text={"Request payout"} /><LocalizedText text={canRequest ? ` · ${moneyExact(finances.availableBalance)}` : ""} />
          </Button>
          {blockReason && (
            <p className="mt-2 flex items-start gap-1.5 text-[12px] leading-relaxed text-zinc-400">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <LocalizedText text={blockReason} />
            </p>
          )}
        </section>

        {/* Payout history */}
        <section className="overflow-hidden rounded-xl border border-border bg-white shadow-card lg:col-span-3">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-display text-[15.5px] font-semibold"><LocalizedText text={"Payout history"} /></h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-140 text-left">
              <thead>
                <tr className="border-b border-border text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
                  <th className="py-3 pr-4 pl-5"><LocalizedText text={"Period"} /></th>
                  <th className="px-4 py-3"><LocalizedText text={"Reference"} /></th>
                  <th className="px-4 py-3"><LocalizedText text={"Method"} /></th>
                  <th className="px-4 py-3"><LocalizedText text={"Status"} /></th>
                  <th className="py-3 pr-5 pl-4 text-right"><LocalizedText text={"Amount"} /></th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="py-3 pr-4 pl-5">
                      <span className="block text-[13px] font-medium"><LocalizedText text={p.period} /></span>
                      <span className="text-[11.5px] text-zinc-400"><LocalizedText text={formatDate(p.requestedAt)} /></span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] text-muted-foreground"><LocalizedText text={p.reference} /></td>
                    <td className="px-4 py-3 text-[12.5px] text-muted-foreground"><LocalizedText text={p.method} /></td>
                    <td className="px-4 py-3">
                      {p.status === "paid" ? (
                        <Badge variant="emerald" className="gap-1">
                          <BadgeCheck aria-hidden /><LocalizedText text={"Paid"} /></Badge>
                      ) : (
                        <Badge variant="amber" className="gap-1">
                          <Clock3 aria-hidden /><LocalizedText text={"Processing"} /></Badge>
                      )}
                    </td>
                    <td className={cn("py-3 pr-5 pl-4 text-right text-[13px] font-semibold tabular-nums", p.status === "processing" && "text-amber-600")}>
                      <LocalizedText text={moneyExact(p.amount)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Edit settings dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle><LocalizedText text={"Payout method"} /></DialogTitle>
            <DialogDescription><LocalizedText text={"Mock settings — stored only in this browser. No real account is connected."} /></DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label><LocalizedText text={"Method"} /></Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PayoutSettings["method"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank"><LocalizedText text={"Bank transfer"} /></SelectItem>
                  <SelectItem value="paypal"><LocalizedText text={"PayPal"} /></SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="po-name"><LocalizedText text={"Account holder"} /></Label>
              <Input id="po-name" value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder={translateUi("Maya Lindqvist")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="po-details">{method === "bank" ? "IBAN / account (shown masked)" : "PayPal email"}</Label>
              <Input
                id="po-details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder={method === "bank" ? "SE35 •••• ••48 21" : "maya@example.com"}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="po-threshold"><LocalizedText text={"Payout threshold (USD)"} /></Label>
              <Input
                id="po-threshold"
                type="number"
                min={PAYOUT_THRESHOLD_USD}
                step={10}
                value={threshold}
                onChange={(e) => setThreshold(Math.max(PAYOUT_THRESHOLD_USD, Number(e.target.value)))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}><LocalizedText text={"Cancel"} /></Button>
            <Button onClick={saveSettings}><LocalizedText text={"Save settings"} /></Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm payout dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle><LocalizedText text={"Request payout of"} /><LocalizedText text={moneyExact(finances.availableBalance)} />?</DialogTitle>
            <DialogDescription><LocalizedText text={"This simulates a payout request to"} /><LocalizedText text={payoutSettings?.details ?? "your account"} /><LocalizedText text={". The amount moves from “available” to “processing” in this preview — no real money is transferred."} /></DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}><LocalizedText text={"Cancel"} /></Button>
            <Button onClick={doRequest} loading={busy}><LocalizedText text={"Confirm request"} /></Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
