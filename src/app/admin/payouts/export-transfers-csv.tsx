"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/lib/admin";
import { paiseToRupees } from "@/lib/money";
import type { AdminPayoutRequestRow } from "@/lib/server/admin";

export function ExportPayoutsCsv({
  requests,
}: {
  requests: AdminPayoutRequestRow[];
}) {
  function download() {
    downloadCsv(
      `zybble-creator-payouts-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        "payout_public_id",
        "creator_name",
        "creator_email",
        "amount_inr",
        "amount_paise",
        "status",
        "destination_method",
        "destination_masked",
        "holder_masked",
        "payment_reference_utr",
        "payment_method_used",
        "requested_at",
        "paid_at",
      ],
      requests.map((req) => [
        req.publicId,
        req.creatorName,
        req.creatorEmail,
        paiseToRupees(req.amountPaise),
        req.amountPaise,
        req.status,
        req.destinationMethod,
        req.destinationMasked,
        req.destinationHolderMasked,
        req.paymentReference ?? "",
        req.paymentMethodUsed ?? "",
        req.requestedAt,
        req.paidAt ?? "",
      ])
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={requests.length === 0}
      onClick={download}
    >
      <Download className="mr-1.5 h-3.5 w-3.5" />
      Export CSV (masked)
    </Button>
  );
}

/** Backwards-compatible export alias. */
export const ExportTransfersCsv = ExportPayoutsCsv;
