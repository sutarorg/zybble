"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  IndianRupee,
  Loader2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { saveCourse } from "@/app/creator/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { inrPriceInputSchema } from "@/lib/course-wizard";
import { formatInr, MAX_PRICE_PAISE } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { CourseDetailsInitial } from "../../new/course-details-form";

const PRESET_PRICES = [499, 999, 1499, 1999, 2999, 4999];
const MAX_INR_RUPEES = Math.floor(MAX_PRICE_PAISE / 100);

export function PricingForm({
  initial,
  locked = false,
}: {
  initial: CourseDetailsInitial;
  locked?: boolean;
}) {
  const router = useRouter();
  const [priceMode, setPriceMode] = React.useState<"free" | "paid">(() =>
    Number(initial.priceRupees) > 0 ? "paid" : "free"
  );
  const [price, setPrice] = React.useState(() =>
    Number(initial.priceRupees) > 0 ? String(initial.priceRupees) : "999"
  );
  const [compare, setCompare] = React.useState(initial.compareAtRupees);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const effectivePriceString = priceMode === "free" ? "0" : price.trim();

  const parsedPrice = React.useMemo(() => {
    if (priceMode === "free") return { valid: true, paise: 0 };
    const parsed = inrPriceInputSchema.safeParse(effectivePriceString);
    if (!parsed.success) {
      return {
        valid: false,
        paise: 0,
        error: parsed.error.issues[0]?.message,
      };
    }
    if (parsed.data === 0) {
      return {
        valid: false,
        paise: 0,
        error: "Enter a price of ₹1 or more, or switch to Free enrollment.",
      };
    }
    return { valid: true, paise: parsed.data };
  }, [priceMode, effectivePriceString]);

  const parsedComparePaise = React.useMemo(() => {
    if (priceMode === "free" || !compare.trim()) return 0;
    const parsed = inrPriceInputSchema.safeParse(compare.trim());
    return parsed.success ? parsed.data : 0;
  }, [priceMode, compare]);

  async function persist(goNext: boolean) {
    setError(null);
    setMsg(null);
    if (locked) return;

    if (!parsedPrice.valid) {
      setError(parsedPrice.error ?? "Enter a valid INR price.");
      return;
    }

    setBusy(true);
    try {
      const r = await saveCourse({
        ...initial,
        priceRupees: effectivePriceString || "0",
        compareAtRupees:
          priceMode === "paid" && compare.trim() ? compare.trim() : undefined,
      }).catch(() => ({ ok: false, error: "Something went wrong." }));

      if (!r.ok) {
        setError(r.error ?? "Could not save pricing.");
        return;
      }

      setMsg("Pricing saved.");
      if (goNext && initial.id) {
        router.push(`/creator/courses/${initial.id}/publish`);
      } else {
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void persist(false);
      }}
      className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start"
    >
      <div className="space-y-5 rounded-2xl border border-border bg-white p-5 shadow-card sm:p-6">
        <div>
          <h2 className="font-display text-[17px] font-semibold text-foreground">
            Enrollment pricing (INR)
          </h2>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Choose whether learners can enroll for free or pay a one-time price via Razorpay (UPI, cards, netbanking).
          </p>
        </div>

        {error ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12.5px] text-red-700"
          >
            <AlertCircle
              className="mt-0.5 size-4 shrink-0 text-red-600"
              aria-hidden="true"
            />
            <span>{error}</span>
          </div>
        ) : null}

        {/* Free vs Paid Mode Selector */}
        <div
          className="grid gap-3 sm:grid-cols-2"
          role="radiogroup"
          aria-label="Course pricing mode"
        >
          <button
            type="button"
            role="radio"
            aria-checked={priceMode === "free"}
            disabled={locked || busy}
            onClick={() => {
              setPriceMode("free");
              setError(null);
            }}
            className={cn(
              "flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition-all",
              priceMode === "free"
                ? "border-primary bg-primary/[0.06] text-foreground shadow-2xs"
                : "border-border bg-white text-muted-foreground hover:bg-muted/40"
            )}
          >
            <div className="flex w-full items-center justify-between">
              <span className="text-[13.5px] font-semibold text-foreground">
                Free enrollment
              </span>
              <Badge variant={priceMode === "free" ? "emerald" : "default"}>
                ₹0
              </Badge>
            </div>
            <p className="text-[11.5px] text-muted-foreground">
              One-click instant enrollment for signed-in learners. Ideal for lead magnets or community courses.
            </p>
          </button>

          <button
            type="button"
            role="radio"
            aria-checked={priceMode === "paid"}
            disabled={locked || busy}
            onClick={() => {
              setPriceMode("paid");
              if (!price || Number(price) <= 0) setPrice("999");
              setError(null);
            }}
            className={cn(
              "flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition-all",
              priceMode === "paid"
                ? "border-primary bg-primary/[0.06] text-foreground shadow-2xs"
                : "border-border bg-white text-muted-foreground hover:bg-muted/40"
            )}
          >
            <div className="flex w-full items-center justify-between">
              <span className="text-[13.5px] font-semibold text-foreground">
                Paid course (INR)
              </span>
              <Badge variant={priceMode === "paid" ? "violet" : "default"}>
                Razorpay
              </Badge>
            </div>
            <p className="text-[11.5px] text-muted-foreground">
              Learners complete checkout in INR before unlocking full curriculum videos, quizzes, and resources.
            </p>
          </button>
        </div>

        {/* Paid INR Input + Compare-at + Quick Presets */}
        {priceMode === "paid" ? (
          <div className="space-y-4 rounded-xl border border-border bg-zinc-50/70 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="price" className="block text-[12.5px]">
                  Price (₹) <span className="text-primary">*</span>
                </Label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                    <IndianRupee className="size-4" aria-hidden="true" />
                  </span>
                  <Input
                    id="price"
                    inputMode="decimal"
                    disabled={locked || busy}
                    placeholder="999"
                    value={price}
                    onChange={(e) => {
                      setPrice(e.target.value);
                      setError(null);
                      setMsg(null);
                    }}
                    className="bg-white pl-9 font-mono text-[14px]"
                  />
                </div>
                <p className="text-[11.5px] text-muted-foreground">
                  Maximum ₹{MAX_INR_RUPEES.toLocaleString("en-IN")}.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="compare" className="block text-[12.5px]">
                  Compare-at price (₹){" "}
                  <span className="font-normal text-zinc-400">(optional)</span>
                </Label>
                <Input
                  id="compare"
                  inputMode="decimal"
                  disabled={locked || busy}
                  placeholder="e.g. 2499"
                  value={compare}
                  onChange={(e) => {
                    setCompare(e.target.value);
                    setMsg(null);
                  }}
                  className="bg-white font-mono text-[14px]"
                />
                <p className="text-[11.5px] text-muted-foreground">
                  Shown struck-through beside your active price.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Popular price tiers
              </span>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_PRICES.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    disabled={locked || busy}
                    onClick={() => {
                      setPrice(String(preset));
                      setError(null);
                    }}
                    className={cn(
                      "rounded-lg border px-2.5 py-1 font-mono text-[12px] transition-colors",
                      Number(price) === preset
                        ? "border-primary bg-primary/[0.08] font-semibold text-primary"
                        : "border-border bg-white text-foreground hover:bg-muted/50"
                    )}
                  >
                    ₹{preset.toLocaleString("en-IN")}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <div>
            {msg ? (
              <span
                role="status"
                className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-emerald-700"
              >
                <CheckCircle2 className="size-4" aria-hidden="true" />
                {msg}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              disabled={busy || locked}
            >
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
              {busy ? "Saving…" : "Save pricing"}
            </Button>
            {!locked ? (
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() => void persist(true)}
              >
                Save &amp; continue to Review →
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Learner Checkout Card Preview */}
      <aside className="rounded-2xl border border-border bg-white p-5 shadow-card">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Learner purchase card preview
        </span>
        <div className="mt-3 rounded-xl border border-border bg-zinc-50/70 p-4">
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-2xl font-bold text-foreground">
                {parsedPrice.valid ? formatInr(parsedPrice.paise) : "—"}
              </span>
              {parsedComparePaise > parsedPrice.paise ? (
                <span className="text-[13px] text-zinc-400 line-through">
                  {formatInr(parsedComparePaise)}
                </span>
              ) : null}
            </div>
            <Badge variant={parsedPrice.paise === 0 ? "emerald" : "violet"}>
              {parsedPrice.paise === 0 ? "Free access" : "Lifetime access"}
            </Badge>
          </div>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {parsedPrice.paise === 0
              ? "Instant enrollment for any signed-in learner."
              : "One-time payment in INR · Instant access upon checkout."}
          </p>

          <div className="mt-4 rounded-lg bg-primary px-3 py-2 text-center text-[12.5px] font-semibold text-primary-foreground shadow-button-primary">
            {parsedPrice.paise === 0
              ? "Enroll for free"
              : `Buy course · ${
                  parsedPrice.valid ? formatInr(parsedPrice.paise) : ""
                }`}
          </div>

          <ul className="mt-4 space-y-1.5 border-t border-border pt-3 text-[11.5px] text-muted-foreground">
            <li className="flex items-center gap-2">
              <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
              Full on-demand video &amp; quiz access
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck
                className="size-3.5 text-emerald-600"
                aria-hidden="true"
              />
              Secure checkout powered by Razorpay
            </li>
          </ul>
        </div>
      </aside>
    </form>
  );
}
