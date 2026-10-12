import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

/**
 * The pool is created lazily (and only on first use) so that importing this
 * module — for example while Next.js collects page data during `next build` —
 * does not require DATABASE_URL to be configured. Endpoints that actually need
 * the database still fail loudly inside their own error handling.
 */
function getPool(): Pool {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to connect to the database");
  }
  if (!globalForDb.__arenaNextJsPostgresqlPool) {
    globalForDb.__arenaNextJsPostgresqlPool = new Pool({ connectionString: databaseUrl });
  }
  return globalForDb.__arenaNextJsPostgresqlPool;
}

function createDb() {
  return drizzle(getPool());
}

type Db = ReturnType<typeof createDb>;

let cachedDb: Db | null = null;

/** Returns the shared Drizzle client, creating it on first call. */
export function getDb(): Db {
  if (!cachedDb) cachedDb = createDb();
  return cachedDb;
}
