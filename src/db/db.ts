// One SQL interface, two backends: pg against Supabase, PGlite in tests.
//
// V3 LIVES IN ITS OWN SCHEMA. The database is the Supabase Postgres the dafna
// project uses: dafna's tables are in `public`, bringup-journey's in
// `journey`, V3's in `v3`. Every query names its tables unqualified and finds
// them through `search_path`, pinned on every connection to `v3` ALONE, so a
// table this project never created is an error rather than a quiet read of
// another project's table of the same name. The shape is bringup-journey's
// (src/db/db.ts there), including why the transaction pooler is refused.

export const SCHEMA = 'v3';

export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
  /** Multi-statement SQL (migrations). No params, no rows back. */
  exec(sql: string): Promise<void>;
}

export class SchemaPinError extends Error {}

/** A `set search_path` holds for a session; the transaction pooler (port
 *  6543) may run consecutive statements on different server connections. */
export function refuseTransactionPooler(connectionString: string): void {
  let port = '';
  try {
    port = new URL(connectionString).port;
  } catch {
    return;
  }
  if (port === '6543') {
    throw new SchemaPinError(
      'DATABASE_URL points at the Supabase transaction pooler (port 6543), which cannot hold search_path. ' +
        'Use the session pooler (port 5432).'
    );
  }
}

export async function pgDb(connectionString: string): Promise<Db> {
  refuseTransactionPooler(connectionString);
  const { default: pg } = await import('pg');
  const local = /localhost|127\.0\.0\.1/.test(connectionString);
  const pool = new pg.Pool({
    connectionString,
    ssl: local ? undefined : { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
    max: 3,
  });
  pool.on('connect', (client) => {
    client.query(`set search_path to ${SCHEMA}`).catch(() => {
      // assertSchema reports a pin that did not take.
    });
  });
  return {
    async query<T>(text: string, params?: unknown[]) {
      const res = await pool.query(text, params as never[]);
      return { rows: res.rows as T[], rowCount: res.rowCount ?? 0 };
    },
    async exec(sql: string) {
      await pool.query(sql);
    },
  };
}

export async function pgliteDb(): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite');
  const lite = new PGlite();
  await lite.exec(`create schema if not exists ${SCHEMA}; set search_path to ${SCHEMA};`);
  return {
    async query<T>(text: string, params?: unknown[]) {
      const res = await lite.query<T>(text, params as never[]);
      return { rows: res.rows, rowCount: res.affectedRows ?? res.rows.length };
    },
    async exec(sql: string) {
      await lite.exec(sql);
    },
  };
}

/** Throws unless unqualified names resolve in `v3` and nowhere else. */
export async function assertSchema(db: Db): Promise<void> {
  const r = await db.query<{ schema: string | null; path: string }>(
    "select current_schema() as schema, current_setting('search_path') as path"
  );
  const row = r.rows[0];
  if (row?.schema !== SCHEMA || row.path.replace(/\s|"/g, '') !== SCHEMA) {
    throw new SchemaPinError(
      `The database connection resolves tables in «${row?.schema ?? 'nothing'}» (search_path «${row?.path ?? ''}»), ` +
        `not in «${SCHEMA}» alone. Refusing to run.`
    );
  }
}
