"use client";

import { Check, CreditCard, FileText, ReceiptText } from "lucide-react";
import Link from "next/link";
import { SettingsNav } from "@/components/app/settings-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Tooltip } from "@/components/ui/tooltip";
import { useClientMounted, useLocalPosts } from "@/lib/app/hooks";
import { countScheduledThisMonth } from "@/lib/app/local-posts";
import { cn } from "@/lib/utils";

const FREE_FEATURES = [
  "1 LinkedIn account",
  "10 scheduled posts per month",
  "Unlimited drafts",
  "7-day basic analytics",
  "Content calendar",
];
const PRO_FEATURES = [
  "Up to 5 LinkedIn accounts per workspace",
  "Unlimited scheduled posts",
  "12-month advanced analytics",
  "Best-time-to-post insights",
  "Team collaboration",
];

export default function BillingSettingsPage() {
  const posts = useLocalPosts();
  const mounted = useClientMounted();
  const used = mounted ? countScheduledThisMonth(posts) : null;

  return (
    <div className="mx-auto max-w-4xl">
      <SettingsNav />
      <div className="space-y-6">
        {/* Plans */}
        <section aria-label="Plans" className="grid gap-4 sm:grid-cols-2">
          {/* Free — current */}
          <article className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Free</h2>
              <Badge variant="neutral">Current plan</Badge>
            </div>
            <p className="mt-3 flex items-baseline gap-1.5">
              <span className="text-3xl font-semibold tracking-tight text-slate-950">$0</span>
              <span className="text-sm text-slate-500">/ month</span>
            </p>
            <ul className="mt-5 space-y-2.5">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-[13px] leading-5 text-slate-600">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-brand-600" aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-500">
                Scheduled posts used this month (local preview):{" "}
                <span className="font-semibold tabular-nums text-slate-700">
                  {used === null ? "…" : `${used} / 10`}
                </span>
              </p>
            </div>
          </article>

          {/* Pro — upgrade */}
          <article className="relative rounded-2xl bg-white p-6 shadow-panel ring-2 ring-brand-600">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Pro</h2>
              <Badge variant="brand-solid">Recommended</Badge>
            </div>
            <p className="mt-3 flex items-baseline gap-1.5">
              <span className="text-3xl font-semibold tracking-tight text-slate-950">$15</span>
              <span className="text-sm text-slate-500">/ seat / month</span>
            </p>
            <ul className="mt-5 space-y-2.5">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-[13px] leading-5 text-slate-600">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-brand-600" aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-5 border-t border-slate-100 pt-4">
              <Tooltip content="Checkout (Dodo Payments) activates with the billing release — you won't be charged today.">
                <span className="block">
                  <Button className="w-full" asChild>
                    <Link href="/signup?plan=pro">Get started with Pro</Link>
                  </Button>
                </span>
              </Tooltip>
              <p className="mt-2.5 text-center text-xs leading-5 text-slate-400">
                Cancel anytime · keep Pro until the period ends · no card stored by Zybble
              </p>
            </div>
          </article>
        </section>

        {/* Payment method + invoices — honest empties */}
        <div className="grid gap-6 sm:grid-cols-2">
          <section aria-labelledby="payment-heading" className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-xs">
            <h2 id="payment-heading" className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
              <CreditCard className="size-4 text-brand-600" aria-hidden />
              Payment method
            </h2>
            <div className="mt-4">
              <EmptyState
                compact
                icon={CreditCard}
                title="No payment method"
                description="The Free plan needs no card. When you upgrade, checkout is handled by our payment provider — Zybble never stores card numbers."
              />
            </div>
          </section>

          <section aria-labelledby="invoices-heading" className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-xs">
            <h2 id="invoices-heading" className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
              <ReceiptText className="size-4 text-brand-600" aria-hidden />
              Billing history
            </h2>
            <div className="mt-4">
              <EmptyState
                compact
                icon={FileText}
                title="No invoices yet"
                description="Invoices for Pro seats appear here with PDF downloads, newest first."
              />
            </div>
          </section>
        </div>

        {/* Subscription state */}
        <section
          aria-label="Subscription status"
          className={cn("rounded-2xl bg-slate-50 p-6 ring-1 ring-slate-200")}
        >
          <h2 className="text-sm font-semibold text-slate-900">Subscription status</h2>
          <dl className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            <div className="flex justify-between sm:block">
              <dt className="text-slate-500">Plan</dt>
              <dd className="font-medium text-slate-800">Free</dd>
            </div>
            <div className="flex justify-between sm:block">
              <dt className="text-slate-500">Status</dt>
              <dd className="font-medium text-slate-800">Active (no billing)</dd>
            </div>
            <div className="flex justify-between sm:block">
              <dt className="text-slate-500">Seats</dt>
              <dd className="font-medium tabular-nums text-slate-800">1</dd>
            </div>
            <div className="flex justify-between sm:block">
              <dt className="text-slate-500">Renews</dt>
              <dd className="font-medium text-slate-800">— (nothing to renew)</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
