import type { Metadata } from "next";
import { CheckoutFailedClient } from "./failed-client";

export const metadata: Metadata = {
  title: "Payment failed",
  description: "Your simulated payment could not be completed.",
};

export default async function CheckoutFailedPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string }>;
}) {
  const { course } = await searchParams;
  return <CheckoutFailedClient courseSlug={typeof course === "string" ? course : ""} />;
}
