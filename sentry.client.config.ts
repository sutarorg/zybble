import * as Sentry from "@sentry/nextjs";

/**
 * Browser error capture.
 *
 * `beforeSend` strips anything that could carry personal or financial data:
 * request bodies, form values, cookie/authorization headers and free-text
 * lesson content.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  tracesSampleRate: 0,
  // Keep personally identifiable breadcrumbs out of the browser reports.
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.category === "console") return null;
    if (breadcrumb.category === "navigation") return breadcrumb;
    if (breadcrumb.data && typeof breadcrumb.data === "object") {
      const data = breadcrumb.data as Record<string, unknown>;
      if ("body" in data || "input" in data || "value" in data) return null;
    }
    return breadcrumb;
  },
  beforeSend(event) {
    if (event.request) {
      delete (event.request as Record<string, unknown>).data;
      delete (event.request as Record<string, unknown>).cookies;
      delete (event.request as Record<string, unknown>).headers;
      delete (event.request as Record<string, unknown>).query_string;
    }
    return event;
  },
});
