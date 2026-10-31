import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { functions } from "@/inngest/functions";

/**
 * Inngest endpoint.
 *
 * Public by necessity: Inngest signs its requests with the signing key, so no
 * session is required. It is excluded from the auth proxy matcher.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});
