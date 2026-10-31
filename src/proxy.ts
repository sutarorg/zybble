import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Next.js 16 renamed the `middleware.ts` convention to `proxy.ts`.
 * It keeps the session fresh and gates `/app` routes before rendering.
 * See src/lib/supabase/proxy.ts for the implementation.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on everything except static assets, image optimisation and the
     * endpoints that must stay callable without a browser session
     * (webhooks, health, background-job handler).
     */
    "/((?!_next/static|_next/image|favicon.ico|api/webhooks|api/health|api/inngest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|txt|xml|webmanifest)$).*)",
  ],
};
