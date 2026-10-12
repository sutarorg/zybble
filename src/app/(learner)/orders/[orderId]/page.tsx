import * as React from "react";
import type { Metadata } from "next";
import { OrderDetailClient } from "./order-detail-client";

export const metadata: Metadata = {
  title: "Order details",
};

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  return (
    <React.Suspense>
      <OrderDetailClient orderId={orderId} />
    </React.Suspense>
  );
}
