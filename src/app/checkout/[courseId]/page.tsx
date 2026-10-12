import type { Metadata } from "next";
import { getCourseById } from "@/lib/courses";
import { CheckoutClient } from "./checkout-client";
import { CheckoutLookup } from "./checkout-lookup";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Complete your enrollment. Demo checkout — no real payment is processed.",
};

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const course = getCourseById(courseId);
  // Unknown static id → maybe a locally published creator course.
  if (!course) return <CheckoutLookup courseId={courseId} />;
  return <CheckoutClient course={course} />;
}
