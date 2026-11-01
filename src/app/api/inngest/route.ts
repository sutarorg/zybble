import type { NextRequest } from "next/server";
import { serve } from "inngest/next";
import { inngest, inngestServeProblem } from "@/inngest/client";
import { functions } from "@/inngest/functions";
import { logger } from "@/lib/logger";

/**
 * Inngest endpoint.
 *
 * Public by necessity: Inngest signs its requests with the signing key, so no
 * session is required. It is excluded from the auth proxy matcher.
 *
 * The handlers are wrapped so a misconfiguration is legible. Unwrapped, the
 * SDK answers `500 {"code":"internal_server_error"}` — which the Inngest
 * dashboard reports only as "the URL is unreachable", with no hint that a
 * single environment variable is missing. A 503 that names the variable turns
 * a mystery into a one-line fix.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type NextHandler = (request: NextRequest, res: unknown) => Promise<Response>;

const handler = serve({
  client: inngest,
  functions,
});

function explain(inner: NextHandler): NextHandler {
  return async (request, res) => {
    const problem = inngestServeProblem();
    if (problem) {
      logger.error("inngest.serve_unreachable", {
        variable: problem.variable,
        path: new URL(request.url).pathname,
      });

      return Response.json(
        {
          ok: false,
          error: {
            code: "integration_not_configured",
            message: problem.message,
            details: { integration: "Inngest", variable: problem.variable },
          },
        },
        {
          status: 503,
          headers: {
            // A probe is never a cacheable answer.
            "cache-control": "no-store",
          },
        },
      );
    }

    return inner(request, res);
  };
}

export const GET = explain(handler.GET);
export const POST = explain(handler.POST);
export const PUT = explain(handler.PUT);
