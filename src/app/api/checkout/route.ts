import { z } from "zod";
import { CheckoutError, confirmCheckout, createCheckoutOrder, enrollInFreeCourse } from "@/lib/server/checkout";
import { getSession } from "@/lib/server/session";
import { razorpayKeyId } from "@/lib/server/razorpay";
import { isRazorpayConfigured } from "@/lib/env";
import { CURRENCY } from "@/lib/money";
import { clientKey, LIMITS, rateLimit, rateLimitHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const createSchema = z.object({
  courseId: z.string().uuid(),
  mode: z.enum(["auto", "free"]),
});

const confirmSchema = z.object({
  publicOrderId: z.string().min(6).max(40),
  razorpayOrderId: z.string().min(4).max(64),
  razorpayPaymentId: z.string().min(4).max(64),
  razorpaySignature: z.string().min(16).max(256),
});

/**
 * Checkout lifecycle.
 *
 *   POST /api/checkout  { courseId, mode }              -> opens a session
 *   POST /api/checkout  { publicOrderId, razorpay... }  -> confirms a payment
 *
 * The course price, currency, commission and creator share are read from the
 * database on every call. The request body carries identifiers only.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in to continue" }, { status: 401 });

  const limit = rateLimit(clientKey(request, "checkout", session.id), LIMITS.checkout.limit, LIMITS.checkout.windowMs);
  if (!limit.allowed) {
    return Response.json(
      { error: "Too many checkout attempts. Please wait a moment." },
      { status: 429, headers: rateLimitHeaders(limit) }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    // ---- confirm an in-flight payment -------------------------------------
    const confirmed = confirmSchema.safeParse(body);
    if (confirmed.success) {
      const result = await confirmCheckout(confirmed.data);
      return Response.json(result, { status: 200, headers: rateLimitHeaders(limit) });
    }

    // ---- start a checkout --------------------------------------------------
    const started = createSchema.safeParse(body);
    if (!started.success) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }

    if (started.data.mode === "free") {
      const session_ = await enrollInFreeCourse(session, started.data.courseId);
      return Response.json(
        { ...session_, status: "paid" as const, currency: CURRENCY },
        { status: 200, headers: rateLimitHeaders(limit) }
      );
    }

    if (!isRazorpayConfigured()) {
      throw new CheckoutError(
        "payments_unavailable",
        "Payments are not available right now. Please try again later.",
        503
      );
    }

    const checkout = await createCheckoutOrder(session, started.data.courseId);
    return Response.json(
      {
        ...checkout,
        currency: CURRENCY,
        keyId: razorpayKeyId(),
        // Razorpay Checkout options; the browser passes these to `new Razorpay`.
        checkoutOptions: {
          amount: checkout.amountPaise,
          currency: CURRENCY,
          order_id: checkout.razorpayOrderId,
          receipt: checkout.publicId,
          name: "Zybble",
          description: checkout.courseTitle,
          prefill: { name: session.fullName, email: session.email },
          notes: { zybble_order: checkout.publicId },
          theme: { color: "#7c3aed" },
        },
      },
      { status: 200, headers: rateLimitHeaders(limit) }
    );
  } catch (error) {
    if (error instanceof CheckoutError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error("[checkout] failed", {
      user: session.id,
      reason: error instanceof Error ? error.message.slice(0, 200) : "unknown",
    });
    return Response.json({ error: "Checkout is temporarily unavailable" }, { status: 500 });
  }
}
