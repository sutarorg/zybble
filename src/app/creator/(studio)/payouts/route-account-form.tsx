"use client";

import { PayoutDestinationForm } from "./payout-destination-form";
import type { CreatorPayoutDestinationView } from "@/lib/server/payouts";

export interface RouteAccountFormProps {
  currentDestination?: CreatorPayoutDestinationView | null;
  encryptionReady?: boolean;
}

/**
 * Compatibility wrapper around `PayoutDestinationForm`.
 * Razorpay Route onboarding has been replaced by encrypted manual UPI/bank
 * payout destinations.
 */
export function RouteAccountForm({
  currentDestination = null,
  encryptionReady = true,
}: RouteAccountFormProps) {
  return (
    <PayoutDestinationForm
      currentDestination={currentDestination}
      encryptionReady={encryptionReady}
    />
  );
}
