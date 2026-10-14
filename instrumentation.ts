/**
 * Next.js instrumentation entry point. Runs once per server process.
 * Importing the Sentry config here registers the server error handlers.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
