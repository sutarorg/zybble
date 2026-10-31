import { Pool, type PoolClient, type QueryResultRow } from "pg";

/**
 * Direct SQL access for work that needs real transactions.
 *
 * Supabase's PostgREST surface is excellent for row-level CRUD, but multi-step
 * writes (claim a webhook event, apply its snapshot, write an audit row) must be
 * atomic. Those paths use this executor against the same Postgres database.
 *
 * Security note: this connects as the database owner, so RLS does not apply.
 * Every caller must authorise explicitly — see `withTransaction` usage in
 * src/features/billing/webhooks.ts and src/features/posts/publish.ts.
 */

export type SqlQueryExecutor = {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number | null }>;
};

export type TransactionExecutor = SqlQueryExecutor & {
  /** Roll back the transaction by throwing inside the callback. */
  release: () => void;
};

let pool: Pool | null = null;

function getPool(): Pool {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is required for transactional SQL. Supabase exposes it under Project Settings → Database → Connection string (use the pooled connection in production).",
    );
  }

  pool = new Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    // Supabase's pooler terminates idle connections; keep them short-lived.
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: connectionString.includes("localhost") ? undefined : { rejectUnauthorized: false },
  });

  return pool;
}

export const sql: SqlQueryExecutor = {
  async query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) {
    const result = await getPool().query<T>(text, params as never[]);
    return { rows: result.rows, rowCount: result.rowCount };
  },
};

/**
 * Run `callback` inside a single transaction. Any throw rolls back.
 * Used by the idempotency-critical paths: webhook claim + apply, publish claim.
 */
export async function withTransaction<T>(
  callback: (tx: TransactionExecutor) => Promise<T>,
): Promise<T> {
  const client: PoolClient = await getPool().connect();

  const tx: TransactionExecutor = {
    async query<R extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) {
      const result = await client.query<R>(text, params as never[]);
      return { rows: result.rows, rowCount: result.rowCount };
    },
    release: () => {
      // Intentionally a no-op marker: the wrapper owns the lifecycle.
    },
  };

  try {
    await client.query("begin");
    const result = await callback(tx);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Test seam: allow tests to run the same code against an embedded Postgres. */
let overrideExecutor: SqlQueryExecutor | null = null;

export function setSqlExecutor(executor: SqlQueryExecutor | null): void {
  overrideExecutor = executor;
}

export function getSqlExecutor(): SqlQueryExecutor {
  return overrideExecutor ?? sql;
}
