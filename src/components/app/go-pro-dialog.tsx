"use client";

import { Check, Sparkles } from "lucide-react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * The Pro upsell, shown when a Free account reaches a wall.
 *
 * A dialog rather than an inline panel because the thing being blocked is an
 * action the user just took: interrupting that action needs an answer, not a
 * notice they can scroll past. It always offers a way out — either the caller's
 * fallback ("save as draft instead") or simply closing — so nobody is trapped
 * behind a paywall with their work unsaved.
 *
 * Every benefit listed here is a real entitlement; see
 * `PLAN_ENTITLEMENTS` in src/features/billing/entitlements.ts. Nothing on this
 * card is aspirational.
 */

export type GoProDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** The specific limit that was hit, e.g. how many posts are used. */
  limitNote?: string;
  /** Escape hatch, so the user is never stuck with unsaved work. */
  fallback?: { label: string; onClick: () => void };
};

const BENEFITS = [
  "Unlimited scheduled posts",
  "Up to 5 LinkedIn accounts per workspace",
  "12 months of analytics history instead of 7 days",
  "Best-time insights from your own posting history",
  "Up to 3 workspaces, with team collaboration",
];

export function GoProDialog({
  open,
  onOpenChange,
  title,
  description,
  limitNote,
  fallback,
}: GoProDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-[13px] font-medium text-brand-700 ring-1 ring-brand-100">
            <Sparkles className="size-3.5" aria-hidden />
            Zybble Pro
          </span>
          <DialogTitle className="mt-3">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {limitNote && (
          <p className="mt-1 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[13px] leading-6 text-amber-900 ring-1 ring-amber-200">
            {limitNote}
          </p>
        )}

        <ul className="mt-4 space-y-2.5">
          {BENEFITS.map((benefit) => (
            <li key={benefit} className="flex items-start gap-2.5">
              <Check className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
              <span className="text-[14px] leading-6 text-slate-700">{benefit}</span>
            </li>
          ))}
        </ul>

        <DialogFooter className="mt-6">
          {fallback && (
            <Button variant="secondary" onClick={fallback.onClick}>
              {fallback.label}
            </Button>
          )}
          <Button asChild>
            <Link href="/settings/billing">Upgrade to Pro</Link>
          </Button>
        </DialogFooter>

        <p className="mt-3 text-xs leading-5 text-slate-500">
          $15 per seat / month. Billed per workspace, and nothing is charged until you confirm.
        </p>
      </DialogContent>
    </Dialog>
  );
}
