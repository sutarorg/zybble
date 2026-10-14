"use client";

import * as React from "react";
import { Download } from "lucide-react";
import { downloadCsv } from "@/lib/admin";
import { Button } from "@/components/ui/button";

interface Row {
  transferId: string;
  creatorName: string;
  routeAccountId: string;
  amountPaise: number;
  reversedPaise: number;
  status: string;
  settlementStatus: string | null;
  settledAt: string | null;
  createdAt: string;
}

export function ExportTransfersCsv({ transfers }: { transfers: Row[] }) {
  const [busy, setBusy] = React.useState(false);

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={busy || transfers.length === 0}
      onClick={() => {
        setBusy(true);
        try {
          downloadCsv(
            `zybble-route-transfers-${new Date().toISOString().slice(0, 10)}`,
            [
              "transfer_id",
              "creator",
              "razorpay_account_id",
              "amount_inr",
              "reversed_inr",
              "transfer_status",
              "settlement_status",
              "settled_at",
              "created_at",
            ],
            transfers.map((transfer) => [
              transfer.transferId,
              transfer.creatorName,
              transfer.routeAccountId,
              (transfer.amountPaise / 100).toFixed(2),
              (transfer.reversedPaise / 100).toFixed(2),
              transfer.status,
              transfer.settlementStatus ?? "",
              transfer.settledAt ?? "",
              transfer.createdAt,
            ])
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <Download className="size-4" aria-hidden /> Export CSV
    </Button>
  );
}