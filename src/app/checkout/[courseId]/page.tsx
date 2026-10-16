import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getPublishedCourseById, getCourseViewerState } from "@/lib/server/catalog";
import { getSession } from "@/lib/server/session";
import { CheckoutClient } from "./checkout-client";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Complete your Zybble enrolment. Paid courses are settled in INR through Razorpay.",
};

export const dynamic = "force-dynamic";

/**
 * Checkout entry point.
 *
 * Everything the page shows is read from the database on the server. The
 * browser receives a price it can never edit and a checkout-readiness verdict it
 * can never override; `/api/checkout` re-checks both before writing an order.
 */
export default async function CheckoutPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(`/checkout/${courseId}`)}`);

  const course = await getPublishedCourseById(courseId);
  if (!course) notFound();

  const viewer = await getCourseViewerState(course.id, course.pricePaise);

  return (
    <CheckoutClient
      course={course}
      enrolled={viewer.enrolled}
      checkoutBlocked={viewer.checkoutBlocked}
      buyerEmail={session.email}
      buyerName={session.fullName}
    />
  );
}