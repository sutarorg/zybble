import { cron as inngestCron, eventType, staticSchema } from "inngest";
import type { Events } from "@/inngest/client";

/**
 * Trigger helpers.
 *
 * `event()` binds an Inngest trigger to the payload type declared in the client's
 * `Events` catalogue using `staticSchema` — type-only, zero runtime cost. Every
 * function below therefore fails to compile if its handler reads a field the
 * catalogue does not declare.
 */
export function event<K extends keyof Events>(name: K) {
  return eventType(name, { schema: staticSchema<Events[K]["data"]>() });
}

export function cron(schedule: string) {
  return inngestCron(schedule);
}
