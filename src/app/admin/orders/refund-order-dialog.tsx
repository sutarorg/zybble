"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";
import { refundOrderAction } from "@/app/admin/actions";
import { ActionButton } from "@/components/admin/action-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Administrative refund correction.
 *
 * This is not a customer-facing refund flow — Zybble publishes no refund policy.
 * It calls Razorpay's refund API, stores the real refund id, and reverses the
 * Route transfer for the refunded portion.
 */
export function RefundOrderDialog({
  publicOrderId,
  grossPaise,
}: {
  publicOrderId: string;
  grossPaise: number;
}) {
  const router = useRouter();
  const [amount, setAmount] = React.useState(String((grossPaise / 100).toFixed(2)));

  return (
    <ActionButton
      label="Refund"
      icon={Undo2}
      danger
      confirmTitle="Refund this order through Razorpay?"
      confirmBody="This creates a real refund with Razorpay. The learner's entitlement is revoked and the creator's Route transfer is reversed for the refunded portion. Nothing here happens locally."
      confirmLabel="Refund with Razorpay"
      reasonLabel="Reason recorded in the audit log"
      minReasonLength={5}
      toastText="Refund created"
      onAction={async (reason) => {
        const parsed = Number(amount);
        const result = await refundOrderAction({
          publicOrderId,
          amountPaise: Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : undefined,
          reason,
          revokeEntitlement: true,
        });
        if (result.ok) router.refresh();
        return result;
      }}
    />
  );
}

/** Small helper kept for the amount field label in future iterations. */
export function RefundAmountField() {
  return (
    <div>
      <Label htmlFor="refund-amount">Amount (₹)</Label>
      <Input id="refund-amount" inputMode="decimal" />
    </div>
  );
}