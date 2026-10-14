import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/server/session";
import { getOrderByPublicId } from "@/lib/server/learner";
import { CheckoutSuccessClient } from "./success-client";

export const metadata: Metadata = {
  title: "Enrolment status",
  description: "What Zybble has on record for this order.",
};

export const dynamic = "force-dynamic";

/**
 * Landing page after Razorpay Checkout.
 *
 * The redirect grants nothing: this page reads the order the signed-in learner
 * actually owns and reports its real status. Reaching it without a matching
 * order shows the "unknown order" state rather than a success message.
 */
export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order } = await searchParams;
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent("/checkout/success")}`);

  const publicId = typeof order === "string" ? order : "";
  const record = publicId ? await getOrderByPublicId(publicId) : null;

  return <CheckoutSuccessClient order={record} />;
}