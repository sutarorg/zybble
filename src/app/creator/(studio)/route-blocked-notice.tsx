import Link from "next/link";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import type { RouteOnboardingState } from "@/lib/server/creator";

/**
 * Explains, honestly, why paid pricing is unavailable.
 *
 * Zybble will not accept money for a course whose creator cannot be settled by
 * Razorpay Route, so the price field is disabled rather than silently ignored.
 */
export function RouteBlockedNotice({ route }: { route: RouteOnboardingState }) {
  if (route.settlementVerified) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3.5 text-[13px]">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden />
        <p className="text-emerald-900">
          Razorpay reports your Route account as active, so you can price this course and Zybble can route your
          share of every sale to your bank account.
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3.5 text-[13px]">
      <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden />
      <div>
        <p className="font-medium text-amber-900">Paid pricing is disabled</p>
        <p className="mt-1 text-amber-800">
          {route.blockedReason ??
            "Zybble only enables paid pricing once Razorpay marks your Route linked account active, so that every sale can actually be settled to your bank account."}
        </p>
        <Link href="/creator/payouts" className="mt-2 inline-block font-medium text-amber-900 underline">
          Set up Razorpay Route
        </Link>
      </div>
    </div>
  );
}