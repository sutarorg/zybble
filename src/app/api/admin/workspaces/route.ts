import { z } from "zod";
import { defineRoute } from "@/lib/api/http";
import { requirePlatformAdmin } from "@/features/admin/guard";
import { loadWorkspaces } from "@/features/admin/workspaces";

/**
 * GET /api/admin/workspaces — paginated platform workspace list.
 *
 * `plan=pro` filters on the *effective* plan derived from the subscription
 * row, not on `workspaces.plan`, so the answer matches what customers see.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  q: z.string().trim().max(120).optional(),
  plan: z.enum(["all", "free", "pro"]).default("all"),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});

export const GET = defineRoute(
  {
    auth: "none",
    query: querySchema,
    rateLimit: { limit: 60, windowMs: 60_000 },
    scope: "admin:workspaces",
  },
  async ({ query }) => {
    await requirePlatformAdmin();

    return loadWorkspaces({
      search: query.q,
      plan: query.plan,
      page: query.page,
      perPage: query.perPage,
    });
  },
);
