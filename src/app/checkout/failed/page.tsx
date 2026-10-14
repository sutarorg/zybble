import type { Metadata } from "next";
import { getPublishedCourseBySlug } from "@/lib/server/catalog";
import { CheckoutFailedClient } from "./failed-client";

export const metadata: Metadata = {
  title: "Payment not completed",
  description: "Why your Zybble payment did not go through, and what happens next.",
};

export const dynamic = "force-dynamic";

/**
 * Failure screen.
 *
 * Purely informational: it reports the catalog's own view of the course. It
 * never marks an order failed, because only Razorpay's payment state can.
 */
export default async function CheckoutFailedPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string; reason?: string }>;
}) {
  const { course: slug, reason } = await searchParams;
  const course = typeof slug === "string" && slug ? await getPublishedCourseBySlug(slug) : null;

  return (
    <CheckoutFailedClient
      course={course ? { id: course.id, title: course.title, pricePaise: course.pricePaise } : null}
      reason={typeof reason === "string" ? reason : "declined"}
    />
  );
}