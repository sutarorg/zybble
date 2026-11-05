import { z } from "zod";
import { defineRoute } from "@/lib/api/http";
import { requirePlatformAdmin } from "@/features/admin/guard";
import { loadUsers } from "@/features/admin/users";

/**
 * GET /api/admin/users — paginated platform user list.
 *
 * Query parameters are validated with Zod, which also bounds them: `perPage`
 * is capped at 100 so a caller cannot ask for the whole table in one request,
 * and `status` is an enum so an arbitrary column value cannot be injected into
 * the filter.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(["all", "active", "pending_onboarding", "deleted"]).default("all"),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});

export const GET = defineRoute(
  {
    auth: "none",
    query: querySchema,
    rateLimit: { limit: 60, windowMs: 60_000 },
    scope: "admin:users",
  },
  async ({ query }) => {
    await requirePlatformAdmin();

    return loadUsers({
      search: query.q,
      status: query.status,
      page: query.page,
      perPage: query.perPage,
    });
  },
);
