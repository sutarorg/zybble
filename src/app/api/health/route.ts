import { sql } from "drizzle-orm";
import { getDb } from "@/db";

export const dynamic = "force-dynamic";

/**
 * Database health probe. Returns `{ ok: true }` when the configured database
 * answers, and a plain 500 payload with a reason when DATABASE_URL is missing
 * or the database is unreachable — the marketplace UI itself is fully local.
 */
export async function GET() {
  try {
    await getDb().execute(sql`select 1`);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        reason: error instanceof Error ? error.message : "Database unavailable",
      },
      { status: 500 }
    );
  }
}
