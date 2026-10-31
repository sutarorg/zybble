/**
 * Minimal in-memory stand-in for a Supabase client.
 *
 * The real client is a PostgREST query builder; this reproduces the method
 * chaining the application uses (`from().select().eq().maybeSingle()`) and
 * records what was written, so tests can assert on *behaviour* — which rows
 * were touched with which values — without a network.
 *
 * It is deliberately dumb: anything not registered returns empty results, which
 * makes an accidental extra query obvious rather than silently passing.
 */

type Row = Record<string, unknown>;

export type TablePlan = {
  /** Rows returned by SELECT for this table. */
  rows?: Row[];
  /** Row returned by a terminal `.maybeSingle()` / `.single()`. */
  single?: Row | null;
  /**
   * Rows returned one per terminal call, in order.
   *
   * Lets a test drive several members (different preferences, different
   * profiles) through the same table. Falls back to `single` when exhausted.
   */
  singleQueue?: Array<Row | null>;
  /** Error returned by the next terminal call, if any. */
  error?: { message: string; code?: string } | null;
};

export type FakeSupabase = {
  from: (table: string) => FakeQuery;
  rpc: (name: string, args: Row) => Promise<{ data: unknown; error: null }>;
  /** Everything written, in order, for assertions. */
  calls: Array<{ table: string; op: string; values?: Row | Row[]; filters: Row }>;
};

export type FakeQuery = {
  select: (columns?: string) => FakeQuery;
  insert: (values: Row | Row[]) => FakeQuery;
  upsert: (values: Row | Row[], options?: Row) => FakeQuery;
  update: (values: Row) => FakeQuery;
  delete: () => FakeQuery;
  eq: (column: string, value: unknown) => FakeQuery;
  neq: (column: string, value: unknown) => FakeQuery;
  in: (column: string, values: unknown[]) => FakeQuery;
  is: (column: string, value: unknown) => FakeQuery;
  gt: (column: string, value: unknown) => FakeQuery;
  gte: (column: string, value: unknown) => FakeQuery;
  lte: (column: string, value: unknown) => FakeQuery;
  order: (column: string, options?: Row) => FakeQuery;
  limit: (count: number) => FakeQuery;
  maybeSingle: () => Promise<{ data: Row | null; error: null }>;
  single: () => Promise<{ data: Row | null; error: null }>;
  then: <T>(resolve: (value: { data: Row[]; error: null }) => T) => Promise<T>;
};

export function createFakeSupabase(plans: Record<string, TablePlan> = {}): FakeSupabase {
  const calls: FakeSupabase["calls"] = [];

  function nextSingle(table: string): Row | null {
    const queue = plans[table]?.singleQueue;
    if (queue && queue.length > 0) return queue.shift() ?? null;
    return plans[table]?.single ?? null;
  }

  function query(table: string): FakeQuery {
    const filters: Row = {};
    let op = "select";
    let values: Row | Row[] | undefined;

    const builder: FakeQuery = {
      select() {
        op = "select";
        return builder;
      },
      insert(next) {
        op = "insert";
        values = next;
        // `filters` is recorded by reference: PostgREST applies `.eq()` after
        // `.update()`/`.insert()`, so the snapshot has to see those too.
        calls.push({ table, op, values, filters });
        return builder;
      },
      upsert(next) {
        op = "upsert";
        values = next;
        calls.push({ table, op, values, filters });
        return builder;
      },
      update(next) {
        op = "update";
        values = next;
        calls.push({ table, op, values, filters });
        return builder;
      },
      delete() {
        op = "delete";
        calls.push({ table, op, filters });
        return builder;
      },
      eq(column, value) {
        filters[column] = value;
        return builder;
      },
      neq(column, value) {
        filters[`${column}.neq`] = value;
        return builder;
      },
      in(column, list) {
        filters[`${column}.in`] = list;
        return builder;
      },
      is(column, value) {
        filters[`${column}.is`] = value;
        return builder;
      },
      gt(column, value) {
        filters[`${column}.gt`] = value;
        return builder;
      },
      gte(column, value) {
        filters[`${column}.gte`] = value;
        return builder;
      },
      lte(column, value) {
        filters[`${column}.lte`] = value;
        return builder;
      },
      order(column) {
        filters[`order.${column}`] = true;
        return builder;
      },
      limit(count) {
        filters.limit = count;
        return builder;
      },
      async maybeSingle() {
        return { data: nextSingle(table), error: null };
      },
      async single() {
        return { data: nextSingle(table), error: null };
      },
      async then<T>(resolve: (value: { data: Row[]; error: null }) => T): Promise<T> {
        return resolve({ data: plans[table]?.rows ?? [], error: null });
      },
    };

    return builder;
  }

  return {
    from: query,
    async rpc(name, args) {
      calls.push({ table: `rpc:${name}`, op: "rpc", values: args as Row, filters: {} });
      return { data: null, error: null };
    },
    calls,
  };
}

export function callsFor(db: FakeSupabase, table: string, op?: string) {
  return db.calls.filter((call) => call.table === table && (op === undefined || call.op === op));
}
