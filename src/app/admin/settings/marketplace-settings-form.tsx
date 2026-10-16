"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { saveMarketplaceSettings } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_COMMISSION_BPS, MIN_COMMISSION_BPS } from "@/lib/money";

interface Settings {
  marketplaceName: string;
  marketplaceDescription: string;
  commissionBps: number;
  autoApproveFreeCourses: boolean;
  autoApproveReturningCreators: boolean;
  emailReviewDecisions: boolean;
  requirePayoutApproval: boolean;
  supportEmail: string | null;
  updatedAt: string | null;
}

const TOGGLES: Array<{ key: keyof Settings & ("autoApproveFreeCourses" | "autoApproveReturningCreators" | "emailReviewDecisions" | "requirePayoutApproval"); label: string; hint: string }> = [
  {
    key: "autoApproveFreeCourses",
    label: "Auto-approve free courses",
    hint: "Off by default. When on, a free course with at least one lesson is published without a human decision.",
  },
  {
    key: "autoApproveReturningCreators",
    label: "Auto-approve returning creators",
    hint: "Publishes submissions from creators who already have a published course.",
  },
  {
    key: "emailReviewDecisions",
    label: "Email creators about review decisions",
    hint: "Sends the approval, changes-requested and rejected emails through Resend.",
  },
  {
    key: "requirePayoutApproval",
    label: "Require admin approval before manual payouts",
    hint: "Every creator payout request is reviewed by an administrator and confirmed with a bank/UPI UTR reference.",
  },
];

export function MarketplaceSettingsForm({ settings }: { settings: Settings }) {
  const router = useRouter();
  const [form, setForm] = React.useState({
    marketplaceName: settings.marketplaceName,
    marketplaceDescription: settings.marketplaceDescription,
    commissionBps: settings.commissionBps,
    autoApproveFreeCourses: settings.autoApproveFreeCourses,
    autoApproveReturningCreators: settings.autoApproveReturningCreators,
    emailReviewDecisions: settings.emailReviewDecisions,
    requirePayoutApproval: settings.requirePayoutApproval,
    supportEmail: settings.supportEmail ?? "",
  });
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const commissionPercent = form.commissionBps / 100;
  const tooLow = form.commissionBps < MIN_COMMISSION_BPS;
  const tooHigh = form.commissionBps > MAX_COMMISSION_BPS;

  return (
    <section className="rounded-xl border border-border bg-white p-5 shadow-card">
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          setBusy(true);
          setMessage(null);
          setError(null);
          void saveMarketplaceSettings({ ...form, commissionBps: Number(form.commissionBps) })
            .then((result) => {
              if (!result.ok) setError(result.error ?? "Could not save settings");
              else {
                setMessage(result.message ?? "Saved");
                router.refresh();
              }
            })
            .finally(() => setBusy(false));
        }}
      >
        <div>
          <Label htmlFor="ms-name" className="mb-1.5 block text-[13px]">Marketplace name</Label>
          <Input id="ms-name" required maxLength={60} value={form.marketplaceName} onChange={(e) => setForm({ ...form, marketplaceName: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="ms-email" className="mb-1.5 block text-[13px]">Support email</Label>
          <Input id="ms-email" type="email" value={form.supportEmail} onChange={(e) => setForm({ ...form, supportEmail: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="ms-desc" className="mb-1.5 block text-[13px]">Description</Label>
          <Textarea id="ms-desc" rows={2} maxLength={400} value={form.marketplaceDescription} onChange={(e) => setForm({ ...form, marketplaceDescription: e.target.value })} />
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="ms-commission" className="mb-1.5 block text-[13px]">
            Zybble commission (%)
          </Label>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              id="ms-commission"
              type="number"
              step="0.01"
              min={MIN_COMMISSION_BPS / 100}
              max={MAX_COMMISSION_BPS / 100}
              value={commissionPercent}
              onChange={(e) => setForm({ ...form, commissionBps: Math.round(Number(e.target.value) * 100) })}
              className="max-w-32"
              aria-describedby="ms-commission-hint"
            />
            <p id="ms-commission-hint" className="text-[12.5px] text-muted-foreground">
              Stored as {form.commissionBps} basis points and snapshotted onto every order item at checkout.
            </p>
          </div>
          {tooLow || tooHigh ? (
            <p className="mt-1 text-[12px] text-red-600">
              Commission must be between {MIN_COMMISSION_BPS / 100}% and {MAX_COMMISSION_BPS / 100}%.
            </p>
          ) : null}
          {settings.commissionBps !== form.commissionBps ? (
            <p className="mt-1 text-[12px] text-amber-700">
              Orders already placed keep {settings.commissionBps / 100}%. Only new orders use this rate.
            </p>
          ) : null}
        </div>

        <fieldset className="space-y-3 sm:col-span-2">
          <legend className="text-[13px] font-medium">Moderation and payouts</legend>
          {TOGGLES.map((toggle) => (
            <div key={toggle.key} className="rounded-lg border border-border px-3.5 py-3">
              <label className="flex cursor-pointer items-center gap-2.5 text-[13px] font-medium">
                <input
                  type="checkbox"
                  checked={Boolean(form[toggle.key])}
                  onChange={(e) => setForm({ ...form, [toggle.key]: e.target.checked })}
                  className="size-4 accent-[var(--primary)]"
                />
                {toggle.label}
              </label>
              <p className="mt-1 pl-6.5 text-[12px] text-muted-foreground">{toggle.hint}</p>
            </div>
          ))}
        </fieldset>

        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Button type="submit" disabled={busy || tooLow || tooHigh}>
            {busy ? "Saving…" : "Save settings"}
          </Button>
          {message ? <span className="text-[12.5px] text-emerald-700">{message}</span> : null}
          {error ? <span className="text-[12.5px] text-red-600">{error}</span> : null}
        </div>
        {settings.updatedAt ? (
          <p className="text-[11.5px] text-zinc-400 sm:col-span-2">
            Last updated {new Date(settings.updatedAt).toLocaleString("en-IN")}
          </p>
        ) : null}
      </form>
    </section>
  );
}