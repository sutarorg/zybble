/**
 * Client-side analytics surface.
 *
 * Two hard rules, enforced here rather than by convention:
 *  1. No event ever carries an email address, auth token, lesson note, payment
 *     field, course draft content, creator earnings figure or any free-form user
 *     text. `sanitiseParams` drops unknown keys.
 *  2. A `purchase` event is only emitted after the server has confirmed the
 *     payment, keyed by the order's stable public id so a refresh cannot
 *     double-count a sale.
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    posthog?: { capture: (event: string, props?: Record<string, unknown>) => void };
  }
}

/** The only parameter keys any analytics event is allowed to use. */
const ALLOWED_PARAMS = new Set([
  "currency",
  "value",
  "transaction_id",
  "items",
  "item_id",
  "item_name",
  "price",
  "quantity",
  "course_slug",
  "category_slug",
  "level",
  "sort",
  "result_count",
  "search_term",
  "creator_id",
  "method",
  "step",
  "status",
  "source",
  "role",
]);

function sanitiseParams(params: Record<string, unknown> = {}): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (!ALLOWED_PARAMS.has(key)) continue;
    if (typeof value === "string") {
      // Never let a long or free-form string through; only short enums/slugs.
      if (value.length > 80) continue;
    }
    clean[key] = value;
  }
  return clean;
}

export function trackEvent(name: string, params: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;
  const clean = sanitiseParams(params);
  window.gtag?.("event", name, clean);
  window.posthog?.capture(name, clean);
}

/**
 * GA4 `purchase` event.
 * `transaction_id` is the order's stable public id, so a duplicate page view
 * can never create a second conversion.
 */
export function trackPurchase(input: {
  transactionId: string;
  valuePaise: number;
  courseSlug: string;
  courseTitle: string;
}): void {
  trackEvent("purchase", {
    transaction_id: input.transactionId,
    currency: "INR",
    value: input.valuePaise / 100,
    items: [
      {
        item_id: input.courseSlug,
        item_name: input.courseTitle,
        price: input.valuePaise / 100,
        quantity: 1,
      },
    ],
  });
}
