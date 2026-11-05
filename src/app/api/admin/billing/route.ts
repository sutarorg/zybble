import { defineRoute } from "@/lib/api/http";
import { requirePlatformAdmin } from "@/features/admin/guard";
import { loadBilling } from "@/features/admin/billing";

/**
 * GET /api/admin/billing — plan mix, subscription health and MRR. READ-ONLY.
 *
 * There are no write methods on this route. Billing is deliberately not
 * modifiable from the admin dashboard: changing money should require the
 * payment provider's own console, where every change is audited by the party
 * that actually moves it.
 *
 * Payment instrument details (`brand`, `last4`) are never selected by the
 * service, so they cannot appear in this response.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = defineRoute(
  {
    auth: "none",
    rateLimit: { limit: 60, windowMs: 60_000 },
    scope: "admin:billing",
  },
  async () => {
    await requirePlatformAdmin();
    return loadBilling();
  },
);
