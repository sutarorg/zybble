import { z } from "zod";
import { defineRoute } from "@/lib/api/http";
import { requirePlatformAdmin } from "@/features/admin/guard";
import { loadActivity } from "@/features/admin/activity";

/**
 * GET /api/admin/activity — paginated audit trail.
 *
 * Metadata is redacted server-side before it is serialised. The `payload`
 * column of `webhook_events` is never selected by any admin service, so raw
 * provider bodies cannot reach this response.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  q: z.string().trim().max(120).optional(),
  actorType: z.enum(["all", "user", "system", "webhook"]).default("all"),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});

export const GET = defineRoute(
  {
    auth: "none",
    query: querySchema,
    rateLimit: { limit: 60, windowMs: 60_000 },
    scope: "admin:activity",
  },
  async ({ query }) => {
    await requirePlatformAdmin();

    return loadActivity({
      search: query.q,
      actorType: query.actorType,
      page: query.page,
      perPage: query.perPage,
    });
  },
);
