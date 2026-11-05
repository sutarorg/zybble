import { defineRoute } from "@/lib/api/http";
import { requirePlatformAdmin } from "@/features/admin/guard";
import { loadSystem } from "@/features/admin/system";

/**
 * GET /api/admin/system — configuration status and operational health.
 *
 * Reports *state*, never values: which integrations are configured and which
 * variables are missing. No credential, key or token is included, and the
 * allowlist panel reports a count and a validity reason rather than echoing
 * the configured input back.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = defineRoute(
  {
    auth: "none",
    rateLimit: { limit: 60, windowMs: 60_000 },
    scope: "admin:system",
  },
  async () => {
    // Authorise first, then use the verified id: the report includes the
    // operator's own user id so they can copy it into ZYBBLE_ADMIN_USER_IDS.
    const user = await requirePlatformAdmin();
    return loadSystem(user.id);
  },
);
