import { defineRoute } from "@/lib/api/http";
import { signOut } from "@/features/auth/service";

/** POST /api/auth/logout — revokes the session and clears the auth cookies. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = defineRoute(
  {
    auth: "optional",
    rateLimit: { limit: 30, windowMs: 60_000 },
    scope: "auth:logout",
  },
  async () => {
    await signOut();
    return { signedOut: true };
  },
);
