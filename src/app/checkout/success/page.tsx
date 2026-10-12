import type { Metadata } from "next";
import { CheckoutSuccessClient } from "./success-client";

export const metadata: Metadata = {
  title: "Enrollment confirmed",
  description: "Your demo enrollment was completed successfully.",
};

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; course?: string }>;
}) {
  const { order, course } = await searchParams;
  return (
    <CheckoutSuccessClient
      orderId={typeof order === "string" ? order : ""}
      courseSlug={typeof course === "string" ? course : ""}
    />
  );
}
