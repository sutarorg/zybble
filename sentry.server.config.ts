import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  tracesSampleRate: 0,
  // Never let a payment or personal-data payload ride along with an error.
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
