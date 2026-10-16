import Link from "next/link";
import { ShieldCheck, Wallet } from "lucide-react";
import type { RouteOnboardingState } from "@/lib/server/creator";

/**
 * Informs the creator about their saved manual payout destination status.
 *
 * Course pricing and publication are never blocked by payout destination setup;
 * a saved UPI ID or Indian bank account is required only when requesting a payout.
 */
export function RouteBlockedNotice({ route }: { route: RouteOnboardingState }) {
  if (route.hasAccount && route.destination) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3.5 text-[13px]">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden />
        <p className="text-emerald-900">
          Payout destination saved ({route.destination.method.toUpperCase()} ·{" "}
          <span className="font-mono">{route.destination.maskedDestination}</span>). Your net share
          of every captured course sale accrues to your creator balance in INR.
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3.5 text-[13px]">
      <Wallet className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <div>
        <p className="font-medium text-foreground">You can price and publish before adding payout details</p>
        <p className="mt-1 text-muted-foreground">
          Learners pay Zybble in INR via standard Razorpay Checkout, and your net creator share
          accrues to your ledger balance automatically. Save a UPI ID or Indian bank account whenever
          you are ready to request a manual payout.
        </p>
        <Link href="/creator/payouts" className="mt-2 inline-block font-medium text-primary underline">
          Configure payout destination (optional now)
        </Link>
      </div>
    </div>
  );
}