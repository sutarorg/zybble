import { defineRoute } from "@/lib/api/http";
import { listCalendar } from "@/features/posts/queries";
import { requestedWorkspaceId, workspaceContext } from "@/lib/api/workspace";
import { calendarQuerySchema } from "@/lib/validation/posts";

/**
 * GET /api/calendar?from=&to=&timezone=
 *
 * Days are bucketed in the requested IANA timezone on the server, because
 * `scheduled_at` is a UTC instant and grouping it in UTC puts late-evening posts
 * on the wrong day for everyone west of Greenwich.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = defineRoute(
  {
    auth: "required",
    query: calendarQuerySchema,
    rateLimit: { limit: 120, windowMs: 60_000 },
    scope: "calendar:read",
  },
  async ({ supabase, req, query }) => {
    const context = await workspaceContext({
      supabase,
      user: null,
      workspaceId: requestedWorkspaceId(req),
    });

    return listCalendar(context, {
      from: query.from,
      to: query.to,
      timezone: query.timezone,
    });
  },
);
