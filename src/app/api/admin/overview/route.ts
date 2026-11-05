import { defineRoute } from "@/lib/api/http";
import { requirePlatformAdmin } from "@/features/admin/guard";
import { loadOverview } from "@/features/admin/overview";

/**
 * GET /api/admin/overview — platform-wide counts and integration health.
 *
 * `auth: "none"` is deliberate. `defineRoute`'s `auth: "required"` only proves
 * *a* session exists; this endpoint needs the allowlist too, and performing
 * both checks in one place (`requirePlatformAdmin`) keeps a single
 * verification path instead of two that could drift. It also avoids calling
 * `getUser()` twice per request.
 *
 * The handler authorises before it touches the admin client, so an
 * unauthorised request never causes a service-role query.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = defineRoute(
  {
    auth: "none",
    rateLimit: { limit: 60, windowMs: 60_000 },
    scope: "admin:overview",
  },
  async () => {
    await requirePlatformAdmin();
    return loadOverview();
  },
);
