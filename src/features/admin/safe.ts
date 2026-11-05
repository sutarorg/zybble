/**
 * Failure containment for admin data loads.
 *
 * The admin services use the service-role client, which throws when
 * `SUPABASE_SERVICE_ROLE_KEY` is absent. Left uncontained that becomes a 500
 * with a stack trace in the logs and an empty screen for the operator. Catching
 * it here turns the same situation into a readable panel that names the
 * problem, while the error itself is still logged with its cause.
 *
 * Only the *message* is surfaced. Database errors can contain schema and
 * constraint names, so they are replaced with a generic sentence; the specific
 * text stays in the log where an operator with log access can read it.
 */

import { logger } from "@/lib/logger";

export type LoadResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

const GENERIC = "This section could not be loaded. Check the deployment configuration and try again.";

export async function safeLoad<T>(event: string, load: () => Promise<T>): Promise<LoadResult<T>> {
  try {
    return { ok: true, data: await load() };
  } catch (error) {
    logger.error(event, {
      error: error instanceof Error ? { name: error.name, message: error.message } : error,
    });

    const isConfigurationFault =
      error instanceof Error &&
      /service[_ ]role|SUPABASE_SERVICE_ROLE_KEY|not configured|DATABASE_URL/i.test(
        error.message,
      );

    return {
      ok: false,
      message: isConfigurationFault
        ? "The service-role database client is not configured on this deployment, so platform data cannot be read."
        : GENERIC,
    };
  }
}
