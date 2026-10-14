"use client";

import * as React from "react";
import { Download } from "lucide-react";
import { downloadCsv } from "@/lib/admin";
import { Button } from "@/components/ui/button";

interface Row {
  publicId: string;
  learnerEmail: string;
  courseTitle: string;
  creatorName: string;
  grossPaise: number;
  commissionPaise: number;
  creatorSharePaise: number;
  status: string;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  createdAt: string;
}

export function ExportOrdersCsv({ orders }: { orders: Row[] }) {
  const [busy, setBusy] = React.useState(false);

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={busy || orders.length === 0}
      onClick={() => {
        setBusy(true);
        try {
          downloadCsv(
            `zybble-orders-${new Date().toISOString().slice(0, 10)}`,
            [
              "order_id",
              "learner_email",
              "course",
              "creator",
              "gross_inr",
              "commission_inr",
              "creator_share_inr",
              "status",
              "razorpay_order_id",
              "razorpay_payment_id",
              "created_at",
            ],
            orders.map((order) => [
              order.publicId,
              order.learnerEmail,
              order.courseTitle,
              order.creatorName,
              (order.grossPaise / 100).toFixed(2),
              (order.commissionPaise / 100).toFixed(2),
              (order.creatorSharePaise / 100).toFixed(2),
              order.status,
              order.razorpayOrderId,
              order.razorpayPaymentId,
              order.createdAt,
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