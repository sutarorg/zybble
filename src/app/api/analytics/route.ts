import { defineRoute } from "@/lib/api/http";
import { assertRangeAllowed, getAnalyticsOverview, type RangeKey } from "@/features/analytics/service";
import { requestedWorkspaceId, workspaceContext } from "@/lib/api/workspace";
import { analyticsQuerySchema } from "@/lib/validation/posts";

/**
 * GET /api/analytics?range=7d|28d|12m&accountId=
 *
 * Everything returned here comes from `post_analytics` and `analytics_snapshots`,
 * which are only ever written from LinkedIn API responses. Missing metrics stay
 * `null` and the best-time grid returns an explicit insufficient-data state —
 * nothing is estimated, back-filled or averaged in.
 *
 * The 12-month range is a Pro entitlement and is refused on Free rather than
 * silently truncated.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = defineRoute(
  {
    auth: "required",
    query: analyticsQuerySchema,
    rateLimit: { limit: 120, windowMs: 60_000 },
    scope: "analytics:read",
  },
  async ({ supabase, req, query }) => {
    const context = await workspaceContext({
      supabase,
      user: null,
      workspaceId: requestedWorkspaceId(req),
    });

    const range = query.range as RangeKey;
    assertRangeAllowed(range, context.workspace.plan);

    return getAnalyticsOverview({
      supabase: supabase!,
      workspaceId: context.workspace.id,
      plan: context.workspace.plan,
      range,
      timeZone: context.workspace.timezone,
      linkedinAccountId: query.accountId ?? undefined,
    });
  },
);
