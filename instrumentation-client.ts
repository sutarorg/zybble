/**
 * Browser instrumentation entry point.
 *
 * `NEXT_PUBLIC_SENTRY_DSN` is inlined at build time, so when no DSN is
 * configured this module compiles down to nothing and the Sentry client —
 * by far the largest third-party bundle in the app — is never fetched.
 * Loading it unconditionally cost every visitor ~390 KB of JavaScript before
 * the first paint, even with error reporting switched off.
 */
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  void import("./sentry.client.config");
}
